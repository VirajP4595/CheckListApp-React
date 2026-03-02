import React from 'react';
import {
    Dialog,
    DialogSurface,
    DialogBody,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    ProgressBar,
    Text
} from '@fluentui/react-components';
import { Delete24Regular } from '@fluentui/react-icons';
import styles from './DeleteProgressModal.module.scss';

interface DeleteProgressModalProps {
    open: boolean;
    onCancel: () => void;
    status: string;
    percent: number;
}

export const DeleteProgressModal: React.FC<DeleteProgressModalProps> = ({
    open,
    onCancel,
    status,
    percent
}) => {
    return (
        <Dialog open={open}>
            <DialogSurface className={styles.surface}>
                <DialogBody>
                    <div className={styles.header}>
                        <DialogTitle>Deleting Checklist</DialogTitle>
                    </div>

                    <DialogContent className={styles.content}>
                        <div className={styles.iconArea}>
                            <Delete24Regular className={styles.deleteIcon} />
                        </div>

                        <div className={styles.progressArea}>
                            <div className={styles.statusRow}>
                                <Text weight="semibold">{status}</Text>
                                <Text>{Math.round(percent)}%</Text>
                            </div>
                            <ProgressBar value={percent / 100} color="brand" />
                        </div>

                        {percent < 100 && (
                            <Text size={200} className={styles.hint}>
                                Permanently removing all associated checklist data...
                            </Text>
                        )}
                    </DialogContent>

                    <DialogActions>
                        <Button
                            className={styles['btn-cancel']}
                            appearance="subtle"
                            onClick={onCancel}
                            disabled={percent >= 100}
                        >
                            Cancel
                        </Button>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
};
