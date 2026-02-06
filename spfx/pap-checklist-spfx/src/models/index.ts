// ─── ANSWER STATE ────────────────────────────────────────
export type AnswerState = 'YES' | 'NO' | 'BLANK' | 'PS' | 'PC' | 'SUB' | 'OTS';

export const ANSWER_STATES: AnswerState[] = ['YES', 'NO', 'BLANK', 'PS', 'PC', 'SUB', 'OTS'];

export const ANSWER_CONFIG: Record<AnswerState, { label: string; color: string; description: string }> = {
    YES: { label: 'Yes', color: '#107c10', description: 'Included' },
    NO: { label: 'No', color: '#d13438', description: 'Excluded' },
    BLANK: { label: '—', color: '#8a8886', description: 'Intentionally unanswered' },
    PS: { label: 'PS', color: '#ff8c00', description: 'Provisional Sum' },
    PC: { label: 'PC', color: '#0078d4', description: 'Prime Cost' },
    SUB: { label: 'SUB', color: '#8764b8', description: 'Subcontractor' },
    OTS: { label: 'OTS', color: '#038387', description: 'Owner to Supply' },
};

// ─── CHECKLIST STATUS ────────────────────────────────────
export type ChecklistStatus = 'draft' | 'in-review' | 'final';

export const STATUS_CONFIG: Record<ChecklistStatus, { label: string; color: string }> = {
    'draft': { label: 'Draft', color: '#8a8886' },
    'in-review': { label: 'In Review', color: '#ff8c00' },
    'final': { label: 'Final', color: '#107c10' },
};

// ─── INLINE IMAGE ────────────────────────────────────────
export interface ChecklistImage {
    id: string;
    rowId: string;
    caption?: string;
    source: string;  // Base64 data URL (initial) or Full URL (saved)
    thumbnailUrl?: string; // Optimized thumbnail URL
    order: number;
}

// ─── CHECKLIST ROW ───────────────────────────────────────
export interface ChecklistRow {
    id: string;
    workgroupId: string;
    name: string;           // Short title/name for the row item
    description: string;    // Longer description text
    answer: AnswerState;
    notes: string;
    markedForReview: boolean;
    internalOnly: boolean;
    images: ChecklistImage[];
    references?: string[];
    order: number;
}

// ─── WORKGROUP ───────────────────────────────────────────
export interface Workgroup {
    id: string;
    checklistId: string;
    number: number;        // 20, 40, 180, 510
    name: string;
    rows: ChecklistRow[];
    summaryNotes?: string;
    order: number;
}

// ─── REVISION ────────────────────────────────────────────
export interface Revision {
    id: string;
    checklistId: string;
    number: number;        // REV 1, REV 2...
    title: string;         // Short revision title (pap_name)
    notes: string;         // Rich text body (pap_summary)
    snapshot: Checklist;   // Read-only copy at time of revision
    createdBy: string;
    createdAt: Date;
}

// ─── COMMENT ─────────────────────────────────────────────
export interface ChecklistComment {
    id: string;
    text: string;
    author: string;
    createdAt: Date;
}

// ─── FILE ────────────────────────────────────────────────
export interface ChecklistFile {
    id: string;
    name: string;
    url: string; // Base64 or mock URL
    type: string;
    size: number;
    uploadedBy: string;
    uploadedAt: Date;
}

// ─── CHECKLIST (ROOT) ────────────────────────────────────
export interface Checklist {
    id: string;
    jobReference: string;
    title: string;
    currentRevisionNumber: number;
    status: ChecklistStatus;
    workgroups: Workgroup[];
    revisions: Revision[];
    // Collaboration Fields ───
    clientCorrespondence: string[];
    estimateType: string[];
    commonNotes: string;
    clientLogoUrl?: string;
    comments: ChecklistComment[];
    files: ChecklistFile[];
    // Extended Job Details
    jobDetails?: {
        jobName: string;
        jobNumber: string;
        clientName: string;
    };
    // ────────────────────────
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}

// ─── USER CONTEXT ────────────────────────────────────────
export type UserRole = 'estimator' | 'reviewer' | 'admin';

export interface UserContext {
    id: string;
    name: string;
    email: string;
    role: UserRole;
}

// ─── HELPER FUNCTIONS ────────────────────────────────────
export function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function createEmptyRow(workgroupId: string, order: number): ChecklistRow {
    return {
        id: generateId(),
        workgroupId,
        name: '',
        description: '',
        answer: 'BLANK',
        notes: '',
        markedForReview: false,
        internalOnly: false,
        images: [],
        order,
    };
}

export function createEmptyChecklist(title: string, jobReference: string, createdBy: string): Checklist {
    return {
        id: generateId(),
        jobReference,
        title,
        currentRevisionNumber: 0,
        status: 'draft',
        workgroups: [],
        revisions: [],
        clientCorrespondence: [],
        estimateType: [],
        commonNotes: '',
        comments: [],
        files: [],
        createdBy,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
}
