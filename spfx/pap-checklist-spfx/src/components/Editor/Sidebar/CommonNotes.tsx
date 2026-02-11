import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@fluentui/react-components';
import { ChevronDown20Regular, ChevronRight20Regular, Notepad24Regular } from '@fluentui/react-icons';
import { RichTextEditor } from '../RichTextEditor';
import type { Checklist } from '../../../models';
import { useUserStore } from '../../../stores';
import { getActivityLogService } from '../../../services';
import styles from './CommonNotes.module.scss';

interface CommonNotesProps {
    checklist: Checklist;
    onUpdate: (updates: Partial<Checklist>) => void;
    onSave?: () => void;
    readOnly?: boolean;
}

export const CommonNotes: React.FC<CommonNotesProps> = ({ checklist, onUpdate, onSave, readOnly }) => {
    const user = useUserStore(state => state.user);
    const [notes, setNotes] = useState(checklist.commonNotes || '');
    const originalNotesRef = useRef(checklist.commonNotes || '');

    // Auto-collapse if empty
    const hasContent = notes && notes.trim().length > 0 && notes !== '<p></p>' && notes !== '<p><br></p>';
    const [expanded, setExpanded] = useState(hasContent);

    useEffect(() => {
        setNotes(checklist.commonNotes || '');
        originalNotesRef.current = checklist.commonNotes || '';
    }, [checklist.id]); // Only reset when checklist changes, not on every keystroke



    const handleChange = (html: string) => {
        setNotes(html);
        // Don't call onUpdate here to avoid spamming store/logs and resetting originalNotesRef
    };

    const handleBlur = () => {
        if (notes !== originalNotesRef.current) {
            // 1. Update Store (State)
            onUpdate({ commonNotes: notes });

            // 2. Log Activity
            void getActivityLogService().logAction(checklist.id, 'common_notes_updated', user?.name || 'Unknown', 'Updated Common Notes');

            // 3. Save to Server
            onSave?.();

            // 4. Update Reference
            originalNotesRef.current = notes;
        }
    };

    const handleToggle = () => {
        setExpanded(!expanded);
    };

    return (
        <div className={`${styles['common-notes-card']} ${expanded ? styles['common-notes-card--expanded'] : ''}`}>
            <button
                className={styles['common-notes-header']}
                onClick={handleToggle}
                type="button"
            >
                <div className={styles['common-notes-header-left']}>
                    <span className={styles['common-notes-icon']}>
                        {expanded ? <ChevronDown20Regular /> : <ChevronRight20Regular />}
                    </span>
                    <Notepad24Regular className={styles['common-notes-title-icon']} />
                    <span className={styles['common-notes-title']}>Common Notes</span>
                    {!hasContent && !expanded && (
                        <span className={styles['common-notes-empty-hint']}>Click to add project-wide notes</span>
                    )}
                </div>
            </button>

            {expanded && (
                <div className={styles['common-notes-content']}>
                    <RichTextEditor
                        content={notes}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        placeholder="Add project-wide notes, instructions, or references that apply to all items..."
                        readOnly={readOnly}
                    />
                </div>
            )}
        </div>
    );
};
