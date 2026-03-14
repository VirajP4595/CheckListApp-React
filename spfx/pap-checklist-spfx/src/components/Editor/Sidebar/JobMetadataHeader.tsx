import React from 'react';
import { Briefcase20Regular } from '@fluentui/react-icons';
import type { Checklist } from '../../../models';
import styles from './JobMetadataHeader.module.scss';

interface JobMetadataHeaderProps {
    checklist: Checklist;
}

/**
 * Displays key job metadata fields pulled from the Dataverse job record.
 * Renders as a compact card above Common Notes in the editor.
 *
 * TEMP: Some Dataverse column names are placeholders pending client confirmation.
 */
export const JobMetadataHeader: React.FC<JobMetadataHeaderProps> = ({ checklist }) => {
    const job = checklist.jobDetails;

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

    return (
        <div className={styles['job-metadata']}>
            <div className={styles['job-metadata-title']}>
                <Briefcase20Regular className={styles['job-metadata-title-icon']} />
                Job Details
            </div>
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
                    <span className={styles['job-metadata-value']}>
                        {renderBoolean(job.qbeFlagged)}
                    </span>
                    {job.qbeFlagged && (job.qbeLow !== null || job.qbeHigh !== null) && (
                        <div className={styles['qbe-range']}>
                            <span className={styles['qbe-range-label']}>Low</span>
                            <span className={styles['qbe-range-value']}>{formatCurrency(job.qbeLow)}</span>
                            <span className={styles['qbe-range-label']}>High</span>
                            <span className={styles['qbe-range-value']}>{formatCurrency(job.qbeHigh)}</span>
                        </div>
                    )}
                </div>

                {/* 3D */}
                <div className={styles['job-metadata-field']}>
                    <span className={styles['job-metadata-label']}>3D</span>
                    <span className={styles['job-metadata-value']}>
                        {renderBoolean(job.threeDModel)}
                    </span>
                </div>

                {/* Procurement — ON HOLD */}
                <div className={styles['job-metadata-field']}>
                    <span className={styles['job-metadata-label']}>Procurement</span>
                    <span className={styles['job-metadata-value--on-hold']}>
                        On hold
                    </span>
                </div>
            </div>
        </div>
    );
};
