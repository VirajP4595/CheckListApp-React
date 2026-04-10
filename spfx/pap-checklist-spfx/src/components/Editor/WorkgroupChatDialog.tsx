import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
    Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent,
    Input, Button
} from '@fluentui/react-components';
import { Send24Regular, Dismiss24Regular } from '@fluentui/react-icons';
import type { Workgroup, ChecklistComment } from '../../models';
import { generateId } from '../../models';
import { useUserStore, useChecklistStore } from '../../stores';
import { getActivityLogService } from '../../services';
import { sharePointGroupService } from '../../services/sharePointGroupService';
import styles from './WorkgroupChatDialog.module.scss';

interface WorkgroupChatDialogProps {
    workgroup: Workgroup;
    open: boolean;
    onClose: () => void;
    readOnly?: boolean;
}

export const WorkgroupChatDialog: React.FC<WorkgroupChatDialogProps> = ({ workgroup, open, onClose, readOnly }) => {
    const [newMessage, setNewMessage] = useState('');
    const [showMentionPopup, setShowMentionPopup] = useState(false);
    const [mentionFilter, setMentionFilter] = useState('');
    const [mentionStartIdx, setMentionStartIdx] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const user = useUserStore(state => state.user);
    const updateWorkgroup = useChecklistStore(state => state.updateWorkgroup);
    const activeChecklist = useChecklistStore(state => state.activeChecklist);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Get the latest workgroup data from the store
    const currentWorkgroup = activeChecklist?.workgroups.find(w => w.id === workgroup.id) || workgroup;
    const comments = currentWorkgroup.comments || [];

    // Build list of mentionable users — site users merged with job details users
    const [siteUserNames, setSiteUserNames] = useState<string[]>([]);

    useEffect(() => {
        if (!open) return;
        sharePointGroupService.getSiteUserNames()
            .then(names => setSiteUserNames(names))
            .catch(() => setSiteUserNames([]));
    }, [open]);

    const mentionableUsers = useMemo(() => {
        // Seed with job details / known users
        const seed: string[] = [];
        const job = activeChecklist?.jobDetails;
        if (job?.leadEstimator) seed.push(job.leadEstimator);
        if (job?.reviewer && !seed.includes(job.reviewer)) seed.push(job.reviewer);
        if (activeChecklist?.createdBy && !seed.includes(activeChecklist.createdBy)) seed.push(activeChecklist.createdBy);
        if (user?.name && !seed.includes(user.name)) seed.push(user.name);

        // Merge site users, avoid duplicates
        const merged = [...seed];
        for (const name of siteUserNames) {
            if (!merged.includes(name)) merged.push(name);
        }
        return merged;
    }, [activeChecklist?.jobDetails, activeChecklist?.createdBy, user?.name, siteUserNames]);

    // Filter mentionable users based on typed text after @
    const filteredMentions = useMemo(() => {
        if (!mentionFilter) return mentionableUsers;
        const lower = mentionFilter.toLowerCase();
        return mentionableUsers.filter(u => u.toLowerCase().includes(lower));
    }, [mentionableUsers, mentionFilter]);

    const handleSelectMention = useCallback((name: string) => {
        // Replace text from @ to cursor with @Name
        const before = newMessage.substring(0, mentionStartIdx);
        const after = newMessage.substring(mentionStartIdx + mentionFilter.length + 1); // +1 for @
        setNewMessage(`${before}@${name} ${after}`);
        setShowMentionPopup(false);
        setMentionFilter('');
        setMentionStartIdx(-1);
        // Focus back on input
        setTimeout(() => inputRef.current?.focus(), 0);
    }, [newMessage, mentionStartIdx, mentionFilter]);

    const handleInputChange = useCallback((_: unknown, data: { value: string }) => {
        const value = data.value;
        setNewMessage(value);

        // Detect @ mention trigger — use end of string as cursor approximation
        const textBeforeCursor = value;
        const lastAtIdx = textBeforeCursor.lastIndexOf('@');

        if (lastAtIdx >= 0) {
            // Check if @ is at start or preceded by a space (word boundary)
            const charBefore = lastAtIdx > 0 ? textBeforeCursor[lastAtIdx - 1] : ' ';
            if (charBefore === ' ' || charBefore === '\n' || lastAtIdx === 0) {
                const filterText = textBeforeCursor.substring(lastAtIdx + 1);
                // Only show popup if no space in filter (still typing mention name)
                if (!filterText.includes(' ')) {
                    setMentionStartIdx(lastAtIdx);
                    setMentionFilter(filterText);
                    setShowMentionPopup(true);
                    return;
                }
            }
        }

        setShowMentionPopup(false);
        setMentionFilter('');
        setMentionStartIdx(-1);
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [comments.length]);

    const handleSend = async () => {
        if (!newMessage.trim() || !user) return;

        const comment: ChecklistComment = {
            id: generateId(),
            text: newMessage.trim(),
            author: user.name,
            createdAt: new Date(),
        };

        const updatedComments = [...comments, comment];
        await updateWorkgroup(workgroup.id, { comments: updatedComments });

        void getActivityLogService().logAction(
            workgroup.checklistId,
            'comment_added',
            user.name,
            `Comment on ${workgroup.name}`
        );

        setNewMessage('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (showMentionPopup && filteredMentions.length > 0) {
                handleSelectMention(filteredMentions[0]);
            } else {
                void handleSend();
            }
        }
        if (e.key === 'Escape' && showMentionPopup) {
            setShowMentionPopup(false);
        }
    };

    /** Render message text with @mentions highlighted */
    const renderMessageWithMentions = (text: string): React.ReactNode => {
        // Match @Name patterns (name = one or more words until space-space or end)
        const parts = text.split(/(@\S+(?:\s\S+)?)/g);
        return parts.map((part, i) => {
            if (part.startsWith('@') && mentionableUsers.some(u => part === `@${u}`)) {
                return <span key={i} className={styles['wg-chat-mention']}>{part}</span>;
            }
            return <React.Fragment key={i}>{part}</React.Fragment>;
        });
    };

    return (
        <Dialog open={open} onOpenChange={(_, data) => { if (!data.open) onClose(); }}>
            <DialogSurface className={styles['wg-chat-dialog']}>
                <DialogBody>
                    <DialogTitle
                        action={
                            <Button appearance="subtle" icon={<Dismiss24Regular />} onClick={onClose} />
                        }
                    >
                        Chat — {currentWorkgroup.name}
                    </DialogTitle>
                    <DialogContent className={styles['wg-chat-content']}>
                        <div className={styles['wg-chat-messages']}>
                            {comments.length === 0 && (
                                <div className={styles['wg-chat-empty']}>
                                    No comments yet. Start the conversation!
                                </div>
                            )}
                            {comments.map(comment => (
                                <div
                                    key={comment.id}
                                    className={`${styles['wg-chat-message']} ${
                                        comment.author === user?.name
                                            ? styles['wg-chat-message--user']
                                            : styles['wg-chat-message--other']
                                    }`}
                                >
                                    <div className={styles['wg-chat-sender']}>{comment.author}</div>
                                    <span>{renderMessageWithMentions(comment.text)}</span>
                                    <div className={styles['wg-chat-time']}>
                                        {new Date(comment.createdAt).toLocaleDateString()}
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        <div className={styles['wg-chat-input-area']}>
                            {showMentionPopup && filteredMentions.length > 0 && (
                                <div className={styles['wg-chat-mention-popup']}>
                                    {filteredMentions.map(name => (
                                        <button
                                            key={name}
                                            className={styles['wg-chat-mention-option']}
                                            onClick={() => handleSelectMention(name)}
                                            type="button"
                                        >
                                            @{name}
                                        </button>
                                    ))}
                                </div>
                            )}
                            <Input
                                className={styles['wg-chat-input']}
                                input={{ ref: inputRef }}
                                value={newMessage}
                                onChange={handleInputChange}
                                onKeyDown={handleKeyDown}
                                placeholder="Type a message... Use @ to mention"
                                disabled={readOnly}
                            />
                            <Button
                                className={styles['wg-chat-send-btn']}
                                appearance="primary"
                                icon={<Send24Regular />}
                                onClick={() => void handleSend()}
                                disabled={readOnly || !newMessage.trim()}
                            />
                        </div>
                    </DialogContent>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
};
