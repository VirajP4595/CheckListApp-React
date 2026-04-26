import React, { useState } from 'react';
import { mergeClasses, Button, ProgressBar, Text, Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions, DialogTrigger } from '@fluentui/react-components';
import { Checkmark12Filled, ArrowDownload24Regular, Dismiss24Regular, Briefcase24Regular, Mail24Regular } from '@fluentui/react-icons';
import { Checklist, ChecklistStatus } from '../../../models';

import { usePdfExport } from '../../../hooks/usePdfExport';
import { useBtcExport } from '../../../hooks/useBtcExport';
import { useRfqExport } from '../../../hooks/useRfqExport';
import type { SupplierGroup, SendRfqSummary } from '../../../services/RfqExportService';
import styles from './ChecklistInfoPanel.module.scss';

interface ChecklistInfoPanelProps {
    checklist: Checklist;
    onUpdate: (updates: Partial<Checklist>, logMessage?: string) => void;
    readOnly?: boolean;
}

const STATUS_OPTIONS: { value: ChecklistStatus; label: string }[] = [
    { value: 'draft', label: 'Draft' },
    { value: 'in-review', label: 'In Review' },
    { value: 'in-revision', label: 'In Revision' },
    { value: 'final', label: 'Final' }
];
const CORRESPONDENCE_OPTIONS = ['Builder Copy', 'Client Copy', 'File Copy', 'Other'];

