import { MSGraphClientV3 } from '@microsoft/sp-http';
import { WebPartContext } from '@microsoft/sp-webpart-base';

export interface OrgUser {
    id: string;
    displayName: string;
    mail: string;
    userPrincipalName: string;
    jobTitle?: string;
}

/**
 * Graph Chat Service
 *
 * Provides org-wide user search (People API + Users fallback)
 * and Teams chat message notifications for @mentions.
 */
export class GraphChatService {
    private client: MSGraphClientV3 | undefined;

    public async initialize(context: WebPartContext): Promise<void> {
        this.client = await context.msGraphClientFactory.getClient('3');
        console.log('[GraphChatService] Initialized');
    }

    private getClient(): MSGraphClientV3 {
        if (!this.client) throw new Error("GraphChatService not initialized.");
        return this.client;
    }

    /**
     * Search org users by name or email.
     * Uses /me/people first (most relevant), falls back to /users for broader search.
     * Returns up to 10 results.
     */
    public async searchUsers(query: string): Promise<OrgUser[]> {
        if (!query || query.length < 2) return [];
        const client = this.getClient();

        try {
            // Try People API first — returns contextually relevant users
            const peopleResponse = await client
                .api('/me/people')
                .filter(`startswith(displayName,'${this.escapeOData(query)}')`)
                .select('id,displayName,scoredEmailAddresses,jobTitle')
                .top(10)
                .get();

            if (peopleResponse?.value?.length > 0) {
                return peopleResponse.value
                    .filter((p: any) => p.displayName) // exclude empty
                    .map((p: any) => ({
                        id: p.id,
                        displayName: p.displayName,
                        mail: p.scoredEmailAddresses?.[0]?.address || '',
                        userPrincipalName: p.scoredEmailAddresses?.[0]?.address || '',
                        jobTitle: p.jobTitle,
                    }));
            }
        } catch (e) {
            console.warn('[GraphChatService] People API failed, trying /users', e);
        }

        // Fallback: directory search
        try {
            const usersResponse = await client
                .api('/users')
                .filter(`startswith(displayName,'${this.escapeOData(query)}') or startswith(mail,'${this.escapeOData(query)}')`)
                .select('id,displayName,mail,userPrincipalName,jobTitle')
                .top(10)
                .get();

            return (usersResponse?.value || []).map((u: any) => ({
                id: u.id,
                displayName: u.displayName,
                mail: u.mail || u.userPrincipalName,
                userPrincipalName: u.userPrincipalName,
                jobTitle: u.jobTitle,
            }));
        } catch (e) {
            console.warn('[GraphChatService] /users search failed', e);
            return [];
        }
    }

    /**
     * Send a Teams 1:1 chat message to a user via Graph API.
     * Creates a new chat (or finds existing) and sends the notification message.
     */
    public async sendTeamsChatNotification(
        recipientUserId: string,
        message: string
    ): Promise<void> {
        const client = this.getClient();

        try {
            // Get current user's ID
            const me = await client.api('/me').select('id').get();
            const myId = me.id;

            // Create or get existing 1:1 chat
            const chat = await client.api('/chats').post({
                chatType: 'oneOnOne',
                members: [
                    {
                        '@odata.type': '#microsoft.graph.aadUserConversationMember',
                        roles: ['owner'],
                        'user@odata.bind': `https://graph.microsoft.com/v1.0/users('${myId}')`
                    },
                    {
                        '@odata.type': '#microsoft.graph.aadUserConversationMember',
                        roles: ['owner'],
                        'user@odata.bind': `https://graph.microsoft.com/v1.0/users('${recipientUserId}')`
                    }
                ]
            });

            // Send message in the chat
            await client.api(`/chats/${chat.id}/messages`).post({
                body: {
                    contentType: 'html',
                    content: message
                }
            });
        } catch (e) {
            console.warn(`[GraphChatService] Failed to send Teams chat to ${recipientUserId}`, e);
        }
    }

    /**
     * Send mention notifications to multiple users.
     * Builds an HTML message with context and sends to each mentioned user.
     */
    public async notifyMentionedUsers(
        mentionedUsers: Array<{ id: string; displayName: string }>,
        messageText: string,
        authorName: string,
        checklistTitle: string
    ): Promise<void> {
        const htmlMessage = `<b>${this.escapeHtml(authorName)}</b> mentioned you in <b>${this.escapeHtml(checklistTitle)}</b>:<br/><br/><i>"${this.escapeHtml(messageText)}"</i>`;

        const promises = mentionedUsers.map(user =>
            this.sendTeamsChatNotification(user.id, htmlMessage).catch(e => {
                console.warn(`[GraphChatService] Notification failed for ${user.displayName}`, e);
            })
        );

        await Promise.all(promises);
    }

    private escapeOData(value: string): string {
        return value.replace(/'/g, "''");
    }

    private escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}
