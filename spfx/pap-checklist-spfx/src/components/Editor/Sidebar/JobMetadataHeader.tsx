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

    const renderBoolean = (val?: boolean | null) => {
        if (val === null || val === undefined) return <span className={styles['job-metadata-value--empty']}>—</span>;
        return val
            ? <span className={styles['badge-yes']}>Yes</span>
            : <span className={styles['badge-no']}>No</span>;
    };

    const mapsHref = job.googleMapsLink
        || (job.jobName ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.jobName)}` : undefined);

    const reaHref = job.jobName
        ? `https://www.realestate.com.au/buy/property/search?keywords=${encodeURIComponent(job.jobName)}`
        : undefined;

    return (
        <div className={styles['job-metadata']}>
            <div className={styles['job-metadata-title']}>
                <Briefcase20Regular className={styles['job-metadata-title-icon']} />
                Job Details
            </div>

            {/* ── Read-only job fields ── */}
            <div className={styles['job-metadata-grid']}>
                {/* Builder */}
                <div className={styles['job-metadata-field']}>
                    <span className={styles['job-metadata-label']}>Builder</span>
                    <span className={job.builderName ? styles['job-metadata-value'] : `${styles['job-metadata-value']} ${styles['job-metadata-value--empty']}`}>
                        {job.builderName || '—'}
                    </span>
                </div>

                {/* Site Address */}
                <div className={styles['job-metadata-field']}>
                    <span className={styles['job-metadata-label']}>Site Address</span>
                    <span className={job.siteAddress ? styles['job-metadata-value'] : `${styles['job-metadata-value']} ${styles['job-metadata-value--empty']}`}>
                        {job.siteAddress || '—'}
                    </span>
                </div>

                {/* Due Date */}
                <div className={styles['job-metadata-field']}>
                    <span className={styles['job-metadata-label']}>Due Date</span>
                    <span className={job.dueDate ? styles['job-metadata-value'] : `${styles['job-metadata-value']} ${styles['job-metadata-value--empty']}`}>
                        {formatDate(job.dueDate) || '—'}
                    </span>
                </div>

                {/* Estimator */}
                <div className={styles['job-metadata-field']}>
                    <span className={styles['job-metadata-label']}>Estimator</span>
                    <span className={job.leadEstimator ? styles['job-metadata-value'] : `${styles['job-metadata-value']} ${styles['job-metadata-value--empty']}`}>
                        {job.leadEstimator || '—'}
                    </span>
                </div>

                {/* QBE */}
                <div className={styles['job-metadata-field']}>
                    <span className={styles['job-metadata-label']}>QBE</span>
                    <div className={styles['qbe-row']}>
                        {renderBoolean(job.qbeFlagged)}
                        {job.qbeFlagged && (
                            <div className={styles['qbe-range']}>
                                <span className={styles['qbe-range-label']}>Low</span>
                                <span className={styles['qbe-range-value']}>{formatCurrency(job.qbeLow)}</span>
                                <span className={styles['qbe-range-label']}>High</span>
                                <span className={styles['qbe-range-value']}>{formatCurrency(job.qbeHigh)}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* 3D */}
                <div className={styles['job-metadata-field']}>
                    <span className={styles['job-metadata-label']}>3D</span>
                    <span className={styles['job-metadata-value']}>
                        {renderBoolean(job.threeDModel)}
                    </span>
                </div>

                {/* View Property — replaces Procurement */}
                {(mapsHref || reaHref) && (
                    <div className={`${styles['job-metadata-field']} ${styles['job-metadata-field--span']}`}>
                        <span className={styles['job-metadata-label']}>View Property</span>
                        <div className={styles['job-metadata-links']}>
                            {mapsHref && (
                                <a
                                    className={styles['job-metadata-text-link']}
                                    href={mapsHref}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <Location20Regular className={styles['job-metadata-text-link-icon']} />
                                    Google Maps
                                </a>
                            )}
                            {reaHref && (
                                <a
                                    className={styles['job-metadata-text-link']}
                                    href={reaHref}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <Home20Regular className={styles['job-metadata-text-link-icon']} />
                                    realestate.com.au
                                </a>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Editable checklist fields ── */}
            <div className={styles['job-metadata-divider']} />
            <div className={styles['job-metadata-grid']}>

                {/* Hard Submission Deadline */}
                <div className={styles['job-metadata-field']}>
                    <span className={styles['job-metadata-label']}>Hard Submission Deadline</span>
                    <div className={styles['job-metadata-control-row']}>
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

                {/* Builder Supplied Quotes */}
                <div className={styles['job-metadata-field']}>
                    <span className={styles['job-metadata-label']}>Builder Supplied Quotes</span>
                    <div className={styles['job-metadata-control-row']}>
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

                {/* Contract Type */}
                <div className={styles['job-metadata-field']}>
                    <span className={styles['job-metadata-label']}>Contract Type</span>
                    <select
                        className={styles['jm-select']}
                        value={checklist.contractType ?? 'standard'}
                        onChange={(e) => handleChange({ contractType: e.target.value as 'standard' | 'cost-plus' })}
                    >
                        <option value="standard">Standard</option>
                        <option value="cost-plus">Cost Plus</option>
                    </select>
                </div>

                {/* Build Stages */}
                <div className={`${styles['job-metadata-field']} ${checklist.buildStages ? styles['job-metadata-field--wide'] : ''}`}>
                    <span className={styles['job-metadata-label']}>Build Stages</span>
                    <div className={styles['job-metadata-control-row']}>
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
