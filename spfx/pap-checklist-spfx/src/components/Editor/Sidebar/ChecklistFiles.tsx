
import React, { useRef, useState } from 'react';
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
    const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleUploadClick = () => {
        if (!isSaving && !uploadProgress) fileInputRef.current?.click();
    };

    const uploadFiles = async (files: File[]) => {
        if (!files.length || readOnly) return;
        setUploadProgress({ current: 0, total: files.length });
        for (let i = 0; i < files.length; i++) {
            try {
                await uploadFile(files[i]);
            } catch (e) {
                console.error(`[ChecklistFiles] Failed to upload ${files[i].name}`, e);
            }
            setUploadProgress({ current: i + 1, total: files.length });
        }
        setUploadProgress(null);
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;
        const files = Array.from(e.target.files);
        if (fileInputRef.current) fileInputRef.current.value = '';
        await uploadFiles(files);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        if (readOnly || !e.dataTransfer.files.length) return;
        await uploadFiles(Array.from(e.dataTransfer.files));
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = () => setIsDragOver(false);

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

    const formatUploadDate = (date: Date) => {
        return new Date(date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const isBusy = isSaving || !!uploadProgress;

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
                                {formatSize(file.size)} • Uploaded {formatUploadDate(file.uploadedAt)}
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
                                    disabled={isBusy}
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
                        multiple
                        style={{ display: 'none' }}
                        onChange={handleFileChange}
                        aria-label="Upload files"
                    />
                    <div
                        className={`${styles['files-upload']} ${isBusy ? styles['files-upload--disabled'] : ''} ${isDragOver ? styles['files-upload--dragging'] : ''}`}
                        onClick={handleUploadClick}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                    >
                        {uploadProgress ? (
                            <>
                                <Spinner size="small" />
                                <span className={styles['files-upload-text']}>
                                    Uploading {uploadProgress.current} / {uploadProgress.total}…
                                </span>
                            </>
                        ) : isSaving ? (
                            <>
                                <Spinner size="small" />
                                <span className={styles['files-upload-text']}>Processing...</span>
                            </>
                        ) : (
                            <>
                                <Attach24Regular className={styles['files-upload-icon']} />
                                <span className={styles['files-upload-text']}>
                                    Click or drag files to upload
                                </span>
                            </>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};
