import React from 'react';
import ReactDOM from 'react-dom';
import { Button } from '@fluentui/react-components';
import { Dismiss24Regular } from '@fluentui/react-icons';
import type { Revision, AnswerState } from '../../models';
import { ANSWER_CONFIG } from '../../models';
import styles from './RevisionViewer.module.scss';

interface RevisionViewerProps {
    revision: Revision;
    onClose: () => void;
}

export const RevisionViewer: React.FC<RevisionViewerProps> = ({ revision, onClose }) => {
    const snapshot = revision.snapshot;

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            e.stopPropagation();
            onClose();
        }
    };

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    const getAnswerStyle = (answer: AnswerState) => {
        const config = ANSWER_CONFIG[answer];
        return {
            backgroundColor: config?.color || '#8a8886',
            color: 'white',
        };
    };

    const content = (
        <div
            className={styles['revision-overlay']}
            onClick={handleOverlayClick}
            onKeyDown={handleKeyDown}
            role="dialog"
            aria-modal="true"
            aria-label="Historical Snapshot"
        >
            <div
                className={styles['revision-modal']}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <header className={styles['revision-header']}>
                    <div className={styles['revision-header-content']}>
                        <div className={styles['revision-badges']}>
                            <span className={`${styles['revision-badge']} ${styles['revision-badge--rev']}`}>
                                REV {revision.number}
                            </span>
                            <span className={`${styles['revision-badge']} ${styles['revision-badge--snapshot']}`}>
                                Historical Snapshot
                            </span>
                        </div>
                        <h2 className={styles['revision-title']}>
                            {snapshot?.title || 'Checklist Snapshot'}
                        </h2>
                    </div>
                    <Button
                        className={styles['revision-close-btn']}
                        appearance="subtle"
                        icon={<Dismiss24Regular />}
                        onClick={onClose}
                        aria-label="Close revision viewer"
                    />
                </header>

                {/* Content */}
                <div className={styles['revision-content']}>
                    {/* Summary */}
                    <div className={styles['revision-summary']}>
                        <span className={styles['revision-summary-label']}>Revision Summary: </span>
                        <span className={styles['revision-summary-text']}>{revision.summary}</span>
                    </div>

                    {/* Workgroups */}
                    {snapshot?.workgroups?.map(workgroup => (
                        <div key={workgroup.id} className={styles['revision-workgroup']}>
                            <div className={styles['revision-workgroup-header']}>
                                <span className={styles['revision-workgroup-number']}>{workgroup.number}</span>
                                <span className={styles['revision-workgroup-name']}>{workgroup.name}</span>
                            </div>

                            {workgroup.rows.map(row => (
                                <div key={row.id} className={styles['revision-row']}>
                                    <span
                                        className={styles['revision-answer-badge']}
                                        style={getAnswerStyle(row.answer)}
                                    >
                                        {ANSWER_CONFIG[row.answer]?.label || row.answer}
                                    </span>
                                    <div className={styles['revision-row-content']}>
                                        <span className={styles['revision-row-description']}>
                                            {row.description}
                                        </span>
                                        {row.notes && (
                                            <span className={styles['revision-row-notes']}>
                                                {row.notes}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    return ReactDOM.createPortal(content, document.body);
};
