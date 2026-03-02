import { WebPartContext } from '@microsoft/sp-webpart-base';
import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';

export class SharePointGroupService {
    private context: WebPartContext | null = null;
    private cache: Map<string, { result: boolean; expiresAt: number }> = new Map();

    public initialize(context: WebPartContext): void {
        this.context = context;
    }

    public async isCurrentUserInGroup(groupName: string): Promise<boolean> {
        if (!this.context) {
            console.error('[SharePointGroupService] Not initialized.');
            return false; // Fail safe
        }

        // Check cache
        const cacheEntry = this.cache.get(groupName);
        if (cacheEntry && Date.now() < cacheEntry.expiresAt) {
            return cacheEntry.result;
        }

        try {
            // Get all groups the current user belongs to - using a more robust endpoint that works consistently across SPFx Context
            // Sometimes /_api/web/currentuser/groups fails depending on permissions.
            // A more direct way is to fetch the specific group and see if the user is in its users list,
            // OR use the /_api/web/SiteGroups/getbyname('${groupName}')/CanCurrentUserViewMembership (which doesn't quite check membership, just visibility).

            // The best broad approach without elevated privileges is /_api/web/currentuser/?$expand=groups
            const url = `${this.context.pageContext.web.absoluteUrl}/_api/web/currentuser/?$expand=groups`;
            const response: SPHttpClientResponse = await this.context.spHttpClient.get(
                url,
                SPHttpClient.configurations.v1
            );

            if (!response.ok) {
                if (response.status === 404) {
                    console.warn(`[SharePointGroupService] Could not reach current user groups API. User might not be an explicit member of any site groups.`);
                    return false;
                }
                throw new Error(`Failed to fetch user groups: ${response.statusText}`);
            }

            const data = await response.json();
            const groups: { Title: string }[] = data.Groups || data.groups || (data.d && data.d.Groups && data.d.Groups.results) || [];

            const isInGroup = groups.some(g => g.Title === groupName);

            // Cache for 5 minutes to avoid repeated API calls
            this.cache.set(groupName, { result: isInGroup, expiresAt: Date.now() + 5 * 60 * 1000 });

            console.log(`[SharePointGroupService] Checked group "${groupName}". Result: ${isInGroup}`, groups.map(g => g.Title));
            return isInGroup;
        } catch (error) {
            console.error(`[SharePointGroupService] Error checking group membership for ${groupName}:`, error);
            return false;
        }
    }
}

export const sharePointGroupService = new SharePointGroupService();
