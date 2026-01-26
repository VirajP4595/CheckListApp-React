import type { Checklist, ChecklistImage, Revision, UserContext } from '../models';

// ─── CHECKLIST SERVICE ───────────────────────────────────
export interface IChecklistService {
    getChecklist(id: string): Promise<Checklist>;
    getAllChecklists(): Promise<Checklist[]>;

    // Metadata Only
    saveChecklist(checklist: Checklist): Promise<Checklist>;

    // Workgroup Actions
    createWorkgroup(checklistId: string, number: number, name: string): Promise<Workgroup>;
    updateWorkgroup(workgroup: Workgroup): Promise<Workgroup>;
    deleteWorkgroup(workgroupId: string): Promise<void>;

    // Row Actions
    createRow(workgroupId: string, row: Partial<ChecklistRow>): Promise<ChecklistRow>;
    updateRow(row: ChecklistRow): Promise<ChecklistRow>;
    deleteRow(rowId: string): Promise<void>;
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
    getImages(checklistId: string): Promise<ChecklistImage[]>;
}

// ─── USER SERVICE ────────────────────────────────────────
export interface IUserService {
    getCurrentUser(): Promise<UserContext>;
}
