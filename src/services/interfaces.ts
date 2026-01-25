import type { Checklist, ChecklistImage, Revision, UserContext } from '../models';

// ─── CHECKLIST SERVICE ───────────────────────────────────
export interface IChecklistService {
    getChecklist(id: string): Promise<Checklist>;
    getAllChecklists(): Promise<Checklist[]>;
    saveChecklist(checklist: Checklist): Promise<void>;
    createChecklist(title: string, jobReference: string): Promise<Checklist>;
    deleteChecklist(id: string): Promise<void>;
}

// ─── REVISION SERVICE ────────────────────────────────────
export interface IRevisionService {
    createRevision(checklistId: string, summary: string): Promise<Revision>;
    getRevisions(checklistId: string): Promise<Revision[]>;
    getRevision(revisionId: string): Promise<Revision | null>;
}

// ─── IMAGE SERVICE ───────────────────────────────────────
export interface IImageService {
    addImage(rowId: string, source: string, caption?: string): Promise<ChecklistImage>;
    removeImage(imageId: string): Promise<void>;
    updateCaption(imageId: string, caption: string): Promise<void>;
}

// ─── USER SERVICE ────────────────────────────────────────
export interface IUserService {
    getCurrentUser(): Promise<UserContext>;
}
