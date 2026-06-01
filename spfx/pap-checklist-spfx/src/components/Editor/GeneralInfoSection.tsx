import React, { useState, useCallback, useRef } from 'react';
import { Toggle } from '@fluentui/react/lib/Toggle';
import type { Checklist } from '../../models';
import styles from './GeneralInfoSection.module.scss';

interface GeneralInfoSectionProps {
    checklist: Checklist;
    onUpdate: (updates: Partial<Checklist>) => void;
    onSave?: () => void;
    readOnly?: boolean;
}

export const GeneralInfoSection: React.FC<GeneralInfoSectionProps> = ({
    checklist,
    onUpdate,
    onSave,
    readOnly
}) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const scheduleSave = useCallback(() => {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
            onSave?.();
        }, 2000);
    }, [onSave]);

    const handleChange = (updates: Partial<Checklist>) => {
        onUpdate(updates);
        scheduleSave();
    };

    return (
        <div className={styles['general-info']}>
            {/* Header */}
            <button
                className={styles['general-info-header']}
                onClick={() => setIsExpanded(prev => !prev)}
                type="button"
                aria-expanded={isExpanded}
            >
                <span className={styles['general-info-chevron']}>
                    {isExpanded ? '▾' : '▸'}
                </span>
                <span className={styles['general-info-title']}>Job Information</span>
            </button>

            {isExpanded && (
                <div className={styles['general-info-body']}>
                    <div className={styles['general-info-grid']}>

                        {/* Hard Submission Deadline */}
                        <div className={styles['general-info-field']}>
                            <Toggle
                                label="Hard Submission Deadline"
                                checked={checklist.hardDeadline ?? false}
                                disabled={readOnly}
                                onChange={(_, checked) => handleChange({ hardDeadline: checked })}
                                inlineLabel
                            />
                            {checklist.hardDeadline && (
                                <div className={styles['general-info-sub-field']}>
                                    <label className={styles['general-info-label']}>Submission Date</label>
                                    <input
                                        type="date"
                                        className={styles['general-info-date-input']}
                                        disabled={readOnly}
                                        value={checklist.hardDeadlineDate
                                            ? checklist.hardDeadlineDate.toISOString().split('T')[0]
                                            : ''
                                        }
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            handleChange({ hardDeadlineDate: val ? new Date(val) : null });
                                        }}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Builder Supplied Quotes */}
                        <div className={styles['general-info-field']}>
                            <Toggle
                                label="Builder Supplied Quotes"
                                checked={checklist.builderSuppliedQuotes ?? false}
                                disabled={readOnly}
                                onChange={(_, checked) => handleChange({ builderSuppliedQuotes: checked })}
                                inlineLabel
                            />
                        </div>

                        {/* Contract Type */}
                        <div className={styles['general-info-field']}>
                            <label className={styles['general-info-label']}>Contract Type</label>
                            <select
                                className={styles['general-info-select']}
                                disabled={readOnly}
                                value={checklist.contractType ?? 'standard'}
                                onChange={(e) => {
                                    const val = e.target.value as 'standard' | 'cost-plus';
                                    handleChange({ contractType: val });
                                }}
                            >
                                <option value="standard">Standard</option>
                                <option value="cost-plus">Cost Plus</option>
                            </select>
                        </div>

                        {/* Build Stages */}
                        <div className={styles['general-info-field']}>
                            <Toggle
                                label="Build Stages"
                                checked={checklist.buildStages ?? false}
                                disabled={readOnly}
                                onChange={(_, checked) => handleChange({ buildStages: checked })}
                                inlineLabel
                            />
                            {checklist.buildStages && (
                                <div className={styles['general-info-sub-field']}>
                                    <label className={styles['general-info-label']}>Build Stages Notes</label>
                                    <textarea
                                        className={styles['general-info-textarea']}
                                        disabled={readOnly}
                                        placeholder="Describe the build stages..."
                                        rows={3}
                                        value={checklist.buildStagesNotes ?? ''}
                                        onChange={(e) => handleChange({ buildStagesNotes: e.target.value })}
                                        onBlur={() => onSave?.()}
                                    />
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
};
