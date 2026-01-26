import { useState, useRef } from 'react';
import { mergeClasses, Button, ProgressBar, Text } from '@fluentui/react-components';
import { Checkmark12Filled, ArrowDownload24Regular, Dismiss24Regular } from '@fluentui/react-icons';
import { Checklist, ChecklistStatus } from '../../../models';
import { getPDFService, getImageService } from '../../../services';
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
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [pdfProgress, setPdfProgress] = useState(0);
    const [pdfStatus, setPdfStatus] = useState('');
    const abortControllerRef = useRef<AbortController | null>(null);

    const handleExportPDF = async () => {
        setIsGeneratingPdf(true);
        setPdfProgress(0);
        setPdfStatus('Initializing...');

        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        try {
            // 1. Get Source Element (The main list)
            const sourceElement = document.getElementById('checklist-print-content');
            if (!sourceElement) throw new Error('Could not find content to capture');

            // 2. Generate PDF Blob (Visual Mode)
            const pdfBlob = await getPDFService().generateChecklistPDF(checklist, {
                includeImages: true,
                signal: abortController.signal, sourceElement,
                onProgress: (status: string, progress: number) => {
                    setPdfStatus(status);
                    setPdfProgress(progress);
                }
            });

            // 3. Download Locally
            const url = window.URL.createObjectURL(pdfBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${checklist.title} - ${checklist.currentRevisionNumber}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            // 3. Upload to SharePoint (Background)
            // Filename: {title}-Rev{num}-{timestamp}.pdf
            setPdfStatus('Uploading to SharePoint...');
            const filename = `${checklist.title}-Rev${checklist.currentRevisionNumber}-${Date.now()}.pdf`.replace(/[^a-z0-9]/gi, '_');
            await getImageService().uploadPDFReport(checklist.id, filename, pdfBlob);

            setPdfStatus('Done!');
            setTimeout(() => {
                setIsGeneratingPdf(false);
                setPdfStatus('');
                setPdfProgress(0);
            }, 2000);

        } catch (err) {
            if ((err as Error).name === 'AbortError') {
                console.log('PDF Generation Aborted');
                setPdfStatus('Cancelled');
            } else {
                console.error('PDF Generation Failed', err);
                setPdfStatus('Failed');
                alert('Failed to generate PDF. Check console.');
            }
            setIsGeneratingPdf(false);
        } finally {
            abortControllerRef.current = null;
        }
    };

    const handleCancelPDF = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
    };

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
                    {!isGeneratingPdf ? (
                        <Button
                            icon={<ArrowDownload24Regular />}
                            onClick={handleExportPDF}
                        >
                            Export to PDF
                        </Button>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text size={200}>{pdfStatus}</Text>
                                <Button
                                    size="small"
                                    appearance="subtle"
                                    icon={<Dismiss24Regular />}
                                    onClick={handleCancelPDF}
                                    aria-label="Cancel"
                                />
                            </div>
                            <ProgressBar value={pdfProgress / 100} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

