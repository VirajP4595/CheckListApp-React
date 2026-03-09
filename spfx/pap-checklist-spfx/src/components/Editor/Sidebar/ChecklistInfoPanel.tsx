import React from 'react';
import { mergeClasses, Button, ProgressBar, Text } from '@fluentui/react-components';
import { Checkmark12Filled, ArrowDownload24Regular, Dismiss24Regular, Briefcase24Regular, Mail24Regular } from '@fluentui/react-icons';
import { Checklist, ChecklistStatus } from '../../../models';

import { usePdfExport } from '../../../hooks/usePdfExport';
import { useBtcExport } from '../../../hooks/useBtcExport';
import styles from './ChecklistInfoPanel.module.scss';

interface ChecklistInfoPanelProps {
    checklist: Checklist;
    onUpdate: (updates: Partial<Checklist>, logMessage?: string) => void;
    readOnly?: boolean;
}

const STATUS_OPTIONS: { value: ChecklistStatus; label: string }[] = [
    { value: 'draft', label: 'Draft' },
    { value: 'in-review', label: 'In Review' },
    { value: 'final', label: 'Final' }
];
const CORRESPONDENCE_OPTIONS = ['Builder Copy', 'Client Copy', 'File Copy', 'Other'];
const ESTIMATE_TYPE_OPTIONS = ['FQE', 'Budget', 'Variation', 'Final Account'];

export const ChecklistInfoPanel: React.FC<ChecklistInfoPanelProps> = ({ checklist, onUpdate, readOnly }) => {
    const { exportPdf, loadingProgress: pdfProgress, cancelExport: cancelPdf } = usePdfExport();
    const { exportBtc, loadingProgress: btcProgress, cancelExport: cancelBtc } = useBtcExport();

    const handleExportPDF = async () => {
        await exportPdf(checklist);
    };

    const handleExportBTC = async () => {
        await exportBtc(checklist);
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

    const handleEstimateTypeChange = (option: string) => {
        if (readOnly) return;
        const current = checklist.estimateType || [];
        const isSelected = current.includes(option);
        const updated = isSelected
            ? current.filter(item => item !== option)
            : [...current, option];
        const action = isSelected ? 'Removed' : 'Added';
        onUpdate({ estimateType: updated }, `${action} Estimate Type: ${option}`);
    };

    const isCorrespondenceSelected = (option: string) =>
        checklist.clientCorrespondence?.includes(option) || false;

    const isEstimateTypeSelected = (option: string) =>
        checklist.estimateType?.includes(option) || false;

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
                            <span className={styles['job-info-label']}>Engineering</span>
                            <span className={styles['job-info-value']}>{renderBoolean(job.engineering)}</span>
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

            {/* Estimate Type */}
            <div className={styles['info-section']}>
                <span className={styles['info-section-title']}>Estimate Type</span>
                <div className={styles['chip-group']}>
                    {ESTIMATE_TYPE_OPTIONS.map(option => {
                        const selected = isEstimateTypeSelected(option);
                        return (
                            <div
                                key={option}
                                className={mergeClasses(
                                    styles.chip,
                                    selected && styles['chip--selected'],
                                    readOnly && styles['chip--disabled']
                                )}
                                onClick={() => handleEstimateTypeChange(option)}
                                role="checkbox"
                                aria-checked={selected ? 'true' : 'false'}
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        handleEstimateTypeChange(option);
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
                    {!pdfProgress.open && !btcProgress.open ? (
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
                                onClick={() => exportBtc(checklist)}
                                disabled={readOnly}
                            >
                                Email BTC Summary
                            </Button>
                        </>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text size={200}>
                                    {pdfProgress.open ? pdfProgress.status : btcProgress.status}
                                </Text>
                                <Button
                                    size="small"
                                    appearance="subtle"
                                    icon={<Dismiss24Regular />}
                                    onClick={pdfProgress.open ? cancelPdf : cancelBtc}
                                    aria-label="Cancel"
                                />
                            </div>
                            <ProgressBar value={(pdfProgress.open ? pdfProgress.percent : btcProgress.percent) / 100} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

