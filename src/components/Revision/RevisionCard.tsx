import React from 'react';
import {
    makeStyles,
    tokens,
    Card,
    Badge,
    Text,
    Caption1,
} from '@fluentui/react-components';
import type { Revision } from '../../models';

const useStyles = makeStyles({
    card: {
        cursor: 'pointer',
        padding: tokens.spacingVerticalM,
        transition: 'background-color 0.15s ease',
        ':hover': {
            backgroundColor: tokens.colorNeutralBackground3,
        },
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalS,
        marginBottom: tokens.spacingVerticalXS,
    },
    badge: {
        fontFamily: 'monospace',
        fontWeight: tokens.fontWeightBold,
    },
    summary: {
        marginBottom: tokens.spacingVerticalXS,
    },
    meta: {
        color: tokens.colorNeutralForeground3,
    },
});

interface RevisionCardProps {
    revision: Revision;
    onClick: () => void;
}

export const RevisionCard: React.FC<RevisionCardProps> = ({ revision, onClick }) => {
    const styles = useStyles();

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
        <Card className={styles.card} onClick={onClick}>
            <div className={styles.header}>
                <Badge className={styles.badge} appearance="outline" color="informative">
                    REV {revision.number}
                </Badge>
            </div>
            <Text className={styles.summary}>{revision.summary}</Text>
            <Caption1 className={styles.meta}>
                {formatDate(revision.createdAt)} • {revision.createdBy}
            </Caption1>
        </Card>
    );
};
