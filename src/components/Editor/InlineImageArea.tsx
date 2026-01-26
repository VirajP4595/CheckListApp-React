import React, { useCallback, useRef, useState } from 'react';
import {
    makeStyles,
    shorthands,
    tokens,
    Button,
    Text,
    Dialog,
    DialogSurface,
    DialogBody,
    DialogTitle,
    DialogContent,
    DialogActions,
    Spinner as S_Spinner
} from '@fluentui/react-components';
import { useChecklistStore } from '../../stores';
import { Image20Regular, Dismiss16Regular, ArrowDownload24Regular, Dismiss24Regular } from '@fluentui/react-icons';
import type { ChecklistImage } from '../../models';

const useStyles = makeStyles({
    container: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalS,
        width: '100%',
    },
    dropzone: {
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacingHorizontalS,
        width: '100%',
        padding: tokens.spacingVerticalS,
        borderRadius: tokens.borderRadiusSmall,
        border: `1px dashed ${tokens.colorNeutralStroke2}`,
        backgroundColor: tokens.colorNeutralBackground2,
        transitionProperty: 'border-color, background-color',
        transitionDuration: '0.15s',
        transitionTimingFunction: 'ease',
        cursor: 'pointer',
    },
    dropzoneHover: {
        ...shorthands.borderColor('#0a6dbc'),
        backgroundColor: tokens.colorNeutralBackground3,
    },
    dropzoneActive: {
        ...shorthands.borderColor('#0a6dbc'),
        backgroundColor: tokens.colorBrandBackground2,
    },
    dropzoneText: {
        fontSize: tokens.fontSizeBase200,
        color: tokens.colorNeutralForeground3,
    },
    images: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: tokens.spacingHorizontalS,
    },
    imageWrapper: {
        position: 'relative',
        width: '120px',
        height: '90px',
        borderRadius: tokens.borderRadiusSmall,
        overflow: 'hidden',
        border: `1px solid ${tokens.colorNeutralStroke2}`,
        cursor: 'pointer',
        transitionProperty: 'transform, box-shadow',
        transitionDuration: '0.1s',
        transitionTimingFunction: 'ease',
    },
    imageWrapperHover: {
        transform: 'scale(1.02)',
        boxShadow: tokens.shadow8,
    },
    image: {
        width: '100%',
        height: '100%',
        objectFit: 'cover',
    },
    removeButton: {
        position: 'absolute',
        top: '4px',
        right: '4px',
        minWidth: 'auto',
        padding: '2px',
        backgroundColor: 'rgba(0,0,0,0.5)',
        ':hover': {
            backgroundColor: 'rgba(0,0,0,0.7)',
        },
    },
    hiddenInput: {
        display: 'none',
    },
    previewImage: {
        maxWidth: '100%',
        maxHeight: '70vh',
        objectFit: 'contain',
        borderRadius: tokens.borderRadiusSmall,
    },
    dialogContent: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: tokens.spacingVerticalM,
    },
});

interface InlineImageAreaProps {
    rowId: string;
    images: ChecklistImage[];
    onAddImage: (source: string) => void;
    onRemoveImage: (imageId: string) => void;
}

