import React from 'react';
import { mergeClasses } from '@fluentui/react-components';
import { Checkmark12Filled } from '@fluentui/react-icons';
import { Checklist } from '../../models';
import styles from './ChecklistHeaderFields.module.scss';

interface ChecklistHeaderFieldsProps {
    checklist: Checklist;
    onUpdate: (updates: Partial<Checklist>) => void;
    readOnly?: boolean;
}

const CORRESPONDENCE_OPTIONS = ['Builder Copy', 'Client Copy', 'File Copy', 'Other'];
const ESTIMATE_TYPE_OPTIONS = ['FQE', 'Budget', 'Variation', 'Final Account'];

export const ChecklistHeaderFields: React.FC<ChecklistHeaderFieldsProps> = ({ checklist, onUpdate, readOnly }) => {
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
        <div className={styles['header-fields']}>
            <div className={styles['header-row']}>
                {/* Client Correspondence */}
                <div className={styles['header-section']}>
                    <span className={styles['header-label']}>Client Correspondence</span>
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
                                    {selected && <Checkmark12Filled className={styles['chip-check-icon']} />}
                                    {option}
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className={styles['header-divider']} />

                {/* Estimate Type */}
                <div className={styles['header-section']}>
                    <span className={styles['header-label']}>Estimate Type</span>
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
                                    {selected && <Checkmark12Filled className={styles['chip-check-icon']} />}
                                    {option}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};
