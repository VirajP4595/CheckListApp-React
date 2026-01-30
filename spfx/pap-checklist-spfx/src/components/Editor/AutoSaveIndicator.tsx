import React from 'react';
import {
    makeStyles,
    tokens,
    Text,
    Spinner,
} from '@fluentui/react-components';
import { Checkmark16Regular } from '@fluentui/react-icons';

const useStyles = makeStyles({
    container: {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalXS,
        padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
        borderRadius: tokens.borderRadiusSmall,
        backgroundColor: tokens.colorNeutralBackground3,
        fontSize: tokens.fontSizeBase200,
        color: tokens.colorNeutralForeground3,
    },
    saved: {
        color: tokens.colorPaletteGreenForeground1,
    },
});

interface AutoSaveIndicatorProps {
    isSaving: boolean;
    lastSaved: Date | null;
}

export const AutoSaveIndicator: React.FC<AutoSaveIndicatorProps> = ({
    isSaving,
    lastSaved,
}) => {
    const styles = useStyles();

    if (isSaving) {
        return (
            <div className={styles.container}>
                <Spinner size="tiny" />
                <Text size={200}>Saving...</Text>
            </div>
        );
    }

    if (lastSaved) {
        const timeAgo = getTimeAgo(lastSaved);
        return (
            <div className={`${styles.container} ${styles.saved}`}>
                <Checkmark16Regular />
                <Text size={200}>Saved {timeAgo}</Text>
            </div>
        );
    }

    return null;
};

function getTimeAgo(date: Date): string {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

    if (seconds < 5) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
}