export const InlineImageArea: React.FC<InlineImageAreaProps> = ({
    rowId,
    images,
    onAddImage,
    onRemoveImage,
}) => {
    const styles = useStyles();
    const { processingItems } = useChecklistStore(); // Import store
    const isAdding = processingItems.includes(`img-add-${rowId}`);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [previewImage, setPreviewImage] = useState<ChecklistImage | null>(null);

    const handleFile = useCallback((file: File) => {
        if (!file.type.startsWith('image/')) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const result = e.target?.result as string;
            if (result) {
                onAddImage(result);
            }
        };
        reader.readAsDataURL(file);
    }, [onAddImage]);

    // ... (Hooks for drag/drop remain same)

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        if (isAdding) return; // Prevent drop while adding

        const file = e.dataTransfer.files[0];
        if (file) {
            handleFile(file);
        }
    }, [handleFile, isAdding]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        if (!isAdding) setIsDragOver(true);
    }, [isAdding]);

    const handleDragLeave = useCallback(() => {
        setIsDragOver(false);
    }, []);

    const handlePaste = useCallback((e: React.ClipboardEvent) => {
        if (isAdding) return;
        const items = e.clipboardData.items;
        for (const item of items) {
            if (item.type.startsWith('image/')) {
                const file = item.getAsFile();
                if (file) {
                    handleFile(file);
                }
                break;
            }
        }
    }, [handleFile, isAdding]);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleFile(file);
        }
        // Reset input
        e.target.value = '';
    }, [handleFile]);

    const handleClick = () => {
        if (!isAdding) fileInputRef.current?.click();
    };

    const handleImageClick = (image: ChecklistImage, e: React.MouseEvent) => {
        e.stopPropagation();
        setPreviewImage(image);
    };

    const handleDownload = () => {
        if (!previewImage) return;

        const link = document.createElement('a');
        link.href = previewImage.source;
        link.download = previewImage.caption || `image-${previewImage.id}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <>
            <div className={styles.container} onPaste={handlePaste}>
                {images.length > 0 && (
                    <div className={styles.images}>
                        {images.map(image => {
                            const isRemoving = processingItems.includes(`img-rm-${image.id}`);
                            return (
                                <div
                                    key={image.id}
                                    className={styles.imageWrapper}
                                    onClick={(e) => handleImageClick(image, e)}
                                    style={{ opacity: isRemoving ? 0.5 : 1, pointerEvents: isRemoving ? 'none' : 'auto' }}
                                >
                                    <img
                                        src={image.thumbnailUrl || image.source}
                                        alt={image.caption || 'Attached image'}
                                        className={styles.image}
                                    />
                                    <Button
                                        className={styles.removeButton}
                                        appearance="subtle"
                                        size="small"
                                        icon={isRemoving ? <S_Spinner size="extra-tiny" /> : <Dismiss16Regular />}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (!isRemoving) onRemoveImage(image.id);
                                        }}
                                        disabled={isRemoving}
                                    />
                                </div>
                            );
                        })}
                    </div>
                )}

                <div
                    className={`${styles.dropzone} ${isDragOver ? styles.dropzoneActive : ''}`}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={handleClick}
                    style={{ opacity: isAdding ? 0.7 : 1, cursor: isAdding ? 'wait' : 'pointer' }}
                >
                    {isAdding ? <S_Spinner size="tiny" /> : <Image20Regular />}
                    <Text className={styles.dropzoneText}>
                        {isAdding ? 'Adding image...' : 'Drop image, paste, or click to upload'}
                    </Text>
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className={styles.hiddenInput}
                    onChange={handleFileSelect}
                    aria-label="Upload image"
                    disabled={isAdding}
                />
            </div>

            {/* Image Preview Dialog */}
            <Dialog open={!!previewImage} onOpenChange={(_, data) => !data.open && setPreviewImage(null)}>
                <DialogSurface style={{ maxWidth: '90vw', maxHeight: '90vh' }}>
                    <DialogBody>
                        <DialogTitle>
                            Image Preview
                        </DialogTitle>
                        <DialogContent className={styles.dialogContent}>
                            {previewImage && (
                                <img
                                    src={previewImage.source}
                                    alt={previewImage.caption || 'Preview'}
                                    className={styles.previewImage}
                                />
                            )}
                        </DialogContent>
                        <DialogActions>
                            <Button
                                appearance="primary"
                                icon={<ArrowDownload24Regular />}
                                onClick={handleDownload}
                            >
                                Download
                            </Button>
                            <Button
                                appearance="secondary"
                                icon={<Dismiss24Regular />}
                                onClick={() => setPreviewImage(null)}
                            >
                                Close
                            </Button>
                        </DialogActions>
                    </DialogBody>
                </DialogSurface>
            </Dialog>
        </>
    );
};
