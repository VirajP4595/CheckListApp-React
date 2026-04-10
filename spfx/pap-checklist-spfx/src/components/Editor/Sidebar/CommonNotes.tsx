import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@fluentui/react-components';
import {
    ChevronDown20Regular, ChevronRight20Regular,
    Notepad24Regular, Calculator24Regular,
    Add20Regular, Delete20Regular,
    ArrowUp20Regular, ArrowDown20Regular
} from '@fluentui/react-icons';
import { RichTextEditor } from '../RichTextEditor';
import { VoiceInputButton } from '../VoiceInputButton';
import { CarpentryLabourDialog } from '../CarpentryLabourDialog';
import type { Checklist, CommonNoteSection } from '../../../models';
import { generateId } from '../../../models';
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
    const [sections, setSections] = useState<CommonNoteSection[]>(checklist.commonNotes || []);
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
    const [containerExpanded, setContainerExpanded] = useState(sections.length > 0);
    const [showCarpentryDialog, setShowCarpentryDialog] = useState(false);
    const originalRef = useRef<string>(JSON.stringify(checklist.commonNotes || []));
    const editorRefs = useRef<Record<string, any>>({});
    const contentRefs = useRef<Record<string, string>>({});

    useEffect(() => {
        const newSections = checklist.commonNotes || [];
        setSections(newSections);
        originalRef.current = JSON.stringify(newSections);
        setContainerExpanded(newSections.length > 0);
    }, [checklist.id]);

    const saveSections = useCallback((updated: CommonNoteSection[]) => {
        const serialized = JSON.stringify(updated);
        if (serialized !== originalRef.current) {
            onUpdate({ commonNotes: updated });
            void getActivityLogService().logAction(checklist.id, 'common_notes_updated', user?.name || 'Unknown', 'Updated Common Notes');
            onSave?.();
            originalRef.current = serialized;
        }
    }, [checklist.id, onUpdate, onSave, user?.name]);

    const handleAddSection = () => {
        const newSection: CommonNoteSection = {
            id: generateId(),
            title: `Notes Section ${sections.length + 1}`,
            content: '',
            order: sections.length,
        };
        const updated = [...sections, newSection];
        setSections(updated);
        setExpandedSections(prev => ({ ...prev, [newSection.id]: true }));
        saveSections(updated);
    };

    const handleDeleteSection = (id: string) => {
        if (sections.length <= 1) return;
        const updated = sections.filter(s => s.id !== id).map((s, i) => ({ ...s, order: i }));
        setSections(updated);
        saveSections(updated);
    };

    const handleTitleChange = (id: string, title: string) => {
        setSections(prev => prev.map(s => s.id === id ? { ...s, title } : s));
    };

    const handleTitleBlur = (id: string) => {
        saveSections(sections);
    };

    const handleContentChange = (id: string, content: string) => {
        contentRefs.current[id] = content;
    };

    const handleContentBlur = (id: string) => {
        const latestContent = contentRefs.current[id];
        if (latestContent !== undefined) {
            const updated = sections.map(s =>
                s.id === id ? { ...s, content: latestContent } : s
            );
            setSections(updated);
            saveSections(updated);
        } else {
            saveSections(sections);
        }
    };

    const handleMove = (id: string, direction: 'up' | 'down') => {
        const idx = sections.findIndex(s => s.id === id);
        if ((direction === 'up' && idx === 0) || (direction === 'down' && idx === sections.length - 1)) return;
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        const updated = [...sections];
        [updated[idx], updated[swapIdx]] = [updated[swapIdx], updated[idx]];
        const reordered = updated.map((s, i) => ({ ...s, order: i }));
        setSections(reordered);
        saveSections(reordered);
    };

    const toggleSection = (id: string) => {
        setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));
    };

    return (
        <div className={`${styles['common-notes-card']} ${containerExpanded ? styles['common-notes-card--expanded'] : ''}`}>
            <div className={styles['common-notes-header']}>
                <button
                    className={styles['common-notes-title-btn']}
                    onClick={() => setContainerExpanded(!containerExpanded)}
                    type="button"
                >
                    <div className={styles['common-notes-header-left']}>
                        <span className={styles['common-notes-icon']}>
                            {containerExpanded ? <ChevronDown20Regular /> : <ChevronRight20Regular />}
                        </span>
                        <Notepad24Regular className={styles['common-notes-title-icon']} />
                        <span className={styles['common-notes-title']}>Common Notes</span>
                        {sections.length === 0 && !containerExpanded && (
                            <span className={styles['common-notes-empty-hint']}>Click to add project-wide notes</span>
                        )}
                        {sections.length > 0 && (
                            <span className={styles['common-notes-count']}>{sections.length}</span>
                        )}
                    </div>
                </button>
                <Button
                    className={styles['carpentry-btn']}
                    appearance="subtle"
                    icon={<Calculator24Regular />}
                    size="small"
                    onClick={(e) => {
                        e.stopPropagation();
                        setShowCarpentryDialog(true);
                    }}
                >
                    Carpentry Labour
                </Button>
            </div>

            {containerExpanded && (
                <div className={styles['common-notes-sections']}>
                    {sections.map((section, idx) => {
                        const isExpanded = expandedSections[section.id] ?? true;
                        return (
                            <div key={section.id} className={styles['note-section']}>
                                <div className={styles['note-section-header']}>
                                    <button
                                        className={styles['note-section-toggle']}
                                        onClick={() => toggleSection(section.id)}
                                        type="button"
                                    >
                                        <span className={styles['note-section-chevron']}>
                                            {isExpanded ? <ChevronDown20Regular /> : <ChevronRight20Regular />}
                                        </span>
                                    </button>
                                    <input
                                        className={styles['note-section-title-input']}
                                        value={section.title}
                                        onChange={(e) => handleTitleChange(section.id, e.target.value)}
                                        onBlur={() => handleTitleBlur(section.id)}
                                        disabled={readOnly}
                                        placeholder="Section title..."
                                    />
                                    <div className={styles['note-section-actions']}>
                                        <button
                                            className={styles['note-section-action-btn']}
                                            onClick={() => handleMove(section.id, 'up')}
                                            disabled={idx === 0}
                                            title="Move up"
                                        >
                                            <ArrowUp20Regular />
                                        </button>
                                        <button
                                            className={styles['note-section-action-btn']}
                                            onClick={() => handleMove(section.id, 'down')}
                                            disabled={idx === sections.length - 1}
                                            title="Move down"
                                        >
                                            <ArrowDown20Regular />
                                        </button>
                                        {sections.length > 1 && !readOnly && (
                                            <button
                                                className={`${styles['note-section-action-btn']} ${styles['note-section-action-btn--delete']}`}
                                                onClick={() => handleDeleteSection(section.id)}
                                                title="Delete section"
                                            >
                                                <Delete20Regular />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {isExpanded && (
                                    <div className={styles['note-section-content']}>
                                        <RichTextEditor
                                            content={section.content}
                                            onChange={(html) => handleContentChange(section.id, html)}
                                            onBlur={() => handleContentBlur(section.id)}
                                            onEditorReady={(e) => { editorRefs.current[section.id] = e; }}
                                            placeholder="Add notes for this section..."
                                            readOnly={readOnly}
                                            toolbarExtra={!readOnly ? (
                                                <VoiceInputButton
                                                    onTranscript={(text) => {
                                                        const editor = editorRefs.current[section.id];
                                                        if (editor) {
                                                            editor.chain().focus().insertContent(text + ' ').run();
                                                        }
                                                    }}
                                                />
                                            ) : undefined}
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {!readOnly && (
                        <button
                            className={styles['add-section-btn']}
                            onClick={handleAddSection}
                            type="button"
                        >
                            <Add20Regular /> Add Notes Section
                        </button>
                    )}
                </div>
            )}

            {showCarpentryDialog && (
                <CarpentryLabourDialog
                    checklist={checklist}
                    onClose={() => setShowCarpentryDialog(false)}
                    readOnly={readOnly}
                />
            )}
        </div>
    );
};
