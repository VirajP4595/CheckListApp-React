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
    private currentUserId: string | undefined;

    public async initialize(context: WebPartContext): Promise<void> {
        this.client = await context.msGraphClientFactory.getClient('3');
        // Cache current user ID at init time
        try {
            const me = await this.client.api('/me').select('id').get();
            this.currentUserId = me.id;
        } catch (e) {
            console.warn('[GraphChatService] Failed to get current user ID', e);
        }
        console.log('[GraphChatService] Initialized, userId:', this.currentUserId);
    }

    private getClient(): MSGraphClientV3 {
        if (!this.client) throw new Error("GraphChatService not initialized.");
        return this.client;
    }

    /**
     * Search org users by name or email.
     * Always uses /users directory endpoint to get reliable Azure AD user IDs
     * (People API IDs are person-specific and cannot be used for chat creation).
     * Returns up to 10 results.
     */
    public async searchUsers(query: string): Promise<OrgUser[]> {
        if (!query || query.length < 2) return [];
        const client = this.getClient();

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
        const myId = this.currentUserId;

        if (!myId) {
            console.error('[GraphChatService] Cannot send chat — current user ID not available');
            return;
        }

        if (!recipientUserId) {
            console.error('[GraphChatService] Cannot send chat — recipient user ID is empty');
            return;
        }

        console.log(`[GraphChatService] Creating chat: me=${myId}, recipient=${recipientUserId}`);

        try {
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

            console.log(`[GraphChatService] Chat created/found: ${chat.id}`);

            // Send message in the chat
            await client.api(`/chats/${chat.id}/messages`).post({
                body: {
                    contentType: 'html',
                    content: message
                }
            });

            console.log(`[GraphChatService] Message sent successfully to ${recipientUserId}`);
        } catch (e: any) {
            console.error(`[GraphChatService] Failed to send Teams chat to ${recipientUserId}`, e?.statusCode, e?.message || e);
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
