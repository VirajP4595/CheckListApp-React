import React, { useState, useRef, useCallback, useEffect } from 'react';
import styles from './MentionInput.module.scss';

export interface MentionUser {
    id: string;
    displayName: string;
    mail: string;
    jobTitle?: string;
}

interface MentionInputProps {
    value: string;
    onChange: (value: string) => void;
    onSubmit: () => void;
    onSearchUsers: (query: string) => Promise<MentionUser[]>;
    /** Called when a user is selected from the dropdown */
    onMentionAdded?: (user: MentionUser) => void;
    placeholder?: string;
    disabled?: boolean;
}

/**
 * Chat input with @mention autocomplete.
 * Typing "@" triggers an async org-wide user search via Graph API.
 * Selecting a suggestion inserts "@DisplayName" into the text.
 */
export const MentionInput: React.FC<MentionInputProps> = ({
    value,
    onChange,
    onSubmit,
    onSearchUsers,
    onMentionAdded,
    placeholder = 'Type a message...',
    disabled = false,
}) => {
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [suggestions, setSuggestions] = useState<MentionUser[]>([]);
    const [mentionQuery, setMentionQuery] = useState('');
    const [mentionStartIdx, setMentionStartIdx] = useState(-1);
    const [selectedIdx, setSelectedIdx] = useState(0);
    const [loading, setLoading] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const searchTimerRef = useRef<number | undefined>(undefined);

    // Debounced user search
    const triggerSearch = useCallback((query: string) => {
        if (searchTimerRef.current) {
            window.clearTimeout(searchTimerRef.current);
        }
        if (query.length < 2) {
            setSuggestions([]);
            return;
        }
        setLoading(true);
        searchTimerRef.current = window.setTimeout(async () => {
            try {
                const results = await onSearchUsers(query);
                setSuggestions(results);
                setSelectedIdx(0);
            } catch (e) {
                console.warn('[MentionInput] Search failed', e);
                setSuggestions([]);
            } finally {
                setLoading(false);
            }
        }, 300);
    }, [onSearchUsers]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        onChange(newValue);

        const cursorPos = e.target.selectionStart;
        const textBefore = newValue.slice(0, cursorPos);
        const atIdx = textBefore.lastIndexOf('@');

        if (atIdx >= 0) {
            const charBefore = atIdx > 0 ? textBefore[atIdx - 1] : ' ';
            if (charBefore === ' ' || charBefore === '\n' || atIdx === 0) {
                const query = textBefore.slice(atIdx + 1);
                if (query.length <= 30) {
                    setMentionQuery(query);
                    setMentionStartIdx(atIdx);
                    setShowSuggestions(true);
                    triggerSearch(query);
                    return;
                }
            }
        }
        setShowSuggestions(false);
    };

    const insertMention = useCallback((user: MentionUser) => {
        const before = value.slice(0, mentionStartIdx);
        const after = value.slice(mentionStartIdx + 1 + mentionQuery.length);
        const newValue = `${before}@${user.displayName} ${after}`;
        onChange(newValue);
        setShowSuggestions(false);
        setMentionQuery('');
        setMentionStartIdx(-1);
        setSuggestions([]);

        if (onMentionAdded) onMentionAdded(user);

        setTimeout(() => {
            if (textareaRef.current) {
                const pos = mentionStartIdx + user.displayName.length + 2;
                textareaRef.current.focus();
                textareaRef.current.setSelectionRange(pos, pos);
            }
        }, 0);
    }, [value, mentionStartIdx, mentionQuery, onChange, onMentionAdded]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (showSuggestions && suggestions.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIdx(prev => Math.min(prev + 1, suggestions.length - 1));
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIdx(prev => Math.max(prev - 1, 0));
                return;
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                insertMention(suggestions[selectedIdx]);
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                setShowSuggestions(false);
                return;
            }
        }

        if (e.key === 'Enter' && !e.shiftKey && !showSuggestions) {
            e.preventDefault();
            onSubmit();
        }
    };

    const handleBlur = () => {
        setTimeout(() => setShowSuggestions(false), 200);
    };

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
        }
    }, [value]);

    // Cleanup timer
    useEffect(() => {
        return () => {
            if (searchTimerRef.current) window.clearTimeout(searchTimerRef.current);
        };
    }, []);

    return (
        <div className={styles['mention-input-wrapper']}>
            <textarea
                ref={textareaRef}
                className={styles['mention-textarea']}
                value={value}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onBlur={handleBlur}
                placeholder={placeholder}
                disabled={disabled}
                rows={1}
            />
            {showSuggestions && (suggestions.length > 0 || loading) && (
                <div className={styles['mention-dropdown']}>
                    {loading && suggestions.length === 0 && (
                        <div className={styles['mention-loading']}>Searching...</div>
                    )}
                    {suggestions.map((user, idx) => (
                        <button
                            key={user.id}
                            type="button"
                            className={`${styles['mention-option']} ${idx === selectedIdx ? styles['mention-option--active'] : ''}`}
                            onMouseDown={(e) => {
                                e.preventDefault();
                                insertMention(user);
                            }}
                            onMouseEnter={() => setSelectedIdx(idx)}
                        >
                            <span className={styles['mention-avatar']}>
                                {user.displayName.charAt(0).toUpperCase()}
                            </span>
                            <span className={styles['mention-details']}>
                                <span className={styles['mention-name']}>{user.displayName}</span>
                                {user.jobTitle && (
                                    <span className={styles['mention-title']}>{user.jobTitle}</span>
                                )}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
