import React, { useState, useRef, useEffect } from 'react';
import { Input, Button } from '@fluentui/react-components';
import { Send24Regular } from '@fluentui/react-icons';
import { Checklist, ChecklistComment, generateId } from '../../../models';
import { useUserStore } from '../../../stores';
import styles from './ChecklistChat.module.scss';

interface ChecklistChatProps {
    checklist: Checklist;
    onUpdate: (updates: Partial<Checklist>) => void;
    readOnly?: boolean;
}

export const ChecklistChat: React.FC<ChecklistChatProps> = ({ checklist, onUpdate, readOnly }) => {
    const [newMessage, setNewMessage] = useState('');
    const user = useUserStore(state => state.user);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [checklist.comments]);

    const handleSend = () => {
        if (!newMessage.trim() || !user) return;

        const comment: ChecklistComment = {
            id: generateId(),
            text: newMessage.trim(),
            author: user.name,
            createdAt: new Date(),
        };

        const updatedComments = [...(checklist.comments || []), comment];
        onUpdate({ comments: updatedComments });
        setNewMessage('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className={styles['chat-container']}>
            <div className={styles['chat-messages']}>
                {(checklist.comments || []).length === 0 && (
                    <div className={styles['chat-empty']}>
                        No comments yet. Start the conversation!
                    </div>
                )}
                {(checklist.comments || []).map(comment => (
                    <div
                        key={comment.id}
                        className={`${styles['chat-message']} ${comment.author === user?.name || comment.author === 'John Smith'
                                ? styles['chat-message--user']
                                : styles['chat-message--system']
                            }`}
                    >
                        <div className={styles['chat-message-sender']}>{comment.author}</div>
                        <span>{comment.text}</span>
                        <div className={styles['chat-message-time']}>
                            {new Date(comment.createdAt).toLocaleDateString()}
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            <div className={styles['chat-input-area']}>
                <Input
                    className={styles['chat-input']}
                    value={newMessage}
                    onChange={(_, data) => setNewMessage(data.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message..."
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
