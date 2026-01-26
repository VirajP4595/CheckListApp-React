import React, { useEffect, useState } from 'react';
import {
    Dialog,
    DialogSurface,
    DialogBody,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    ProgressBar,
    Text,
    Spinner
} from '@fluentui/react-components';
import { Dismiss24Regular, DocumentPdf24Regular } from '@fluentui/react-icons';
import styles from './PdfGenerationProgressModal.module.scss';

interface PdfGenerationProgressModalProps {
    open: boolean;
    onCancel: () => void;
    status: string;         // e.g. "Processing image 5/20..."
    percent: number;        // 0-100
}

export const PdfGenerationProgressModal: React.FC<PdfGenerationProgressModalProps> = ({
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
                        <DialogTitle>Generating PDF Report</DialogTitle>
                        {/* We don't show close button, must either finish or cancel */}
                    </div>

                    <DialogContent className={styles.content}>
                        <div className={styles.iconArea}>
                            <DocumentPdf24Regular className={styles.pdfIcon} />
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
                                Large reports with many images may take a minute.
                            </Text>
                        )}
                    </DialogContent>

                    <DialogActions>
                        <Button
                            appearance="subtle"
                            onClick={onCancel}
                            disabled={percent >= 100} // Don't cancel if done (wait for auto-close or success)
                        >
                            Cancel
                        </Button>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
};
