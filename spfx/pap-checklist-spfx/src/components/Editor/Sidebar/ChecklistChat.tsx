import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Button, Tooltip } from '@fluentui/react-components';
import { Send24Regular, ThumbLike20Regular, ThumbLike20Filled } from '@fluentui/react-icons';
import { Checklist, ChecklistComment, CommentMention, generateId } from '../../../models';
import { useUserStore, useChecklistStore } from '../../../stores';
import { getActivityLogService, getGraphChatService } from '../../../services';
import { MentionInput, MentionUser } from './MentionInput';
import styles from './ChecklistChat.module.scss';

interface ChecklistChatProps {
    checklist: Checklist;
    onUpdate: (updates: Partial<Checklist>) => void;
    onSave?: () => void;
    readOnly?: boolean;
}

/** localStorage key for tracking the last-read timestamp per checklist+user */
const getLastReadKey = (checklistId: string, userId: string): string =>
    `chat_lastread_${checklistId}_${userId}`;

/** Get the count of unread messages (exported for use by sidebar badge) */
export const getUnreadCount = (checklist: Checklist, userId: string): number => {
    const key = getLastReadKey(checklist.id, userId);
    const lastRead = localStorage.getItem(key);
    if (!lastRead) return (checklist.comments || []).length;
    const lastReadTime = new Date(lastRead).getTime();
    return (checklist.comments || []).filter(c => new Date(c.createdAt).getTime() > lastReadTime).length;
};

/** Render message text with @mentions highlighted (string-based, no dynamic RegExp) */
const renderMessageText = (text: string, mentions?: CommentMention[]): React.ReactNode => {
    if (!mentions || mentions.length === 0) return text;

    // Build list of mention tags to search for
    const mentionTags = mentions.map(m => '@' + m.displayName);

    // Split text into segments: plain text and mention spans
    const segments: Array<{ text: string; isMention: boolean }> = [];
    let remaining = text;

    while (remaining.length > 0) {
        // Find the earliest mention in the remaining text
        let earliestIdx = -1;
        let earliestTag = '';
        for (let t = 0; t < mentionTags.length; t++) {
            const idx = remaining.toLowerCase().indexOf(mentionTags[t].toLowerCase());
            if (idx !== -1 && (earliestIdx === -1 || idx < earliestIdx)) {
                earliestIdx = idx;
                earliestTag = mentionTags[t];
            }
        }

        if (earliestIdx === -1) {
            segments.push({ text: remaining, isMention: false });
            break;
        }

        if (earliestIdx > 0) {
            segments.push({ text: remaining.substring(0, earliestIdx), isMention: false });
        }
        segments.push({ text: remaining.substring(earliestIdx, earliestIdx + earliestTag.length), isMention: true });
        remaining = remaining.substring(earliestIdx + earliestTag.length);
    }

    return segments.map((seg, i) =>
        seg.isMention
            ? <span key={i} className={styles['chat-mention']}>{seg.text}</span>
            : seg.text
    );
};

