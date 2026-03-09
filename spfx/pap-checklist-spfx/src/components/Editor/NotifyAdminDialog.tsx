import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogSurface,
    DialogTitle,
    DialogBody,
    DialogActions,
    DialogContent,
    Button,
    Input,
    Textarea,
    Spinner,
    Label,
    MessageBar
} from '@fluentui/react-components';
import { Checklist, ChecklistRow } from '../../models';
import { getGraphEmailService } from '../../services/serviceFactory';
import { sharePointGroupService } from '../../services/sharePointGroupService';
import styles from './NotifyAdminDialog.module.scss';
import { useChecklistStore } from '../../stores';

interface NotifyAdminDialogProps {
    row: ChecklistRow;
    checklist: Checklist | null;
    onClose: () => void;
}

export const NotifyAdminDialog: React.FC<NotifyAdminDialogProps> = ({ row, checklist, onClose }) => {
    const updateRow = useChecklistStore(state => state.updateRow);
    const saveRow = useChecklistStore(state => state.saveRow);

    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [subject, setSubject] = useState('');
    const [additionalNotes, setAdditionalNotes] = useState('');

    useEffect(() => {
        if (checklist) {
            setSubject(`Admin Notification: ${checklist.jobDetails?.jobName || 'PAP Checklist'} - ${row.name || 'Item'}`);
        }
    }, [checklist, row.name]);

    const buildHtmlBody = () => {
        const jobName = checklist?.jobDetails?.jobName || 'Unknown Job';
        const clientName = checklist?.jobDetails?.clientName || 'Unknown Client';
        const address = checklist?.jobDetails?.siteAddress || '';
        const notesHtml = additionalNotes ? `<p><strong>Additional Notes:</strong><br/>${additionalNotes.replace(/\n/g, '<br/>')}</p>` : '';

        return `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px;">
                <h2 style="color: #0078D4;">Checklist Admin Notification</h2>
                <p>An item requires admin attention:</p>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd; background: #f3f2f1; font-weight: bold; width: 120px;">Job Name</td>
                        <td style="padding: 8px; border: 1px solid #ddd;">${jobName}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd; background: #f3f2f1; font-weight: bold;">Client</td>
                        <td style="padding: 8px; border: 1px solid #ddd;">${clientName}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd; background: #f3f2f1; font-weight: bold;">Address</td>
                        <td style="padding: 8px; border: 1px solid #ddd;">${address}</td>
                    </tr>
                </table>

                <h3 style="color: #323130; border-bottom: 1px solid #eaeaea; padding-bottom: 4px;">Item Details</h3>
                <p><strong>Name:</strong> ${row.name || 'Untitled'}</p>
                <p><strong>Status:</strong> ${row.answer || 'Unanswered'}</p>
                ${row.description ? `<p><strong>Description:</strong> ${row.description}</p>` : ''}
                ${row.notes ? `<div style="margin-top: 12px;"><strong>Notes:</strong><br/>${row.notes}</div>` : ''}
                
                <p style="margin-top: 30px; font-size: 12px; color: #888;">
                    This is an automated notification from the PAP Checklist App.
                </p>
            </div>
        `;
    };

    const handleSend = async () => {
        setIsSending(true);
        setError(null);
        try {
            // 1. Get recipients
            const emails = await sharePointGroupService.getGroupMemberEmails('SP_Checklist_SuperAdmin');
            if (!emails || emails.length === 0) {
                throw new Error("Could not find any members in the SP_Checklist_SuperAdmin group to notify. Ensure the group has members with valid emails.");
            }

            // 2. Send Email
            const htmlBody = buildHtmlBody();
            await getGraphEmailService().sendEmail({
                toRecipients: emails,
                subject: subject,
                bodyHtml: htmlBody
            });

            // 3. Email sent successfully, flag is already true from toggle
            onClose();
        } catch (err: any) {
            console.error('Failed to send admin notification', err);
            setError(err.message || "An error occurred while sending the email. (Does the App have Mail.Send permissions approved by admin?)");
        } finally {
            setIsSending(false);
        }
    };

    return (
        <Dialog open={true} onOpenChange={(_, data) => !data.open && onClose()}>
            <DialogSurface>
                <DialogBody>
                    <DialogTitle>Send Admin Notification</DialogTitle>
                    <DialogContent className={styles['dialog-content']}>
                        {error && (
                            <MessageBar intent="error">
                                {error}
                            </MessageBar>
                        )}

                        <div className={styles['full-width']}>
                            <Label weight="semibold" className={styles['field-label']}>Subject</Label>
                            <Input
                                className={styles['input-control']}
                                value={subject}
                                onChange={(_, data) => setSubject(data.value)}
                            />
                        </div>

                        <div className={styles['full-width']}>
                            <Label weight="semibold" className={styles['field-label']}>Additional Notes (Optional)</Label>
                            <Textarea
                                className={styles['input-control']}
                                rows={3}
                                placeholder="Add any extra context for the admin..."
                                value={additionalNotes}
                                onChange={(_, data) => setAdditionalNotes(data.value)}
                            />
                        </div>

                        <div className={styles['full-width']}>
                            <Label weight="semibold" className={styles['field-label']}>Email Preview</Label>
                            <div
                                className={styles['preview-html']}
                                dangerouslySetInnerHTML={{ __html: buildHtmlBody() }}
                            />
                        </div>

                    </DialogContent>
                    <DialogActions>
                        <Button className={styles['btn-secondary']} appearance="secondary" onClick={onClose} disabled={isSending}>
                            Cancel
                        </Button>
                        <Button className={styles['btn-primary']} appearance="primary" onClick={handleSend} disabled={isSending}>
                            {isSending ? <Spinner size="tiny" /> : 'Send Email'}
                        </Button>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
};
