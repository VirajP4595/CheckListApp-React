import React, { useCallback, useRef } from 'react';
import { Briefcase20Regular, Location20Regular, Home20Regular } from '@fluentui/react-icons';
import type { Checklist } from '../../../models';
import styles from './JobMetadataHeader.module.scss';

interface JobMetadataHeaderProps {
    checklist: Checklist;
    onUpdate?: (updates: Partial<Checklist>) => void;
    onSave?: () => void;
}

export const JobMetadataHeader: React.FC<JobMetadataHeaderProps> = ({ checklist, onUpdate, onSave }) => {
    const job = checklist.jobDetails;
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const scheduleSave = useCallback(() => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => { onSave?.(); }, 2000);
    }, [onSave]);

    const handleChange = useCallback((updates: Partial<Checklist>) => {
        onUpdate?.(updates);
        scheduleSave();
    }, [onUpdate, scheduleSave]);

    if (!job) return null;

    const formatDate = (d?: Date) => {
        if (!d) return null;
        return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const formatCurrency = (val?: number | null) => {
        if (val === null || val === undefined) return '—';
        return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(val);
    };

    const mapsHref = job.googleMapsLink
        || (job.jobName ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.jobName)}` : undefined);

    const reaHref = job.jobName
        ? `https://www.realestate.com.au/buy/property/search?keywords=${encodeURIComponent(job.jobName)}`
        : undefined;

    return (
        <div className={styles['job-metadata']}>
            {/* ── Line 1: Title + Read-Only Fields (single inline row) ── */}
            <div className={styles['job-metadata-readonly-row']}>
                <span className={styles['job-metadata-title']}>
                    <Briefcase20Regular className={styles['job-metadata-title-icon']} />
                    Job Details
                </span>

                <div className={styles['job-metadata-inline-fields']}>
                    <span className={styles['inline-field']}>
                        <span className={styles['inline-label']}>Builder</span>
                        <span className={styles['inline-value']}>{job.builderName || '—'}</span>
                    </span>
                    <span className={styles['inline-sep']}>|</span>

                    <span className={styles['inline-field']}>
                        <span className={styles['inline-label']}>Site</span>
                        <span className={styles['inline-value']}>{job.siteAddress || '—'}</span>
                    </span>
                    <span className={styles['inline-sep']}>|</span>

                    <span className={styles['inline-field']}>
                        <span className={styles['inline-label']}>Due</span>
                        <span className={styles['inline-value']}>{formatDate(job.dueDate) || '—'}</span>
                    </span>
                    <span className={styles['inline-sep']}>|</span>

                    <span className={styles['inline-field']}>
                        <span className={styles['inline-label']}>Estimator</span>
                        <span className={styles['inline-value']}>{job.leadEstimator || '—'}</span>
                    </span>
                    <span className={styles['inline-sep']}>|</span>

                    <span className={styles['inline-field']}>
                        <span className={styles['inline-label']}>QBE</span>
                        <span className={styles['inline-value']}>
                            {job.qbeFlagged
                                ? <>{formatCurrency(job.qbeLow)} – {formatCurrency(job.qbeHigh)}</>
                                : (job.qbeFlagged === false ? 'No' : '—')}
                        </span>
                    </span>
                    <span className={styles['inline-sep']}>|</span>

                    <span className={styles['inline-field']}>
                        <span className={styles['inline-label']}>3D</span>
                        <span className={styles['inline-value']}>
                            {job.threeDModel === true ? 'Yes' : job.threeDModel === false ? 'No' : '—'}
                        </span>
                    </span>

                    {(mapsHref || reaHref) && (
                        <>
                            <span className={styles['inline-sep']}>|</span>
                            <span className={styles['inline-field']}>
                                {mapsHref && (
                                    <a className={styles['inline-link']} href={mapsHref} target="_blank" rel="noopener noreferrer">
                                        <Location20Regular className={styles['inline-link-icon']} />
                                        Maps
                                    </a>
                                )}
                                {reaHref && (
                                    <a className={styles['inline-link']} href={reaHref} target="_blank" rel="noopener noreferrer">
                                        <Home20Regular className={styles['inline-link-icon']} />
                                        REA
                                    </a>
                                )}
                            </span>
                        </>
                    )}
                </div>
            </div>

            {/* ── Line 2: Editable Fields (compact row) ── */}
            <div className={styles['job-metadata-editable-row']}>
                {/* Hard Submission Deadline */}
                <div className={styles['editable-field']}>
                    <span className={styles['editable-label']}>Hard Deadline</span>
                    <div className={styles['editable-control']}>
                        <label className={styles['toggle']}>
                            <input
                                type="checkbox"
                                checked={checklist.hardDeadline ?? false}
                                onChange={(e) => handleChange({ hardDeadline: e.target.checked })}
                            />
                            <span className={styles['toggle-track']} />
                        </label>
                        {checklist.hardDeadline && (
                            <input
                                type="date"
                                className={styles['jm-input']}
                                value={checklist.hardDeadlineDate
                                    ? checklist.hardDeadlineDate.toISOString().split('T')[0]
                                    : ''}
                                onChange={(e) => handleChange({ hardDeadlineDate: e.target.value ? new Date(e.target.value) : null })}
                            />
                        )}
                    </div>
                </div>

                <span className={styles['editable-sep']} />

                {/* Builder Supplied Quotes */}
                <div className={styles['editable-field']}>
                    <span className={styles['editable-label']}>Builder Quotes</span>
                    <div className={styles['editable-control']}>
                        <label className={styles['toggle']}>
                            <input
                                type="checkbox"
                                checked={checklist.builderSuppliedQuotes ?? false}
                                onChange={(e) => handleChange({ builderSuppliedQuotes: e.target.checked })}
                            />
                            <span className={styles['toggle-track']} />
                        </label>
                    </div>
                </div>

                <span className={styles['editable-sep']} />

                {/* Contract Type */}
                <div className={styles['editable-field']}>
                    <span className={styles['editable-label']}>Contract Type</span>
                    <select
                        className={styles['jm-select']}
                        value={checklist.contractType ?? 'standard'}
                        onChange={(e) => handleChange({ contractType: e.target.value as 'standard' | 'cost-plus' })}
                    >
                        <option value="standard">Standard</option>
                        <option value="cost-plus">Cost Plus</option>
                    </select>
                </div>

                <span className={styles['editable-sep']} />

                {/* Build Stages */}
                <div className={`${styles['editable-field']} ${checklist.buildStages ? styles['editable-field--grow'] : ''}`}>
                    <span className={styles['editable-label']}>Build Stages</span>
                    <div className={styles['editable-control']}>
                        <label className={styles['toggle']}>
                            <input
                                type="checkbox"
                                checked={checklist.buildStages ?? false}
                                onChange={(e) => handleChange({ buildStages: e.target.checked })}
                            />
                            <span className={styles['toggle-track']} />
                        </label>
                        {checklist.buildStages && (
                            <input
                                type="text"
                                className={`${styles['jm-input']} ${styles['jm-input--grow']}`}
                                placeholder="Describe build stages…"
                                value={checklist.buildStagesNotes ?? ''}
                                onChange={(e) => handleChange({ buildStagesNotes: e.target.value })}
                                onBlur={() => onSave?.()}
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
