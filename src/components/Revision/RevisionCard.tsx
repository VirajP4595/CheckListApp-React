import React from 'react';

import type { Revision } from '../../models';
import styles from './RevisionPanel.module.scss';

interface RevisionCardProps {
    revision: Revision;
    onClick: () => void;
}

export const RevisionCard: React.FC<RevisionCardProps> = ({ revision, onClick }) => {

    const formatDate = (date: Date) => {
        return new Date(date).toLocaleDateString('en-AU', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <div className={styles['revision-card']} onClick={onClick}>
            <span className={styles['revision-number']}>
                REV {revision.number}
            </span>
            <div className={styles['revision-details']}>
                <div className={styles['revision-summary']}>{revision.summary}</div>
                <div className={styles['revision-meta']}>
                    {formatDate(revision.createdAt)} • {revision.createdBy || 'Unknown'}
                </div>
            </div>
        </div>
    );
};
