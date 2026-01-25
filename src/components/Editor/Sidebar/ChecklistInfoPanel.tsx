import React from 'react';
import { mergeClasses } from '@fluentui/react-components';
import { Checkmark12Filled } from '@fluentui/react-icons';
import { Checklist, ChecklistStatus, STATUS_CONFIG } from '../../../models';
import styles from './ChecklistInfoPanel.module.scss';

interface ChecklistInfoPanelProps {
    checklist: Checklist;
    onUpdate: (updates: Partial<Checklist>) => void;
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
    const handleStatusChange = (status: ChecklistStatus) => {
        if (readOnly) return;
        onUpdate({ status });
    };

    const handleCorrespondenceChange = (option: string) => {
        if (readOnly) return;
        const current = checklist.clientCorrespondence || [];
        const isSelected = current.includes(option);
        const updated = isSelected
            ? current.filter(item => item !== option)
            : [...current, option];
        onUpdate({ clientCorrespondence: updated });
    };

    const handleEstimateTypeChange = (option: string) => {
        if (readOnly) return;
        const current = checklist.estimateType || [];
        const isSelected = current.includes(option);
        const updated = isSelected
            ? current.filter(item => item !== option)
            : [...current, option];
        onUpdate({ estimateType: updated });
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
                                aria-checked={selected}
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
                                aria-checked={selected}
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
                                aria-checked={selected}
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
        </div>
    );
};

