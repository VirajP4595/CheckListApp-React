import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { Button, Spinner } from '@fluentui/react-components';
import { ArrowLeft24Regular, Dismiss24Regular, ArrowDownload24Regular } from '@fluentui/react-icons';
import { getImageService } from '../../services';
import type { Revision, AnswerState } from '../../models';
import { ANSWER_CONFIG } from '../../models';
import { RichTextEditor } from '../Editor/RichTextEditor';
import styles from './RevisionViewer.module.scss';

interface RevisionViewerProps {
    revision: Revision;
    onClose: () => void;
}

export const RevisionViewer: React.FC<RevisionViewerProps> = ({ revision, onClose }) => {
    const snapshot = revision.snapshot;

    const [previewImage, setPreviewImage] = useState<{ src: string, caption?: string, id?: string, loading?: boolean } | null>(null);

    React.useEffect(() => {
        if (previewImage?.id && previewImage.loading) {
            let active = true;
            getImageService().downloadImageContent(previewImage.id)
                .then(base64 => {
                    if (active) {
                        setPreviewImage(prev => prev ? { ...prev, src: base64, loading: false } : null);
                    }
                })
                .catch(err => {
                    console.error("Failed to load full image", err);
                    if (active) {
                        setPreviewImage(prev => prev ? { ...prev, loading: false } : null);
                    }
                });
            return () => { active = false; };
        }
    }, [previewImage?.id, previewImage?.loading]);

    React.useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = '';
        };
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            e.stopPropagation();
            if (previewImage) {
                setPreviewImage(null);
            } else {
                onClose();
            }
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
            onKeyDown={handleKeyDown}
            role="dialog"
            aria-modal="true"
            aria-label="Revision View"
        >
            {/* Header */}
            <header className={styles['revision-header']}>
                <Button
                    className={styles['revision-close-btn']}
                    appearance="subtle"
                    icon={<ArrowLeft24Regular />}
                    onClick={onClose}
                    aria-label="Go Back"
                >
                    Back
                </Button>

                <div className={styles['revision-header-content']}>
                    <h2 className={styles['revision-title']}>
                        {snapshot?.title || 'Checklist Snapshot'}
                    </h2>
                    <div className={styles['revision-badges']}>
                        {revision.number > 0 ? (
                            <span className={`${styles['revision-badge']} ${styles['revision-badge--rev']}`}>
                                REV {revision.number}
                            </span>
                        ) : (
                            <span className={`${styles['revision-badge']} ${styles['revision-badge--snapshot']}`}>
                                Current Preview
                            </span>
                        )}
                        <span className={`${styles['revision-badge']} ${styles['revision-badge--snapshot']}`}>
                            {revision.createdAt.toLocaleDateString()}
                        </span>
                    </div>
                </div>
            </header>

            {/* Content Container */}
            <div className={styles['revision-content']}>
                <div> {/* Centering Container */}
                    {/* Summary (Only show if present) */}
                    {revision.summary && (
                        <div className={styles['revision-summary']}>
                            <span className={styles['revision-summary-label']}>Revision Summary: </span>
                            <span className={styles['revision-summary-text']}>{revision.summary}</span>
                        </div>
                    )}

                    {/* Workgroups */}
                    {snapshot?.workgroups?.map(workgroup => {
                        // Filter rows - hide BLANK items
                        const visibleRows = workgroup.rows.filter(r =>
                            r.answer && r.answer !== 'BLANK' && r.answer.trim() !== ''
                        );

                        if (visibleRows.length === 0) return null;

                        return (
                            <div key={workgroup.id} className={styles['revision-workgroup']}>
                                <div className={styles['revision-workgroup-header']}>
                                    <span className={styles['revision-workgroup-number']}>{workgroup.number}</span>
                                    <span className={styles['revision-workgroup-name']}>{workgroup.name}</span>
                                </div>

                                {visibleRows.map(row => (
                                    <div key={row.id} className={styles['revision-row']}>
                                        <div className={styles['revision-row-content']}>
                                            <div className={styles['revision-row-header']}>
                                                <span className={styles['revision-row-name']}>{row.name}</span>
                                                <span
                                                    className={styles['revision-status-pill']}
                                                    style={getAnswerStyle(row.answer)}
                                                >
                                                    {ANSWER_CONFIG[row.answer]?.label || row.answer}
                                                </span>
                                            </div>

                                            {/* Description (Rich Text or plain) */}
                                            {row.description && (
                                                <div className={styles['revision-row-description']}>
                                                    <RichTextEditor
                                                        content={row.description}
                                                        readOnly={true}
                                                        className={styles['compact-rte']}
                                                    />
                                                </div>
                                            )}

                                            {row.notes && (
                                                <div className={styles['revision-row-notes']}>
                                                    <span className={styles['revision-notes-label']}>Notes:</span>
                                                    <RichTextEditor
                                                        content={row.notes}
                                                        readOnly={true}
                                                        className={styles['compact-rte']}
                                                    />
                                                </div>
                                            )}

                                            {/* Images Grid - Moved to bottom */}
                                            {row.images && row.images.length > 0 && (
                                                <div className={styles['revision-images']}>
                                                    {row.images.map((img, idx) => (
                                                        <div
                                                            key={idx}
                                                            className={styles['revision-image-card']}
                                                            onClick={() => {
                                                                const needsLoad = img.id && !img.source.startsWith('data:') && !img.source.startsWith('blob:');
                                                                setPreviewImage({
                                                                    src: img.source,
                                                                    caption: img.caption,
                                                                    id: img.id,
                                                                    loading: !!needsLoad
                                                                });
                                                            }}
                                                        >
                                                            <img
                                                                src={img.thumbnailUrl || img.source}
                                                                alt={img.caption}
                                                                className={styles['revision-image']}
                                                            />
                                                            {img.caption && <span className={styles['revision-image-caption']}>{img.caption}</span>}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Lightbox Overlay */}
            {previewImage && (
                <div
                    className={styles['lightbox-overlay']}
                    onClick={() => setPreviewImage(null)}
                >
                    <div className={styles['lightbox-content']} onClick={e => e.stopPropagation()}>
                        <div className={styles['lightbox-actions']}>
                            {previewImage.src && (previewImage.src.startsWith('data:') || previewImage.src.startsWith('blob:')) && (
                                <button
                                    className={styles['lightbox-download']}
                                    onClick={() => {
                                        const a = document.createElement('a');
                                        a.href = previewImage.src;
                                        a.download = `image-${revision.number}-${Date.now()}.png`; // Simple naming
                                        a.click();
                                    }}
                                    title="Download Image"
                                >
                                    <ArrowDownload24Regular />
                                </button>
                            )}
                            <button
                                className={styles['lightbox-close']}
                                onClick={() => setPreviewImage(null)}
                            >
                                <Dismiss24Regular />
                            </button>
                        </div>

                        {previewImage.loading ? (
                            <div className={styles['lightbox-loading']}>
                                <Spinner size="huge" label="Loading full resolution..." />
                            </div>
                        ) : (
                            <img src={previewImage.src} alt={previewImage.caption || 'Preview'} />
                        )}
                        {previewImage.caption && (
                            <div className={styles['lightbox-caption']}>{previewImage.caption}</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );

    return ReactDOM.createPortal(content, document.body);
};
