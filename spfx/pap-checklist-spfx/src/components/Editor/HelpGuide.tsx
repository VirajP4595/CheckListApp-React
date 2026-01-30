import React from 'react';
import {
    Dialog,
    DialogTrigger,
    DialogSurface,
    DialogBody,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Divider,
} from '@fluentui/react-components';
import {
    Question24Regular,
    Dismiss24Regular,
    CheckboxChecked20Regular,
    TextBold20Regular,
    Lightbulb20Regular,
} from '@fluentui/react-icons';
import styles from './HelpGuide.module.scss';

interface HelpGuideProps {
    trigger?: React.ReactNode;
    triggerClassName?: string;
}

export const HelpGuide: React.FC<HelpGuideProps> = ({ trigger, triggerClassName }) => {
    return (
        <Dialog>
            <DialogTrigger disableButtonEnhancement>
                {(trigger || (
                    <Button
                        className={`${styles.trigger} ${triggerClassName || ''}`}
                        appearance="subtle"
                        icon={<Question24Regular />}
                    >
                        Help
                    </Button>
                )) as React.ReactElement}
            </DialogTrigger>
            <DialogSurface>
                <DialogBody>
                    <DialogTitle
                        action={
                            <DialogTrigger action="close">
                                <Button
                                    appearance="subtle"
                                    aria-label="close"
                                    icon={<Dismiss24Regular />}
                                />
                            </DialogTrigger>
                        }
                    >
                        Checklist Guide
                    </DialogTitle>
                    <DialogContent className={styles.content}>
                        <div className={styles.section}>
                            <div className={styles['section-title']}>
                                <CheckboxChecked20Regular />
                                Answer Guide
                            </div>
                            <div className={styles['key-item']}>
                                <div className={`${styles['key-dot']} ${styles['key-dot--yes']}`} />
                                <span className={styles['key-label']}>YES</span>
                                <span className={styles['key-desc']}>Item is complete / included</span>
                            </div>
                            <div className={styles['key-item']}>
                                <div className={`${styles['key-dot']} ${styles['key-dot--no']}`} />
                                <span className={styles['key-label']}>NO</span>
                                <span className={styles['key-desc']}>Item is not required / excluded</span>
                            </div>
                            <div className={styles['key-item']}>
                                <div className={`${styles['key-dot']} ${styles['key-dot--ps']}`} />
                                <span className={styles['key-label']}>PS</span>
                                <span className={styles['key-desc']}>Provisional Sum (Cost Estimate)</span>
                            </div>
                            <div className={styles['key-item']}>
                                <div className={`${styles['key-dot']} ${styles['key-dot--pc']}`} />
                                <span className={styles['key-label']}>PC</span>
                                <span className={styles['key-desc']}>Prime Cost (Material Selection)</span>
                            </div>
                            <div className={styles['key-item']}>
                                <div className={`${styles['key-dot']} ${styles['key-dot--sub']}`} />
                                <span className={styles['key-label']}>SUB</span>
                                <span className={styles['key-desc']}>Subject to Confirmation</span>
                            </div>
                            <div className={styles['key-item']}>
                                <div className={`${styles['key-dot']} ${styles['key-dot--ots']}`} />
                                <span className={styles['key-label']}>OTS</span>
                                <span className={styles['key-desc']}>On-Site (Verified on site)</span>
                            </div>
                            <div className={styles['key-item']}>
                                <div className={`${styles['key-dot']} ${styles['key-dot--none']}`} />
                                <span className={styles['key-label']}>None</span>
                                <span className={styles['key-desc']}>Item has not been answered yet</span>
                            </div>
                        </div>

                        <Divider style={{ marginBottom: '20px' }} />

                        <div className={styles.section}>
                            <div className={styles['section-title']}>
                                <TextBold20Regular />
                                Using the Editor
                            </div>
                            <div className={styles['usage-list']}>
                                <div className={styles['usage-item']}>
                                    • <strong>Rich Text Notes:</strong> Click on any row to expand it. You can add detailed notes with bolding, lists, and links.
                                </div>
                                <div className={styles['usage-item']}>
                                    • <strong>Files & Images:</strong> Expand a row to upload photos directly to that item. Or use the "Files" tab in Checklist Info for general documents.
                                </div>
                                <div className={styles['usage-item']}>
                                    • <strong>Checklist Info:</strong> Click the "Info" button in the header to access Project Chat, General Notes, and Revision History.
                                </div>
                                <div className={styles['usage-item']}>
                                    • <strong>Revisions:</strong> Create a snapshot of your progress at any time via the "Revisions" tab in Checklist Info.
                                </div>
                            </div>
                        </div>

                        <div className={styles.section}>
                            <div className={styles['section-title']}>
                                <Lightbulb20Regular />
                                Pro Tips
                            </div>
                            <div className={styles['usage-list']}>
                                <div className={styles['usage-item']}>
                                    • <strong>Filters:</strong> Use the filter bar to see only "No" answers or specific workgroups.
                                </div>
                                <div className={styles['usage-item']}>
                                    • <strong>Keyboard Nav:</strong> Use Tab to move between items and Space to select.
                                </div>
                            </div>
                        </div>

                        <div className={styles.note}>
                            Checklists are auto-saved as you work. Look for the "Saved" indicator in the top right.
                        </div>
                    </DialogContent>
                    <DialogActions className={styles['dialog-actions']}>
                        <DialogTrigger disableButtonEnhancement>
                            <Button appearance="secondary">Close</Button>
                        </DialogTrigger>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
};
