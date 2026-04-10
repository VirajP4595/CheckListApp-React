import React, { useState, useRef, useEffect } from 'react';
import {
    Dialog, DialogTrigger, DialogSurface, DialogBody, DialogTitle,
    DialogContent, DialogActions, Button, Input, Field, Spinner
} from '@fluentui/react-components';
import { Share24Regular, Send20Regular, Dismiss24Regular } from '@fluentui/react-icons';
import { getGraphEmailService } from '../../../services/serviceFactory';
import type { DailyActivityLog } from '../../../services/activityLogService';
import { ACTION_LABELS } from '../../../services/activityLogService';
import styles from './ShareActivityDialog.module.scss';

interface ShareActivityDialogProps {
    logs: DailyActivityLog[];
    checklistTitle: string;
}

function buildActivityHtml(logs: DailyActivityLog[]): string {
    let html = '<table style="width:100%;border-collapse:collapse;font-family:Segoe UI,sans-serif;font-size:13px;">';

    for (const day of logs) {
        if (day.entries.length === 0) continue;

        html += `<tr><td colspan="3" style="padding:12px 0 4px;font-weight:600;font-size:14px;border-bottom:2px solid #0466b0;color:#03518b;">${day.date}</td></tr>`;

        for (const entry of [...day.entries].reverse()) {
            const label = ACTION_LABELS[entry.action] || entry.action;
            html += `<tr>
                <td style="padding:4px 8px;color:#666;vertical-align:top;white-space:nowrap;">${entry.user}</td>
                <td style="padding:4px 8px;vertical-align:top;">${label}</td>
                <td style="padding:4px 8px;color:#888;vertical-align:top;">${entry.detail || ''}</td>
            </tr>`;
        }
    }

    html += '</table>';
    return html;
}

export const ShareActivityDialog: React.FC<ShareActivityDialogProps> = ({ logs, checklistTitle }) => {
    const [open, setOpen] = useState(false);
    const [email, setEmail] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const emailInputRef = useRef<HTMLInputElement>(null);

    // Focus the email input after the dialog finishes opening.
    // Using rAF so our focus call runs after Fluent UI's dialog focus-trap setup,
    // which otherwise steals focus from autoFocus and causes immediate blur on click.
    useEffect(() => {
        if (open) {
            const raf = requestAnimationFrame(() => {
                emailInputRef.current?.focus();
            });
            return () => cancelAnimationFrame(raf);
        }
    }, [open]);

    const handleSend = async () => {
        if (!email.trim()) return;

        setIsSending(true);
        setStatus('idle');

        try {
            const emailService = getGraphEmailService();
            await emailService.sendEmail({
                toRecipients: [email.trim()],
                subject: `Activity Log — ${checklistTitle}`,
                bodyHtml: `
                    <div style="font-family:Segoe UI,sans-serif;">
                        <h2 style="color:#03518b;margin-bottom:4px;">Activity Log</h2>
                        <p style="color:#666;margin-top:0;">${checklistTitle}</p>
                        <hr style="border:none;border-top:1px solid #ddd;margin:16px 0;" />
                        ${buildActivityHtml(logs)}
                    </div>
                `,
            });
            setStatus('success');
            setTimeout(() => {
                setOpen(false);
                setStatus('idle');
                setEmail('');
            }, 1500);
        } catch (err) {
            console.error('[ShareActivity] Send failed:', err);
            setStatus('error');
        } finally {
            setIsSending(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(_, data) => { setOpen(data.open); setStatus('idle'); }}>
            <DialogTrigger disableButtonEnhancement>
                <Button
                    className={styles['share-trigger-btn']}
                    appearance="subtle"
                    icon={<Share24Regular />}
                    size="small"
                >
                    Share
                </Button>
            </DialogTrigger>
            <DialogSurface className={styles['share-dialog']}>
                <DialogBody>
                    <DialogTitle
                        action={
                            <Button
                                appearance="subtle"
                                icon={<Dismiss24Regular />}
                                onClick={() => setOpen(false)}
                            />
                        }
                    >
                        Share Activity Log
                    </DialogTitle>
                    <DialogContent className={styles['share-content']}>
                        <p className={styles['share-description']}>
                            Send the activity log summary via email.
                        </p>
                        <Field label="Recipient Email" required>
                            <Input
                                className={styles['share-email-input']}
                                type="email"
                                appearance="filled-darker"
                                placeholder="Enter email address..."
                                value={email}
                                onChange={(_, data) => setEmail(data.value)}
                                disabled={isSending}
                                input={{ ref: emailInputRef }}
                            />
                        </Field>
                        {status === 'success' && (
                            <p className={styles['share-status-success']}>Email sent successfully!</p>
                        )}
                        {status === 'error' && (
                            <p className={styles['share-status-error']}>Failed to send email. Please try again.</p>
                        )}
                    </DialogContent>
                    <DialogActions>
                        <Button
                            appearance="primary"
                            icon={isSending ? <Spinner size="tiny" /> : <Send20Regular />}
                            onClick={handleSend}
                            disabled={isSending || !email.trim()}
                        >
                            {isSending ? 'Sending...' : 'Send Email'}
                        </Button>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
};
