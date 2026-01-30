import React, { useRef } from 'react';
import { Button } from '@fluentui/react-components';
import { Attach24Regular, Delete24Regular, Document24Regular } from '@fluentui/react-icons';
import { Checklist, ChecklistFile, generateId } from '../../../models';
import { useUserStore } from '../../../stores';
import styles from './ChecklistFiles.module.scss';

interface ChecklistFilesProps {
    checklist: Checklist;
    onUpdate: (updates: Partial<Checklist>) => void;
    readOnly?: boolean;
}

export const ChecklistFiles: React.FC<ChecklistFilesProps> = ({ checklist, onUpdate, readOnly }) => {
    const user = useUserStore(state => state.user);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length || readOnly) return;

        const file = e.target.files[0];
        const newFile: ChecklistFile = {
            id: generateId(),
            name: file.name,
            size: file.size,
            type: file.type,
            url: URL.createObjectURL(file),
            uploadedBy: user?.name || 'Unknown',
            uploadedAt: new Date(),
        };

        const updatedFiles = [...(checklist.files || []), newFile];
        onUpdate({ files: updatedFiles });

        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleDelete = (id: string) => {
        if (readOnly) return;
        const updatedFiles = (checklist.files || []).filter(f => f.id !== id);
        onUpdate({ files: updatedFiles });
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

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
                            <span className={styles['files-item-name']} title={file.name}>{file.name}</span>
                            <span className={styles['files-item-meta']}>
                                {formatSize(file.size)} • {new Date(file.uploadedAt).toLocaleDateString()}
                            </span>
                        </div>
                        {!readOnly && (
                            <div className={styles['files-item-actions']}>
                                <Button
                                    icon={<Delete24Regular />}
                                    appearance="subtle"
                                    onClick={() => handleDelete(file.id)}
                                />
                            </div>
                        )}
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
                    <div className={styles['files-upload']} onClick={handleUploadClick}>
                        <Attach24Regular className={styles['files-upload-icon']} />
                        <span className={styles['files-upload-text']}>Click to Upload File</span>
                    </div>
                </>
            )}
        </div>
    );
};
