import React, { useState, useCallback } from 'react';
import { Button, Input, Textarea, Tooltip, Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions, DialogTrigger } from '@fluentui/react-components';
import { Add20Regular, Delete20Regular, Image20Regular, ArrowUp16Regular, ArrowDown16Regular, Dismiss16Regular } from '@fluentui/react-icons';
import type { ChecklistImage, RfqLineItem } from '../../models';
import styles from './RfqLineItemTable.module.scss';

interface Props {
    value: RfqLineItem[];
    images: ChecklistImage[];
    onChange: (items: RfqLineItem[]) => void;
    onBlurSave: () => void;
}

function newId(): string {
    return `rfq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const RfqLineItemTable: React.FC<Props> = ({ value, images, onChange, onBlurSave }) => {
    const items = value || [];
    const [pickerForItem, setPickerForItem] = useState<string | null>(null);

    const update = useCallback((id: string, patch: Partial<RfqLineItem>) => {
        onChange(items.map(i => i.id === id ? { ...i, ...patch } : i));
    }, [items, onChange]);

    const remove = useCallback((id: string) => {
        onChange(items.filter(i => i.id !== id));
        onBlurSave();
    }, [items, onChange, onBlurSave]);

    const move = useCallback((id: string, dir: -1 | 1) => {
        const idx = items.findIndex(i => i.id === id);
        if (idx < 0) return;
        const next = idx + dir;
        if (next < 0 || next >= items.length) return;
        const copy = items.slice();
        [copy[idx], copy[next]] = [copy[next], copy[idx]];
        onChange(copy);
        onBlurSave();
    }, [items, onChange, onBlurSave]);

    const add = useCallback(() => {
        const nextItemNo = String(items.length + 1);
        onChange([...items, { id: newId(), itemNo: nextItemNo, description: '', qty: '', unit: '', imageId: undefined }]);
        onBlurSave();
    }, [items, onChange, onBlurSave]);

    const pickImage = useCallback((itemId: string, imageId: string | undefined) => {
        update(itemId, { imageId });
        setPickerForItem(null);
        onBlurSave();
    }, [update, onBlurSave]);

    const getImage = (imageId?: string): ChecklistImage | undefined =>
        imageId ? images.find(img => img.id === imageId) : undefined;

    return (
        <div className={styles['rfq-table-wrapper']}>
            <div className={styles['rfq-table-header']}>
                <span className={styles['rfq-table-title']}>RFQ Line Items</span>
                <Button
                    size="small"
                    appearance="primary"
                    icon={<Add20Regular />}
                    onClick={add}
                >
                    Add line item
                </Button>
            </div>

            {items.length === 0 ? (
                <div className={styles['rfq-table-empty']}>
                    No line items yet. Click &ldquo;Add line item&rdquo; to build your quote table.
                </div>
            ) : (
                <div className={styles['rfq-table']} role="table" aria-label="RFQ line items">
                    <div className={`${styles['rfq-row']} ${styles['rfq-row--head']}`} role="row">
                        <div className={styles['c-itemno']}>Item No.</div>
                        <div className={styles['c-desc']}>Description</div>
                        <div className={styles['c-image']}>Image</div>
                        <div className={styles['c-qty']}>Qty</div>
                        <div className={styles['c-unit']}>Unit</div>
                        <div className={styles['c-actions']} aria-hidden />
                    </div>

                    {items.map((item, idx) => {
                        const bound = getImage(item.imageId);
                        return (
                            <div key={item.id} className={styles['rfq-row']} role="row">
                                <div className={styles['c-itemno']}>
                                    <Input
                                        appearance="filled-lighter"
                                        className={`${styles['cell-input']} ${styles['cell-input--center']}`}
                                        value={item.itemNo}
                                        onChange={(_, d) => update(item.id, { itemNo: d.value })}
                                        onBlur={onBlurSave}
                                        aria-label="Item number"
                                    />
                                </div>
                                <div className={styles['c-desc']}>
                                    <Textarea
                                        appearance="filled-lighter"
                                        className={`${styles['cell-input']} ${styles['cell-input--textarea']}`}
                                        value={item.description}
                                        onChange={(_, d) => update(item.id, { description: d.value })}
                                        onBlur={onBlurSave}
                                        rows={1}
                                        resize="vertical"
                                        aria-label="Description"
                                        placeholder="Supply & install of..."
                                    />
                                </div>
                                <div className={styles['c-image']}>
                                    {bound ? (
                                        <div className={styles['img-bound']}>
                                            <img
                                                src={bound.thumbnailUrl || bound.source}
                                                alt={bound.caption || 'Line item image'}
                                                className={styles['img-thumb']}
                                            />
                                            <Tooltip content="Remove image" relationship="label">
                                                <Button
                                                    size="small"
                                                    appearance="subtle"
                                                    icon={<Dismiss16Regular />}
                                                    onClick={() => pickImage(item.id, undefined)}
                                                    className={styles['img-remove']}
                                                />
                                            </Tooltip>
                                        </div>
                                    ) : (
                                        <Button
                                            appearance="subtle"
                                            icon={<Image20Regular />}
                                            onClick={() => setPickerForItem(item.id)}
                                            disabled={images.length === 0}
                                            className={styles['img-pick-btn']}
                                        >
                                            {images.length === 0 ? 'Upload image first' : 'Pick image'}
                                        </Button>
                                    )}
                                </div>
                                <div className={styles['c-qty']}>
                                    <Input
                                        appearance="filled-lighter"
                                        className={`${styles['cell-input']} ${styles['cell-input--center']}`}
                                        value={item.qty}
                                        onChange={(_, d) => update(item.id, { qty: d.value })}
                                        onBlur={onBlurSave}
                                        aria-label="Quantity"
                                    />
                                </div>
                                <div className={styles['c-unit']}>
                                    <Input
                                        appearance="filled-lighter"
                                        className={`${styles['cell-input']} ${styles['cell-input--center']}`}
                                        value={item.unit}
                                        onChange={(_, d) => update(item.id, { unit: d.value })}
                                        onBlur={onBlurSave}
                                        aria-label="Unit"
                                        placeholder="m2"
                                    />
                                </div>
                                <div className={styles['c-actions']}>
                                    <Tooltip content="Move up" relationship="label">
                                        <Button
                                            size="small"
                                            appearance="subtle"
                                            icon={<ArrowUp16Regular />}
                                            onClick={() => move(item.id, -1)}
                                            disabled={idx === 0}
                                        />
                                    </Tooltip>
                                    <Tooltip content="Move down" relationship="label">
                                        <Button
                                            size="small"
                                            appearance="subtle"
                                            icon={<ArrowDown16Regular />}
                                            onClick={() => move(item.id, 1)}
                                            disabled={idx === items.length - 1}
                                        />
                                    </Tooltip>
                                    <Tooltip content="Delete line" relationship="label">
                                        <Button
                                            size="small"
                                            appearance="subtle"
                                            icon={<Delete20Regular />}
                                            onClick={() => remove(item.id)}
                                        />
                                    </Tooltip>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <Dialog open={!!pickerForItem} onOpenChange={(_, d) => !d.open && setPickerForItem(null)}>
                <DialogSurface>
                    <DialogBody>
                        <DialogTitle>Select image for this line</DialogTitle>
                        <DialogContent>
                            {images.length === 0 ? (
                                <div>No images attached to this row yet. Upload images below the notes first.</div>
                            ) : (
                                <div className={styles['img-picker']}>
                                    {images.map(img => (
                                        <button
                                            type="button"
                                            key={img.id}
                                            className={styles['img-picker-tile']}
                                            onClick={() => pickerForItem && pickImage(pickerForItem, img.id)}
                                        >
                                            <img src={img.thumbnailUrl || img.source} alt={img.caption || 'Row image'} />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </DialogContent>
                        <DialogActions>
                            <DialogTrigger disableButtonEnhancement>
                                <Button appearance="secondary">Cancel</Button>
                            </DialogTrigger>
                        </DialogActions>
                    </DialogBody>
                </DialogSurface>
            </Dialog>
        </div>
    );
};
