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
} from '@fluentui/react-components';
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
    images: ChecklistImage[];
    onAddImage: (source: string) => void;
    onRemoveImage: (imageId: string) => void;
}

export const InlineImageArea: React.FC<InlineImageAreaProps> = ({
    images,
    onAddImage,
    onRemoveImage,
}) => {
    const styles = useStyles();
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

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);

        const file = e.dataTransfer.files[0];
        if (file) {
            handleFile(file);
        }
    }, [handleFile]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    }, []);

    const handleDragLeave = useCallback(() => {
        setIsDragOver(false);
    }, []);

    const handlePaste = useCallback((e: React.ClipboardEvent) => {
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
    }, [handleFile]);

    const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleFile(file);
        }
        // Reset input
        e.target.value = '';
    }, [handleFile]);

    const handleClick = () => {
        fileInputRef.current?.click();
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
                        {images.map(image => (
                            <div
                                key={image.id}
                                className={styles.imageWrapper}
                                onClick={(e) => handleImageClick(image, e)}
                            >
                                <img
                                    src={image.source}
                                    alt={image.caption || 'Attached image'}
                                    className={styles.image}
                                />
                                <Button
                                    className={styles.removeButton}
                                    appearance="subtle"
                                    size="small"
                                    icon={<Dismiss16Regular />}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onRemoveImage(image.id);
                                    }}
                                />
                            </div>
                        ))}
                    </div>
                )}

                <div
                    className={`${styles.dropzone} ${isDragOver ? styles.dropzoneActive : ''}`}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={handleClick}
                >
                    <Image20Regular />
                    <Text className={styles.dropzoneText}>
                        Drop image, paste, or click to upload
                    </Text>
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className={styles.hiddenInput}
                    onChange={handleFileSelect}
                    aria-label="Upload image"
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
