import React from 'react';
import { Caption1 } from '@fluentui/react-components';
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

    return (
        <article
            className={styles['checklist-card']}
            onClick={onClick}
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onClick()}
            role="button"
            aria-label={`Open ${checklist.title}`}
        >
            <div className={styles['checklist-card-header']}>
                <span className={styles['checklist-card-job-ref']}>{checklist.jobReference}</span>
                <h3 className={styles['checklist-card-title']}>{checklist.title}</h3>
            </div>

            <div className={styles['checklist-card-body']}>
                <div className={styles['checklist-card-meta']}>
                    <span className={`${styles['checklist-card-status']} ${getStatusClass()}`}>
                        {statusConfig.label}
                    </span>
                    <span className={styles['checklist-card-revision']}>
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
                <span className={styles['checklist-card-date']}>
                    Updated {formatDate(checklist.updatedAt)}
                </span>
                <span className={styles['checklist-card-estimator']}>
                    • {checklist.createdBy === 'user-001' ? 'John Smith' : checklist.createdBy}
                </span>
            </div>
        </article>
    );
};
