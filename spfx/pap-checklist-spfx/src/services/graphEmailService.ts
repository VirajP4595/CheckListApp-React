import { MSGraphClientV3 } from '@microsoft/sp-http';
import { WebPartContext } from '@microsoft/sp-webpart-base';

export interface EmailMessagePayload {
    toRecipients: string[];
    subject: string;
    bodyHtml: string;
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

        const graphPayload = {
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

        await client.api('/me/sendMail').post(graphPayload);
    }
}