export const ChecklistInfoPanel: React.FC<ChecklistInfoPanelProps> = ({ checklist, onUpdate, readOnly }) => {
    const { exportPdf, loadingProgress: pdfProgress, cancelExport: cancelPdf } = usePdfExport();
    const { exportBtc, loadingProgress: btcProgress, cancelExport: cancelBtc } = useBtcExport();
    const { exportRfqCsv, previewRfqSend, sendRfqToSuppliers, loadingProgress: rfqProgress, cancelExport: cancelRfq } = useRfqExport();

    const [rfqPreview, setRfqPreview] = useState<null | {
        checklist: Checklist;
        groups: SupplierGroup[];
        skippedRowsNoEmail: number;
        totalRfqRows: number;
    }>(null);
    const [rfqPreviewLoading, setRfqPreviewLoading] = useState(false);
    const [rfqResult, setRfqResult] = useState<SendRfqSummary | null>(null);
    const [fallbackPrompt, setFallbackPrompt] = useState<{
        sharedMailbox: string;
        resolve: (consent: boolean) => void;
    } | null>(null);

    const handleExportPDF = async () => {
        await exportPdf(checklist);
    };

    const handleExportBTC = async () => {
        await exportBtc(checklist);
    };

    const handleOpenRfqSendDialog = async () => {
        setRfqPreviewLoading(true);
        setRfqResult(null);
        try {
            const { hydratedChecklist, groups, skippedRowsNoEmail, totalRfqRows } = await previewRfqSend(checklist);
            setRfqPreview({ checklist: hydratedChecklist, groups, skippedRowsNoEmail, totalRfqRows });
        } catch (err) {
            console.error('RFQ preview failed', err);
            alert((err as Error)?.message || 'Unable to prepare RFQ send.');
        } finally {
            setRfqPreviewLoading(false);
        }
    };

    const askFallbackConsent = (sharedMailbox: string): Promise<boolean> => {
        return new Promise<boolean>(resolve => {
            setFallbackPrompt({ sharedMailbox, resolve });
        });
    };

    const resolveFallback = (consent: boolean) => {
        fallbackPrompt?.resolve(consent);
        setFallbackPrompt(null);
    };

    const handleConfirmRfqSend = async () => {
        if (!rfqPreview) return;
        try {
            const summary = await sendRfqToSuppliers(rfqPreview.checklist, askFallbackConsent);
            setRfqResult(summary);
        } catch { /* error already shown via progress */ }
    };

    const closeRfqDialog = () => {
        setRfqPreview(null);
        setRfqResult(null);
    };

    const handleExportRFQ = async () => {
        await exportRfqCsv(checklist);
    };

    const handleStatusChange = (status: ChecklistStatus) => {
        if (readOnly) return;
        onUpdate({ status }, `Status changed to ${status}`);
    };

    const handleCorrespondenceChange = (option: string) => {
        if (readOnly) return;
        const current = checklist.clientCorrespondence || [];
        const isSelected = current.includes(option);
        const updated = isSelected
            ? current.filter(item => item !== option)
            : [...current, option];
        const action = isSelected ? 'Removed' : 'Added';
        onUpdate({ clientCorrespondence: updated }, `${action} Client Correspondence: ${option}`);
    };

    const isCorrespondenceSelected = (option: string) =>
        checklist.clientCorrespondence?.includes(option) || false;

    const job = checklist.jobDetails;

    const formatDate = (d?: Date) => {
        if (!d) return '—';
        return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const renderBoolean = (val?: boolean | null) => {
        if (val === null || val === undefined) return <span className={styles['job-info-value--empty']}>—</span>;
        return val
            ? <span className={styles['badge-yes']}>Yes</span>
            : <span className={styles['badge-no']}>No</span>;
    };

    const formatCurrency = (val?: number | null) => {
        if (val === null || val === undefined) return '—';
        return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(val);
    };

    return (
        <div className={styles['info-panel']}>
            {/* Job Details */}
            {job && (
                <div className={styles['info-section']}>
                    <span className={styles['info-section-title']}>
                        <Briefcase24Regular className={styles['section-icon']} />
                        Job Details
                    </span>
                    <div className={styles['job-info-list']}>
                        <div className={styles['job-info-item']}>
                            <span className={styles['job-info-label']}>Builder</span>
                            <span className={styles['job-info-value']}>{job.builderName || '—'}</span>
                        </div>
                        <div className={styles['job-info-item']}>
                            <span className={styles['job-info-label']}>Site Address</span>
                            <span className={styles['job-info-value']}>{job.siteAddress || '—'}</span>
                        </div>
                        <div className={styles['job-info-item']}>
                            <span className={styles['job-info-label']}>Due Date</span>
                            <span className={styles['job-info-value']}>{formatDate(job.dueDate)}</span>
                        </div>
                        <div className={styles['job-info-item']}>
                            <span className={styles['job-info-label']}>Estimator</span>
                            <span className={styles['job-info-value']}>{job.leadEstimator || '—'}</span>
                        </div>
                        <div className={styles['job-info-item']}>
                            <span className={styles['job-info-label']}>QBE</span>
                            <div className={styles['job-info-value-group']}>
                                {renderBoolean(job.qbeFlagged)}
                                {job.qbeFlagged && (job.qbeLow !== null || job.qbeHigh !== null) && (
                                    <div className={styles['qbe-range']}>
                                        <span>{formatCurrency(job.qbeLow)}</span>
                                        <span>-</span>
                                        <span>{formatCurrency(job.qbeHigh)}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className={styles['job-info-item']}>
                            <span className={styles['job-info-label']}>3D</span>
                            <span className={styles['job-info-value']}>{renderBoolean(job.threeDModel)}</span>
                        </div>
                        <div className={styles['job-info-item']}>
                            <span className={styles['job-info-label']}>Procurement</span>
                            <span className={styles['job-info-value--on-hold']}>On hold</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Status */}
            <div className={styles['info-section']}>
                <span className={styles['info-section-title']}>Status</span>
                <div className={styles['chip-group']}>
                    {STATUS_OPTIONS.map(option => {
                        const selected = checklist.status === option.value;
                        return (
                            <div
                                key={option.value}
                                className={mergeClasses(
                                    styles.chip,
                                    styles[`chip--${option.value}`],
                                    selected && styles['chip--selected'],
                                    readOnly && styles['chip--disabled']
                                )}
                                onClick={() => handleStatusChange(option.value)}
                                role="radio"
                                aria-checked={selected ? 'true' : 'false'}
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        handleStatusChange(option.value);
                                    }
                                }}
                            >
                                {selected && <Checkmark12Filled className={styles['chip-icon']} />}
                                {option.label}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Client Correspondence */}
            <div className={styles['info-section']}>
                <span className={styles['info-section-title']}>Client Correspondence</span>
                <div className={styles['chip-group']}>
                    {CORRESPONDENCE_OPTIONS.map(option => {
                        const selected = isCorrespondenceSelected(option);
                        return (
                            <div
                                key={option}
                                className={mergeClasses(
                                    styles.chip,
                                    selected && styles['chip--selected'],
                                    readOnly && styles['chip--disabled']
                                )}
                                onClick={() => handleCorrespondenceChange(option)}
                                role="checkbox"
                                aria-checked={selected ? 'true' : 'false'}
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        handleCorrespondenceChange(option);
                                    }
                                }}
                            >
                                {selected && <Checkmark12Filled className={styles['chip-icon']} />}
                                {option}
                            </div>
                        );
                    })}
                </div>
            </div>


            {/* Actions */}
            <div className={styles['info-section']}>
                <span className={styles['info-section-title']}>Actions</span>
                <div className={styles['action-group']}>
                    {!pdfProgress.open && !btcProgress.open && !rfqProgress.open ? (
                        <>
                            <Button
                                className={styles['export-btn']}
                                icon={<ArrowDownload24Regular />}
                                onClick={handleExportPDF}
                                disabled={readOnly}
                            >
                                Export to PDF
                            </Button>
                            <Button
                                className={styles['export-btn']}
                                icon={<Mail24Regular />}
                                onClick={handleExportBTC}
                                disabled={readOnly}
                            >
                                Email BTC Summary
                            </Button>
                            <Button
                                className={styles['export-btn']}
                                icon={<Mail24Regular />}
                                onClick={handleOpenRfqSendDialog}
                                disabled={readOnly || rfqPreviewLoading}
                            >
                                {rfqPreviewLoading ? 'Preparing…' : 'Send RFQ to Suppliers'}
                            </Button>
                            <Button
                                className={styles['export-btn']}
                                icon={<ArrowDownload24Regular />}
                                onClick={handleExportRFQ}
                                disabled={readOnly}
                            >
                                Export RFQ (CSV)
                            </Button>
                        </>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text size={200}>
                                    {pdfProgress.open ? pdfProgress.status : (btcProgress.open ? btcProgress.status : rfqProgress.status)}
                                </Text>
                                <Button
                                    size="small"
                                    appearance="subtle"
                                    icon={<Dismiss24Regular />}
                                    onClick={pdfProgress.open ? cancelPdf : (btcProgress.open ? cancelBtc : cancelRfq)}
                                    aria-label="Cancel"
                                />
                            </div>
                            <ProgressBar value={(pdfProgress.open ? pdfProgress.percent : (btcProgress.open ? btcProgress.percent : rfqProgress.percent)) / 100} />
                        </div>
                    )}
                </div>
            </div>

            <Dialog open={!!rfqPreview} onOpenChange={(_, d) => !d.open && closeRfqDialog()}>
                <DialogSurface>
                    <DialogBody>
                        <DialogTitle>Send RFQ to Suppliers</DialogTitle>
                        <DialogContent>
                            {!rfqResult && rfqPreview && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <Text>
                                        Ready to send <strong>{rfqPreview.groups.length}</strong> email{rfqPreview.groups.length === 1 ? '' : 's'} to <strong>{rfqPreview.groups.length}</strong> unique supplier{rfqPreview.groups.length === 1 ? '' : 's'}.
                                    </Text>
                                    {rfqPreview.skippedRowsNoEmail > 0 && (
                                        <Text style={{ color: '#b75d00' }}>
                                            ⚠ {rfqPreview.skippedRowsNoEmail} RFQ row{rfqPreview.skippedRowsNoEmail === 1 ? '' : 's'} will be skipped because supplier email is missing or invalid.
                                        </Text>
                                    )}
                                    {rfqPreview.groups.length > 0 && (
                                        <div>
                                            <Text weight="semibold" size={200}>Recipients:</Text>
                                            <ul style={{ margin: '4px 0 0 18px', padding: 0, fontSize: 13 }}>
                                                {rfqPreview.groups.map(g => (
                                                    <li key={g.email}>
                                                        {g.name ? <strong>{g.name}</strong> : <em>(no name)</em>} — {g.email} · {g.rows.length} item{g.rows.length === 1 ? '' : 's'}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    <Text size={200} style={{ color: '#555' }}>
                                        Each supplier will receive their own PDF with only the items assigned to them. Emails are sent from the shared mailbox.
                                    </Text>
                                </div>
                            )}
                            {rfqResult && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <Text>
                                        ✅ Sent {rfqResult.sent.length} email{rfqResult.sent.length === 1 ? '' : 's'}.
                                    </Text>
                                    {rfqResult.sentFromUserMailbox && (
                                        <Text size={200} style={{ color: '#b75d00' }}>
                                            ⚠ The shared mailbox refused the send. With your consent, emails were sent from your own mailbox — replies will come to you.
                                        </Text>
                                    )}
                                    {rfqResult.fallbackDeclined && (
                                        <Text size={200} style={{ color: '#b00020' }}>
                                            ✋ Send was cancelled because the shared mailbox is not available and you chose not to use your own mailbox.
                                        </Text>
                                    )}
                                    {rfqResult.failed.length > 0 && (
                                        <>
                                            <Text style={{ color: '#b00020' }}>
                                                ❌ {rfqResult.failed.length} failed:
                                            </Text>
                                            <ul style={{ margin: '0 0 0 18px', padding: 0, fontSize: 13 }}>
                                                {rfqResult.failed.map(f => (
                                                    <li key={f.email}>{f.email} — {f.error}</li>
                                                ))}
                                            </ul>
                                        </>
                                    )}
                                    {rfqResult.skippedRowsNoEmail > 0 && (
                                        <Text size={200} style={{ color: '#b75d00' }}>
                                            Skipped {rfqResult.skippedRowsNoEmail} row{rfqResult.skippedRowsNoEmail === 1 ? '' : 's'} without a valid supplier email.
                                        </Text>
                                    )}
                                </div>
                            )}
                        </DialogContent>
                        <DialogActions>
                            {!rfqResult ? (
                                <>
                                    <DialogTrigger disableButtonEnhancement>
                                        <Button appearance="secondary">Cancel</Button>
                                    </DialogTrigger>
                                    <Button
                                        appearance="primary"
                                        onClick={handleConfirmRfqSend}
                                        disabled={!rfqPreview || rfqPreview.groups.length === 0}
                                    >
                                        Send {rfqPreview?.groups.length ?? 0} email{(rfqPreview?.groups.length ?? 0) === 1 ? '' : 's'}
                                    </Button>
                                </>
                            ) : (
                                <Button appearance="primary" onClick={closeRfqDialog}>Close</Button>
                            )}
                        </DialogActions>
                    </DialogBody>
                </DialogSurface>
            </Dialog>

            {/* Permission fallback consent */}
            <Dialog open={!!fallbackPrompt} modalType="alert">
                <DialogSurface>
                    <DialogBody>
                        <DialogTitle>Send from your own mailbox?</DialogTitle>
                        <DialogContent>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <Text>
                                    You don&rsquo;t have permission to send on behalf of the shared mailbox
                                    {fallbackPrompt ? <> <strong>{fallbackPrompt.sharedMailbox}</strong></> : null}.
                                </Text>
                                <Text>
                                    Would you like to send the remaining RFQ emails from <strong>your own mailbox</strong> instead? Replies will come back to you, not the shared inbox.
                                </Text>
                            </div>
                        </DialogContent>
                        <DialogActions>
                            <Button appearance="secondary" onClick={() => resolveFallback(false)}>
                                No, cancel send
                            </Button>
                            <Button appearance="primary" onClick={() => resolveFallback(true)}>
                                Yes, send from my mailbox
                            </Button>
                        </DialogActions>
                    </DialogBody>
                </DialogSurface>
            </Dialog>
        </div>
    );
};

