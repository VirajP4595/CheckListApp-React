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
    Alert20Regular,
    ShieldCheckmark20Regular,
    Filter20Regular,
    ArrowDownload20Regular,
    ArrowDownload24Regular,
    Mail20Regular,
    Flag20Regular,
    EyeOff20Regular
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
                        Checklist Application Guide
                    </DialogTitle>
                    <DialogContent className={styles.content}>
                        <div className={styles.section}>
                            <div className={styles['section-title']}>
                                <CheckboxChecked20Regular />
                                Answer Guide
                            </div>
                            <div className={styles['key-item']}>
                                <div className={`${styles['key-dot']} ${styles['key-dot--yes']}`} />
                                <span className={styles['key-label']}>Yes</span>
                                <span className={styles['key-desc']}>Included in scope</span>
                            </div>
                            <div className={styles['key-item']}>
                                <div className={`${styles['key-dot']} ${styles['key-dot--no']}`} />
                                <span className={styles['key-label']}>Noted as Excluded</span>
                                <span className={styles['key-desc']}>Noted as excluded from scope</span>
                            </div>
                            <div className={styles['key-item']}>
                                <div className={`${styles['key-dot']} ${styles['key-dot--none']}`} />
                                <span className={styles['key-label']}>Nothing Selected</span>
                                <span className={styles['key-desc']}>Intentionally unanswered</span>
                            </div>
                            <div className={styles['key-item']}>
                                <div className={`${styles['key-dot']} ${styles['key-dot--ps']}`} />
                                <span className={styles['key-label']}>PS</span>
                                <span className={styles['key-desc']}>Provisional Sum</span>
                            </div>
                            <div className={styles['key-item']}>
                                <div className={`${styles['key-dot']} ${styles['key-dot--pc']}`} />
                                <span className={styles['key-label']}>PC</span>
                                <span className={styles['key-desc']}>Prime Cost</span>
                            </div>
                            <div className={styles['key-item']}>
                                <div className={`${styles['key-dot']} ${styles['key-dot--sub']}`} />
                                <span className={styles['key-label']}>Subquote</span>
                                <span className={styles['key-desc']}>Subcontractor Quote</span>
                            </div>
                            <div className={styles['key-item']}>
                                <div className={`${styles['key-dot']} ${styles['key-dot--ots']}`} />
                                <span className={styles['key-label']}>OTS</span>
                                <span className={styles['key-desc']}>Owner to Supply</span>
                            </div>
                            <div className={styles['key-item']}>
                                <div className={`${styles['key-dot']} ${styles['key-dot--tbc']}`} />
                                <span className={styles['key-label']}>TBC</span>
                                <span className={styles['key-desc']}>To Be Confirmed</span>
                            </div>
                            <div className={styles['key-item']}>
                                <div className={`${styles['key-dot']} ${styles['key-dot--opt']}`} />
                                <span className={styles['key-label']}>Optional Extra</span>
                                <span className={styles['key-desc']}>Optional extra item</span>
                            </div>
                            <div className={styles['key-item']}>
                                <div className={`${styles['key-dot']} ${styles['key-dot--spec']}`} />
                                <span className={styles['key-label']}>Builder Spec</span>
                                <span className={styles['key-desc']}>Builder specification or standard</span>
                            </div>
                        </div>

                        <Divider style={{ marginBottom: '20px' }} />

                        <div className={styles.section}>
                            <div className={styles['section-title']}>
                                <Alert20Regular />
                                Row Actions & Flags
                            </div>
                            <div className={styles['usage-list']}>
                                <div className={styles['usage-item']}>
                                    • <Flag20Regular style={{ fontSize: '16px', verticalAlign: 'text-bottom' }} /> <strong>Review:</strong> Mark an item if you need to review it later or discuss it.
                                </div>
                                <div className={styles['usage-item']}>
                                    • <Alert20Regular style={{ fontSize: '16px', verticalAlign: 'text-bottom' }} /> <strong>Notify Admin:</strong> Flag this row to trigger a notification to the Estimator/Admin.
                                </div>
                                <div className={styles['usage-item']}>
                                    • <ShieldCheckmark20Regular style={{ fontSize: '16px', verticalAlign: 'text-bottom' }} /> <strong>Builder to Confirm (BTC):</strong> Tag items that require final builder approval. These can be exported as a summary.
                                </div>
                                <div className={styles['usage-item']}>
                                    • <EyeOff20Regular style={{ fontSize: '16px', verticalAlign: 'text-bottom' }} /> <strong>Internal Only:</strong> Mark notes/flags to stay internal (hidden from final client PDF).
                                </div>
                            </div>
                        </div>

                        <div className={styles.section}>
                            <div className={styles['section-title']}>
                                <Filter20Regular />
                                Workgroups & Filtering
                            </div>
                            <div className={styles['usage-list']}>
                                <div className={styles['usage-item']}>
                                    • <strong>Summary Counts:</strong> Each workgroup bar shows <strong>Ans</strong> (Answered) and <strong>Unans</strong> (Unanswered) counts for quick tracking.
                                </div>
                                <div className={styles['usage-item']}>
                                    • <strong>Row Status Filter:</strong> Use the multi-select dropdown in the filter bar to filter by Answer Type, Review, Notify Admin, BTC, or Internal Only flags.
                                </div>
                            </div>
                        </div>

                        <div className={styles.section}>
                            <div className={styles['section-title']}>
                                <ArrowDownload20Regular />
                                Exports & Tools
                            </div>
                            <div className={styles['usage-list']}>
                                <div className={styles['usage-item']}>
                                    • <ArrowDownload24Regular style={{ fontSize: '16px', verticalAlign: 'text-bottom' }} /> <strong>Export to PDF:</strong> Accessible via "Checklist Info" → Actions. Generates a full branded report.
                                </div>
                                <div className={styles['usage-item']}>
                                    • <Mail20Regular style={{ fontSize: '16px', verticalAlign: 'text-bottom' }} /> <strong>Email BTC Summary:</strong> Opens a new Outlook Web draft with all BTC-flagged items summarized for the builder.
                                </div>
                            </div>
                        </div>

                        <div className={styles.section}>
                            <div className={styles['section-title']}>
                                <Lightbulb20Regular />
                                General Usage
                            </div>
                            <div className={styles['usage-list']}>
                                <div className={styles['usage-item']}>
                                    • <strong>Rich Text Notes:</strong> Click any row to add details, bolding, or links.
                                </div>
                                <div className={styles['usage-item']}>
                                    • <strong>Photos:</strong> Expand a row to upload or paste screenshots directly.
                                </div>
                            </div>
                        </div>

                        <div className={styles.note}>
                            Checklists are auto-saved. The "Saved" indicator is in the top right.
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
