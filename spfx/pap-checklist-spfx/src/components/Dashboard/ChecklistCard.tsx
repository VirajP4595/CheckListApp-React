import React from 'react';
import type { Checklist } from '../../models';
import { STATUS_CONFIG } from '../../models';
import styles from './Dashboard.module.scss';

interface ChecklistCardProps {
    checklist: Checklist;
    onClick: () => void;
}

export const ChecklistCard: React.FC<ChecklistCardProps> = ({ checklist, onClick }) => {
    const statusConfig = STATUS_CONFIG[checklist.status];

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleDateString('en-AU', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
        });
    };

    const getStatusClass = () => {
        switch (checklist.status) {
            case 'final':
                return styles['checklist-card-status--final'];
            case 'in-review':
                return styles['checklist-card-status--in-review'];
            default:
                return styles['checklist-card-status--draft'];
        }
    };

    const getCardStatusClass = () => {
        switch (checklist.status) {
            case 'final':
                return styles['checklist-card-status--final'];
            case 'in-review':
                return styles['checklist-card-status--in-review'];
            default:
                return styles['checklist-card-status--draft'];
        }
    };

    const getDueDateUrgency = (dueDate?: Date) => {
        if (!dueDate) return null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const due = new Date(dueDate);
        due.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return { label: `Overdue by ${Math.abs(diffDays)}d`, className: styles['due-overdue'] };
        if (diffDays <= 3) return { label: `Due in ${diffDays}d`, className: styles['due-urgent'] };
        return { label: formatDate(dueDate), className: styles['due-normal'] };
    };

    return (
        <article
            className={`${styles['checklist-card']} ${getCardStatusClass()}`}
            onClick={onClick}
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onClick()}
            role="button"
            aria-label={`Open ${checklist.title}`}
        >
            <div className={styles['checklist-card-header']}>
                <div className={styles['checklist-card-job-ref-row']}>
                    <span className={styles['checklist-card-job-ref']}>{checklist.jobReference}</span>
                    {checklist.jobDetails?.jobType && (
                        <span className={styles['job-type-badge']}>{checklist.jobDetails.jobType}</span>
                    )}
                </div>
                <h3 className={styles['checklist-card-title']}>{checklist.title}</h3>
            </div>

            <div className={styles['checklist-card-body']}>
                <div className={styles['checklist-card-meta']}>
                    <span className={`${styles['checklist-card-status']} ${getStatusClass()}`}>
                        {statusConfig.label}
                    </span>
                    <span className={`${styles['checklist-card-revision']} ${checklist.currentRevisionNumber > 0 ? styles['checklist-card-revision--active'] : ''}`}>
                        REV {checklist.currentRevisionNumber}
                    </span>
                </div>

                <div className={styles['checklist-card-details']}>
                    {checklist.jobDetails && (
                        <>
                            <div className={styles['checklist-card-detail-item']}>
                                <span className={styles['detail-label']}>Client:</span>
                                <span className={styles['detail-value']}>{checklist.jobDetails.clientName}</span>
                            </div>
                            <div className={styles['checklist-card-detail-item']}>
                                <span className={styles['detail-label']}>Job:</span>
                                <span className={styles['detail-value']}>
                                    {checklist.jobDetails.jobNumber ? `${checklist.jobDetails.jobNumber} - ` : ''}
                                    {checklist.jobDetails.jobName}
                                </span>
                            </div>
                        </>
                    )}
                    {checklist.estimateType?.length > 0 && (
                        <div className={styles['checklist-card-detail-item']}>
                            <span className={styles['detail-label']}>Type:</span>
                            <span className={styles['detail-value']}>{checklist.estimateType.join(', ')}</span>
                        </div>
                    )}
                    {checklist.clientCorrespondence?.length > 0 && (
                        <div className={styles['checklist-card-detail-item']}>
                            <span className={styles['detail-label']}>Correspondence:</span>
                            <span className={styles['detail-value']}>{checklist.clientCorrespondence.join(', ')}</span>
                        </div>
                    )}
                </div>
            </div>

            <div className={styles['checklist-card-footer']}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span className={styles['checklist-card-date']}>
                        Updated {formatDate(checklist.updatedAt)}
                    </span>
                    {(checklist.jobDetails?.leadEstimator || checklist.jobDetails?.reviewer) && (
                        <span className={styles['checklist-card-estimator']}>
                            {checklist.jobDetails?.leadEstimator ? `Lead: ${checklist.jobDetails.leadEstimator}` : ''}
                            {checklist.jobDetails?.leadEstimator && checklist.jobDetails?.reviewer ? ' | ' : ''}
                            {checklist.jobDetails?.reviewer ? `Rev: ${checklist.jobDetails.reviewer}` : ''}
                        </span>
                    )}
                </div>
                {getDueDateUrgency(checklist.jobDetails?.dueDate) && (() => {
                    const urgency = getDueDateUrgency(checklist.jobDetails?.dueDate)!;
                    return (
                        <span className={`${styles['checklist-card-due']} ${urgency.className}`}>
                            Due: {urgency.label}
                        </span>
                    );
                })()}
            </div>
        </article>
    );
};
