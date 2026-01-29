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
import { DocumentPdf24Regular, Eye24Regular } from '@fluentui/react-icons';
import styles from './PdfGenerationProgressModal.module.scss';

interface PdfGenerationProgressModalProps {
    open: boolean;
    onCancel: () => void;
    title?: string;         // e.g. "Generating PDF Report"
    iconType?: 'pdf' | 'preview';
    status: string;         // e.g. "Processing image 5/20..."
    percent: number;        // 0-100
}

export const PdfGenerationProgressModal: React.FC<PdfGenerationProgressModalProps> = ({
    open,
    onCancel,
    title = 'Generating PDF Report',
    iconType = 'pdf',
    status,
    percent
}) => {
    return (
        <Dialog open={open}>
            <DialogSurface className={styles.surface}>
                <DialogBody>
                    <div className={styles.header}>
                        <DialogTitle>{title}</DialogTitle>
                        {/* We don't show close button, must either finish or cancel */}
                    </div>

                    <DialogContent className={styles.content}>
                        <div className={styles.iconArea}>
                            {iconType === 'pdf' ? (
                                <DocumentPdf24Regular className={styles.pdfIcon} />
                            ) : (
                                <Eye24Regular className={styles.pdfIcon} />
                            )}
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
