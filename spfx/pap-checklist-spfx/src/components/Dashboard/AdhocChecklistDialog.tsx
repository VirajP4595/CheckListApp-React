import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTrigger,
    DialogSurface,
    DialogTitle,
    DialogContent,
    DialogBody,
    DialogActions,
    Button,
    Input,
    Label,
    Spinner,
    Combobox,
    Option,
    Dropdown
} from '@fluentui/react-components';
import { Add24Regular } from '@fluentui/react-icons';
import { DataverseJobService, Job } from '../../services/dataverseJobService';
import { AppConfig } from '../../config/environment';
import styles from './AdhocChecklistDialog.module.scss';

export const AdhocChecklistDialog: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [isLoadingJobs, setIsLoadingJobs] = useState(false);

    const [selectedJobId, setSelectedJobId] = useState<string>('');
    const [checklistName, setChecklistName] = useState<string>('');
    const [selectedJobType, setSelectedJobType] = useState<string>('FQE');
    const [jobSearchQuery, setJobSearchQuery] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const jobService = new DataverseJobService();

    const loadJobs = async () => {
        setIsLoadingJobs(true);
        try {
            const fetchedJobs = await jobService.getAllJobs();
            setJobs(fetchedJobs);
        } catch (e) {
            console.error('Failed to load jobs', e);
            setError('Failed to load jobs for selection.');
        } finally {
            setIsLoadingJobs(false);
        }
    };

    useEffect(() => {
        if (isOpen && jobs.length === 0) {
            void loadJobs();
        }
    }, [isOpen]);

    const handleSubmit = async () => {
        if (!selectedJobId) {
            setError('Job is required.');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const flowUrl = AppConfig.powerAutomate.createChecklistFlowUrl;
            if (!flowUrl || flowUrl === 'YOUR_FLOW_URL_HERE') {
                throw new Error("Power Automate flow URL is not configured in environment.ts");
            }

            const response = await fetch(flowUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    jobId: selectedJobId,
                    checklistName: checklistName
                })
            });

            if (!response.ok) {
                throw new Error(`Flow execution failed: ${response.statusText}`);
            }

            // Success
            setIsOpen(false);
            setChecklistName('');
            setSelectedJobId('');
            setJobSearchQuery('');
            // Optional: Show success message or trigger checklist reload
            alert('Ad-hoc Checklist creation triggered successfully. It may take a moment to appear.');
        } catch (e: any) {
            console.error('Checklist creation failed', e);
            setError(e.message || 'Failed to trigger checklist creation flow.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(_, data) => setIsOpen(data.open)}>
            <DialogTrigger disableButtonEnhancement>
                <Button className={styles['adhoc-trigger-btn']} appearance="primary" icon={<Add24Regular />}>Create Ad-hoc Checklist</Button>
            </DialogTrigger>
            <DialogSurface>
                <DialogBody>
                    <DialogTitle>Create Ad-hoc Checklist</DialogTitle>
                    <DialogContent className={styles['dialog-content']}>
                        {error && <div className={styles['error-message']}>{error}</div>}

                        {/* Job Type Filter */}
                        <div className={styles['form-field']}>
                            <Label className={styles['form-label']} htmlFor="job-type-filter">Filter Job Type</Label>
                            <Dropdown
                                id="job-type-filter"
                                className={styles['dropdown-field']}
                                value={selectedJobType}
                                onOptionSelect={(_, data) => {
                                    setSelectedJobType(data.optionValue as string);
                                    setSelectedJobId('');
                                    setJobSearchQuery('');
                                }}
                            >
                                {/* Extract unique job types from available jobs, ensuring FQE is present */}
                                {Array.from(new Set(jobs.map(j => j.jobType).filter(Boolean).concat(['FQE']))).sort().map(jType => (
                                    <Option key={jType} value={jType} text={jType}>{jType}</Option>
                                ))}
                            </Dropdown>
                        </div>

                        {/* Job Search / Selection */}
                        <div className={styles['form-field']}>
                            <Label className={styles['form-label']} htmlFor="job-search" required>Select Job</Label>
                            {isLoadingJobs ? (
                                <Spinner size="tiny" label="Loading jobs..." />
                            ) : (
                                <Combobox
                                    id="job-search"
                                    className={styles['dropdown-field']}
                                    placeholder="Type to search..."
                                    onOptionSelect={(_, data) => setSelectedJobId(data.optionValue as string)}
                                    value={
                                        selectedJobId
                                            ? jobs.find(j => j.id === selectedJobId)?.name || ''
                                            : jobSearchQuery
                                    }
                                    onChange={(e) => {
                                        setJobSearchQuery(e.target.value);
                                        setSelectedJobId(''); // Reset selection if typing manually
                                    }}
                                >
                                    {jobs
                                        .filter(job => job.jobType === selectedJobType)
                                        .filter(job => job.name.toLowerCase().includes(jobSearchQuery.toLowerCase()) || (job.reference && job.reference.toLowerCase().includes(jobSearchQuery.toLowerCase())))
                                        .map(job => (
                                            <Option key={job.id} value={job.id} text={job.name}>
                                                {job.reference ? `${job.reference} - ${job.name}` : job.name}
                                            </Option>
                                        ))}
                                </Combobox>
                            )}
                        </div>

                        <div className={styles['form-field']}>
                            <Label className={styles['form-label']} htmlFor="checklist-name">Checklist Name (Optional)</Label>
                            <Input
                                id="checklist-name"
                                className={styles['input-field']}
                                value={checklistName}
                                onChange={(e) => setChecklistName(e.target.value)}
                                placeholder="Enter checklist name"
                            />
                        </div>
                    </DialogContent>
                    <DialogActions className={styles['dialog-actions']}>
                        <DialogTrigger disableButtonEnhancement>
                            <Button className={styles['btn-secondary']} appearance="secondary" disabled={isSubmitting}>Cancel</Button>
                        </DialogTrigger>
                        <Button
                            className={styles['btn-primary']}
                            appearance="primary"
                            onClick={handleSubmit}
                            disabled={isSubmitting || !selectedJobId}
                            icon={isSubmitting ? <Spinner size="tiny" /> : undefined}
                        >
                            {isSubmitting ? 'Creating...' : 'Create Checklist'}
                        </Button>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
};
