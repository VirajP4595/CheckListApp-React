/**
 * Service Factory
 * 
 * Provides dependency injection for services.
 */

import type { IChecklistService, IRevisionService, IImageService } from './interfaces';
import { WebPartContext } from '@microsoft/sp-webpart-base';

// Real implementations
import { DataverseChecklistService } from './dataverseChecklistService';
import { DataverseRevisionService } from './dataverseRevisionService';
import { SharePointImageService } from './sharePointService';
import { dataverseClient } from './dataverseService';

// ─── SERVICE INSTANCES ─────────────────────────────────────

let checklistServiceInstance: IChecklistService | null = null;
let revisionServiceInstance: IRevisionService | null = null;
let imageServiceInstance: SharePointImageService | null = null; // Concrete type for init

// ─── INITIALIZATION ────────────────────────────────────────

export async function initializeServices(context: WebPartContext): Promise<void> {
    console.log('[ServiceFactory] Initializing Services with SPFx Context...');

    // Initialize Dataverse Client (Singleton)
    await dataverseClient.initialize(context);

    // Initialize Image Service (Singleton)
    if (!imageServiceInstance) {
        imageServiceInstance = new SharePointImageService();
    }
    await imageServiceInstance.initialize(context);

    console.log('[ServiceFactory] Services Initialized.');
}

// ─── FACTORY FUNCTIONS ─────────────────────────────────────

export function getChecklistService(): IChecklistService {
    if (!checklistServiceInstance) {
        checklistServiceInstance = new DataverseChecklistService();
    }
    return checklistServiceInstance;
}

export function getRevisionService(): IRevisionService {
    if (!revisionServiceInstance) {
        revisionServiceInstance = new DataverseRevisionService();
    }
    return revisionServiceInstance;
}

export function getImageService(): IImageService {
    if (!imageServiceInstance) {
        imageServiceInstance = new SharePointImageService();
    }
    return imageServiceInstance;
}

// ─── RESET (for testing) ───────────────────────────────────

export function resetServices(): void {
    checklistServiceInstance = null;
    revisionServiceInstance = null;
    imageServiceInstance = null;
}