export const ChecklistChat: React.FC<ChecklistChatProps> = ({ checklist, onUpdate, onSave, readOnly }) => {
    const [newMessage, setNewMessage] = useState('');
    // Track mentions accumulated during typing (from dropdown selections)
    const [pendingMentions, setPendingMentions] = useState<MentionUser[]>([]);
    const user = useUserStore(state => state.user);
    const activeChecklist = useChecklistStore(state => state.activeChecklist);
    const currentChecklist = (activeChecklist?.id === checklist.id ? activeChecklist : checklist);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [currentChecklist.comments]);

    // Mark messages as read
    const markAsRead = useCallback(() => {
        if (user?.id) {
            const key = getLastReadKey(currentChecklist.id, user.id);
            localStorage.setItem(key, new Date().toISOString());
        }
    }, [currentChecklist.id, user?.id]);

    useEffect(() => {
        markAsRead();
    }, [markAsRead, currentChecklist.comments]);

    // Search org users via Graph API
    const handleSearchUsers = useCallback(async (query: string): Promise<MentionUser[]> => {
        try {
            const chatService = getGraphChatService();
            const results = await chatService.searchUsers(query);
            return results.map(u => ({
                id: u.id,
                displayName: u.displayName,
                mail: u.mail,
                jobTitle: u.jobTitle,
            }));
        } catch (e) {
            console.warn('[ChecklistChat] User search failed', e);
            return [];
        }
    }, []);

    // Track when a user is selected from the mention dropdown
    const handleMentionAdded = useCallback((mentionUser: MentionUser) => {
        setPendingMentions(prev => {
            if (prev.some(m => m.id === mentionUser.id)) return prev;
            return prev.concat([mentionUser]);
        });
    }, []);

    const handleSend = () => {
        if (!newMessage.trim() || !user) return;

        // Build mentions from pending selections that still appear in the final text
        const finalMentions: CommentMention[] = pendingMentions
            .filter(m => newMessage.indexOf(`@${m.displayName}`) !== -1)
            .map(m => ({ userId: m.id, displayName: m.displayName }));

        const comment: ChecklistComment = {
            id: generateId(),
            text: newMessage.trim(),
            author: user.name,
            authorEmail: user.email,
            createdAt: new Date(),
            mentions: finalMentions.length > 0 ? finalMentions : undefined,
        };

        const updatedComments = (currentChecklist.comments || []).concat([comment]);
        onUpdate({ comments: updatedComments });

        // Log activity
        void getActivityLogService().logAction(
            checklist.id,
            'comment_added',
            user.name
        );

        // Send Teams notifications to mentioned users via Graph API (fire-and-forget)
        if (finalMentions.length > 0) {
            const chatService = getGraphChatService();
            void chatService.notifyMentionedUsers(
                finalMentions.map(m => ({ id: m.userId, displayName: m.displayName })),
                newMessage.trim(),
                user.name,
                currentChecklist.title
            );
        }

        onSave?.();
        setNewMessage('');
        setPendingMentions([]);
        markAsRead();
    };

    const handleToggleLike = (commentId: string) => {
        if (!user) return;
        const comments = (currentChecklist.comments || []).map(c => {
            if (c.id !== commentId) return c;
            const likes = c.likes || [];
            const alreadyLiked = likes.some(l => l.userId === user.id);
            return {
                ...c,
                likes: alreadyLiked
                    ? likes.filter(l => l.userId !== user.id)
                    : likes.concat([{
                        userId: user.id,
                        displayName: user.name,
                        timestamp: new Date().toISOString()
                    }]),
            };
        });
        onUpdate({ comments });
        onSave?.();
    };

    return (
        <div className={styles['chat-container']}>
            <div className={styles['chat-messages']}>
                {(currentChecklist.comments || []).length === 0 && (
                    <div className={styles['chat-empty']}>
                        No comments yet. Start the conversation!
                    </div>
                )}
                {(currentChecklist.comments || []).map(comment => {
                    const isOwnMessage = comment.author === user?.name;
                    const likes = comment.likes || [];
                    const hasLiked = user ? likes.some(l => l.userId === user.id) : false;
                    const likeNames = likes.map(l => l.displayName).join(', ');

                    return (
                        <div
                            key={comment.id}
                            className={`${styles['chat-message']} ${isOwnMessage
                                ? styles['chat-message--user']
                                : styles['chat-message--system']
                                }`}
                        >
                            <div className={styles['chat-message-sender']}>{comment.author}</div>
                            <span className={styles['chat-message-text']}>
                                {renderMessageText(comment.text, comment.mentions)}
                            </span>
                            <div className={styles['chat-message-footer']}>
                                <span className={styles['chat-message-time']}>
                                    {new Date(comment.createdAt).toLocaleDateString()}
                                </span>
                                <div className={styles['chat-like-area']}>
                                    {likes.length > 0 && (
                                        <Tooltip
                                            content={likeNames}
                                            relationship="description"
                                        >
                                            <span className={styles['chat-like-count']}>
                                                {likes.length}
                                            </span>
                                        </Tooltip>
                                    )}
                                    <button
                                        className={`${styles['chat-like-btn']} ${hasLiked ? styles['chat-like-btn--active'] : ''}`}
                                        onClick={() => handleToggleLike(comment.id)}
                                        title={hasLiked ? 'Remove like' : 'Like'}
                                        disabled={readOnly}
                                    >
                                        {hasLiked ? <ThumbLike20Filled /> : <ThumbLike20Regular />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            <div className={styles['chat-input-area']}>
                <MentionInput
                    value={newMessage}
                    onChange={setNewMessage}
                    onSubmit={handleSend}
                    onSearchUsers={handleSearchUsers}
                    onMentionAdded={handleMentionAdded}
                    placeholder="Type @ to mention someone..."
                    disabled={readOnly}
                />
                <Button
                    className={styles['chat-send-btn']}
                    appearance="primary"
                    icon={<Send24Regular />}
                    onClick={handleSend}
                    disabled={readOnly || !newMessage.trim()}
                />
            </div>
        </div>
    );
};
