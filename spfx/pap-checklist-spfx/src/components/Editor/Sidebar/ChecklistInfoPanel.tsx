import React from 'react';
import { mergeClasses, Button, ProgressBar, Text } from '@fluentui/react-components';
import { Checkmark12Filled, ArrowDownload24Regular, Dismiss24Regular } from '@fluentui/react-icons';
import { Checklist, ChecklistStatus } from '../../../models';

import { usePdfExport } from '../../../hooks/usePdfExport';
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
    const { exportPdf, loadingProgress, cancelExport } = usePdfExport();

    const handleExportPDF = async () => {
        await exportPdf(checklist);
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

    return (
        <div className={styles['info-panel']}>
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
                    {!loadingProgress.open ? (
                        <Button
                            icon={<ArrowDownload24Regular />}
                            onClick={handleExportPDF}
                        >
                            Export to PDF
                        </Button>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text size={200}>{loadingProgress.status}</Text>
                                <Button
                                    size="small"
                                    appearance="subtle"
                                    icon={<Dismiss24Regular />}
                                    onClick={cancelExport}
                                    aria-label="Cancel"
                                />
                            </div>
                            <ProgressBar value={loadingProgress.percent / 100} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

