
import React, { useRef } from 'react';
import { Button, Spinner } from '@fluentui/react-components';
import { Attach24Regular, Delete24Regular, Document24Regular, ArrowDownload24Regular } from '@fluentui/react-icons';
import { Checklist } from '../../../models';
import { useChecklistStore } from '../../../stores';
import styles from './ChecklistFiles.module.scss';

interface ChecklistFilesProps {
    checklist: Checklist;
    onUpdate?: (updates: Partial<Checklist>) => void; // Optional now, we use store directly
    readOnly?: boolean;
}

export const ChecklistFiles: React.FC<ChecklistFilesProps> = ({ checklist, readOnly }) => {
    const { uploadFile, deleteFile, isSaving } = useChecklistStore();
    const [isUploading, setIsUploading] = React.useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleUploadClick = () => {
        if (!isSaving) fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length || readOnly) return;

        const file = e.target.files[0];
        setIsUploading(true);
        try {
            await uploadFile(file);
        } catch (e) {
            console.error(e);
        } finally {
            setIsUploading(false);
        }

        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleDelete = async (id: string) => {
        if (readOnly) return;
        if (confirm('Are you sure you want to delete this file?')) {
            await deleteFile(id);
        }
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    // Determine Loading Text
    const loadingText = isUploading ? 'Uploading...' : 'Processing...';

    return (
        <div className={styles['files-container']}>
            <div className={styles['files-list']}>
                {(checklist.files || []).length === 0 && (
                    <div className={styles['files-empty']}>
                        <Document24Regular />
                        <span>No files attached.</span>
                    </div>
                )}
                {(checklist.files || []).map(file => (
                    <div key={file.id} className={styles['files-item']}>
                        <div className={styles['files-item-icon']}>
                            <Document24Regular />
                        </div>
                        <div className={styles['files-item-info']}>
                            <a
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles['files-item-name']}
                                title={file.name}
                            >
                                {file.name}
                            </a>
                            <div className={styles['files-item-meta']}>
                                {formatSize(file.size)} • {new Date(file.uploadedAt).toLocaleDateString()}
                            </div>
                        </div>
                        <div className={styles['files-item-actions']}>
                            <a
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ textDecoration: 'none', color: 'inherit', display: 'flex' }}
                                title="Download"
                            >
                                <Button
                                    icon={<ArrowDownload24Regular />}
                                    appearance="subtle"
                                />
                            </a>
                            {!readOnly && (
                                <Button
                                    icon={<Delete24Regular />}
                                    appearance="subtle"
                                    onClick={() => handleDelete(file.id)}
                                    title="Delete"
                                    disabled={isSaving} // Disable delete while any save is happening
                                />
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {!readOnly && (
                <>
                    <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        onChange={handleFileChange}
                        aria-label="Upload file"
                    />
                    <div
                        className={`${styles['files-upload']} ${isSaving ? styles['files-upload--disabled'] : ''}`}
                        onClick={handleUploadClick}
                    >
                        {isSaving ? <Spinner size="small" /> : <Attach24Regular className={styles['files-upload-icon']} />}
                        <span className={styles['files-upload-text']}>
                            {isSaving ? loadingText : 'Click to Upload File'}
                        </span>
                    </div>
                </>
            )}
        </div>
    );
};
