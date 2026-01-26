import React, { useRef } from 'react';
import { Button, Text, Spinner } from '@fluentui/react-components';
import { ImageAdd24Regular, Delete24Regular } from '@fluentui/react-icons';
import { Checklist } from '../../../models';
import { useChecklistStore } from '../../../stores';
import styles from './BrandingPanel.module.scss';

interface BrandingPanelProps {
    checklist: Checklist;
}

export const BrandingPanel: React.FC<BrandingPanelProps> = ({ checklist }) => {
    const { uploadClientLogo, isSaving } = useChecklistStore();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            await uploadClientLogo(file);
            // Reset input
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // Note: Remove logo not yet implemented in store/service.
    // For now, allow overwrite.

    return (
        <div className={styles['branding-panel']}>
            <div className={styles.section}>
                <Text size={400} weight="semibold">Client Branding</Text>
                <Text size={300}>Upload a transparent PNG logo for the PDF report header.</Text>
            </div>

            <div className={`${styles['logo-preview-container']} ${checklist.clientLogoUrl ? styles['has-logo'] : ''}`}>
                {isSaving ? (
                    <Spinner label="Uploading..." />
                ) : checklist.clientLogoUrl ? (
                    <>
                        <img
                            src={checklist.clientLogoUrl}
                            alt="Client Logo"
                            className={styles['logo-image']}
                        />
                    </>
                ) : (
                    <div className={styles['no-logo-text']}>No Client Logo Uploaded</div>
                )}

                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/png,image/jpeg"
                    className={styles['upload-input']}
                />

                <div className={styles.actions}>
                    <Button
                        icon={<ImageAdd24Regular />}
                        onClick={handleUploadClick}
                        disabled={isSaving}
                    >
                        {checklist.clientLogoUrl ? 'Replace Logo' : 'Upload Logo'}
                    </Button>
                </div>
            </div>

            <div className={styles.section}>
                <Text size={300} italic>
                    Note: The logo will appear on the top-left of the exported PDF.
                    The top-right will show Job Details.
                </Text>
            </div>
        </div>
    );
};
