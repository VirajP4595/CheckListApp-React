/**
 * Service Factory
 * 
 * Provides dependency injection for services.
 * Now exclusively returns production implementations as per user request.
 */

import type { IChecklistService, IRevisionService, IImageService } from './interfaces';

// Real implementations
import { DataverseChecklistService } from './dataverseChecklistService';
import { DataverseRevisionService } from './dataverseRevisionService';
import { SharePointImageService } from './sharePointService';

// ─── SERVICE INSTANCES ─────────────────────────────────────

let checklistServiceInstance: IChecklistService | null = null;
let revisionServiceInstance: IRevisionService | null = null;
let imageServiceInstance: IImageService | null = null;

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
