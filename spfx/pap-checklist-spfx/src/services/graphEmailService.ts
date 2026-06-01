import { MSGraphClientV3 } from '@microsoft/sp-http';
import { WebPartContext } from '@microsoft/sp-webpart-base';

export interface EmailAttachment {
    name: string;
    contentBytes: string; // Base64 string
    contentType: string;
}

export interface EmailMessagePayload {
    toRecipients: string[];
    subject: string;
    bodyHtml: string;
    attachments?: EmailAttachment[];
    /**
     * If set, email is sent via `/users/{senderMailbox}/sendMail` rather than `/me/sendMail`.
     * The signed-in user must have Send-As or Send-On-Behalf permission on this mailbox
     * (typically a shared mailbox like estimates@priceaplan.com.au).
     */
    senderMailbox?: string;
}

export class GraphEmailService {
    private client: MSGraphClientV3 | undefined;

    public async initialize(context: WebPartContext): Promise<void> {
        this.client = await context.msGraphClientFactory.getClient('3');
        console.log('[GraphEmailService] Initialized with SPFx Context');
    }

    private getClient(): MSGraphClientV3 {
        if (!this.client) throw new Error("GraphEmailService not initialized. Call initialize(context) first.");
        return this.client;
    }

    public async sendEmail(payload: EmailMessagePayload): Promise<void> {
        const client = this.getClient();

        const graphPayload: any = {
            message: {
                subject: payload.subject,
                body: {
                    contentType: "HTML",
                    content: payload.bodyHtml
                },
                toRecipients: payload.toRecipients.map(email => ({
                    emailAddress: { address: email }
                }))
            },
            saveToSentItems: true
        };

        if (payload.attachments && payload.attachments.length > 0) {
            graphPayload.message.attachments = payload.attachments.map(att => ({
                "@odata.type": "#microsoft.graph.fileAttachment",
                name: att.name,
                contentType: att.contentType,
                contentBytes: att.contentBytes
            }));
        }

        const endpoint = payload.senderMailbox
            ? `/users/${encodeURIComponent(payload.senderMailbox)}/sendMail`
            : '/me/sendMail';

        await client.api(endpoint).post(graphPayload);
    }
}
