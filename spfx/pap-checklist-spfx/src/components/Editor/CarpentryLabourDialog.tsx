import React, { useState, useRef, useEffect } from 'react';
import {
    Dialog,
    DialogSurface,
    DialogTitle,
    DialogBody,
    DialogActions,
    DialogContent,
    Button,
    Textarea,
    Spinner,
    Label
} from '@fluentui/react-components';
import { Image24Regular, Delete24Regular, ArrowUpload24Regular } from '@fluentui/react-icons';
import { Checklist } from '../../models';
import { getImageService } from '../../services/serviceFactory';
import { useChecklistStore } from '../../stores';
import styles from './CarpentryLabourDialog.module.scss';

interface CarpentryLabourDialogProps {
    checklist: Checklist;
    onClose: () => void;
    readOnly?: boolean;
}

export const CarpentryLabourDialog: React.FC<CarpentryLabourDialogProps> = ({ checklist, onClose, readOnly }) => {
    const updateChecklist = useChecklistStore(state => state.updateChecklist);

    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(checklist.carpentryLabourImageUrl || null);
    const [description, setDescription] = useState(checklist.carpentryLabourDescription || '');

    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            if (readOnly) return;
            const items = e.clipboardData?.items;
            if (items) {
                for (let i = 0; i < items.length; i++) {
                    if (items[i].type.indexOf('image') !== -1) {
                        const pastedFile = items[i].getAsFile();
                        if (pastedFile) {
                            setFile(pastedFile);
                            setPreviewUrl(URL.createObjectURL(pastedFile));
                            break;
                        }
                    }
                }
            }
        };

        window.addEventListener('paste', handlePaste);

        return () => {
            window.removeEventListener('paste', handlePaste);
            if (file && previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    }, [file, previewUrl, readOnly]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            setPreviewUrl(URL.createObjectURL(selectedFile));
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            let uploadedUrl = checklist.carpentryLabourImageUrl;

            // Upload new file if selected
            if (file) {
                uploadedUrl = await getImageService().uploadCarpentryImage(checklist.id, file);
            }

            // If removed entirely
            if (!previewUrl && !file) {
                uploadedUrl = '';
            }

            // Save via store (which triggers Dataverse save)
            await updateChecklist(checklist.id, {
                carpentryLabourImageUrl: uploadedUrl,
                carpentryLabourDescription: description
            });

            onClose();
        } catch (error) {
            console.error('Failed to save carpentry labour data', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleRemoveImage = () => {
        setFile(null);
        setPreviewUrl(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <Dialog open={true} onOpenChange={(_, data) => !data.open && onClose()}>
            <DialogSurface>
                <DialogBody>
                    <DialogTitle>Carpentry Labour Cost Calculator</DialogTitle>
                    <DialogContent className={styles['dialog-content']}>
                        <div className={styles['image-section']}>
                            <Label weight="semibold" className={styles['field-label']}>Screenshot</Label>

                            {previewUrl ? (
                                <>
                                    <img src={previewUrl} alt="Carpentry Calculator" className={styles['image-preview']} />
                                    {!readOnly && (
                                        <div className={styles['image-actions']}>
                                            <Button
                                                className={styles['btn-action']}
                                                icon={<ArrowUpload24Regular />}
                                                onClick={() => fileInputRef.current?.click()}
                                            >
                                                Replace
                                            </Button>
                                            <Button
                                                className={styles['btn-action']}
                                                icon={<Delete24Regular />}
                                                appearance="subtle"
                                                onClick={handleRemoveImage}
                                            >
                                                Remove
                                            </Button>
                                        </div>
                                    )}
                                </>
                            ) : (
                                !readOnly && (
                                    <div
                                        className={styles['drop-zone']}
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <Image24Regular fontSize={32} />
                                        <p>Click to upload calculator screenshot</p>
                                    </div>
                                )
                            )}

                            <input
                                type="file"
                                ref={fileInputRef}
                                style={{ display: 'none' }}
                                accept="image/*"
                                onChange={handleFileChange}
                            />
                        </div>

                        <div className={styles['description-section']}>
                            <Label weight="semibold" className={styles['field-label']}>Description / Notes</Label>
                            <Textarea
                                className={styles['description-input']}
                                rows={4}
                                value={description}
                                onChange={(_, data) => setDescription(data.value)}
                                placeholder="Enter any specific notes..."
                                disabled={readOnly}
                            />
                        </div>
                    </DialogContent>
                    <DialogActions>
                        <Button className={styles['btn-secondary']} appearance="secondary" onClick={onClose} disabled={isSaving}>
                            {readOnly ? 'Close' : 'Cancel'}
                        </Button>
                        {!readOnly && (
                            <Button className={styles['btn-primary']} appearance="primary" onClick={handleSave} disabled={isSaving}>
                                {isSaving ? <Spinner size="tiny" /> : 'Save'}
                            </Button>
                        )}
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
};
