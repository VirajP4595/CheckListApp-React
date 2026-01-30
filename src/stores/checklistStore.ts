import { create } from 'zustand';
import type { Checklist, ChecklistRow, AnswerState, ChecklistImage, Workgroup } from '../models';

import { getChecklistService, getImageService, getRevisionService } from '../services';

interface ChecklistState {
    // Data
    checklists: Checklist[];
    activeChecklist: Checklist | null;

    // UI State
    isLoading: boolean;
    isSaving: boolean;
    lastSaved: Date | null;
    error: string | null;
    processingItems: string[]; // IDs of items currently being processed (adding/deleting)

    loadedRowImages: Record<string, boolean>;
    availableImageFolders: string[]; // Cache of rows that actually have image folders

    // Actions - Data Loading
    loadChecklists: () => Promise<void>;
    loadChecklist: (id: string) => Promise<void>;
    fetchRowImages: (rowId: string) => Promise<void>;
    loadRevisions: () => Promise<void>;
    restoreRevision: (revisionId: string) => Promise<void>;

    // Actions - Checklist CRUD
    saveChecklist: () => Promise<void>;
    saveRow: (rowId: string) => Promise<void>;
    createRevision: (summary: string) => Promise<void>;
    uploadClientLogo: (file: File) => Promise<void>;

    // Actions - Row Operations
    updateRow: (rowId: string, updates: Partial<ChecklistRow>) => void;
    addRow: (workgroupId: string, afterRowId?: string) => Promise<void>;
    deleteRow: (rowId: string) => Promise<void>;
    toggleAnswer: (rowId: string, answer: AnswerState) => void;

    // Actions - Image Operations
    addImageToRow: (rowId: string, image: ChecklistImage) => void;
    removeImageFromRow: (rowId: string, imageId: string) => void;

    // Actions - Workgroup Operations
    addWorkgroup: (number: number, name: string) => Promise<void>;
    deleteWorkgroup: (workgroupId: string) => Promise<void>;
    updateWorkgroupNotes: (workgroupId: string, notes: string) => Promise<void>;
    updateWorkgroup: (workgroupId: string, updates: Partial<Workgroup>) => Promise<void>;

    // Actions - General
    updateChecklist: (id: string, updates: Partial<Checklist>) => void;

    // Actions - Utility
    clearError: () => void;
    setActiveChecklist: (checklist: Checklist | null) => void;
}



export const useChecklistStore = create<ChecklistState>((set, get) => ({
    // Initial State
    checklists: [],
    activeChecklist: null,
    isLoading: false,
    isSaving: false,
    lastSaved: null,
    error: null,
    processingItems: [],
    loadedRowImages: {},
    availableImageFolders: [],

    // Data Loading
    loadChecklists: async () => {
        set({ isLoading: true, error: null });
        try {
            const checklists = await getChecklistService().getAllChecklists();
            set({ checklists, isLoading: false });
        } catch (err) {
            set({ error: (err as Error).message, isLoading: false });
        }
    },

    loadChecklist: async (id: string) => {
        set({ isLoading: true, error: null, loadedRowImages: {} }); // Clear cache on new load
        try {
            const checklist = await getChecklistService().getChecklist(id);
            set({ activeChecklist: checklist, isLoading: false });

            // [New] Check which rows actually have images to prevent 404 spam
            try {
                const folders = await getImageService().listImageFolders(id);
                set({ availableImageFolders: folders });
            } catch (e) {
                console.warn('[Store] Failed to list image folders', e);
            }

        } catch (err) {
            set({ error: (err as Error).message, isLoading: false });
        }
    },

    fetchRowImages: async (rowId: string) => {
        const { activeChecklist, loadedRowImages, availableImageFolders } = get();
        if (!activeChecklist || loadedRowImages[rowId]) return;

        // Skip fetch if we know there are no images for this row
        if (!availableImageFolders.includes(rowId)) {
            // Mark as loaded so we don't keep checking
            set(state => ({ loadedRowImages: { ...state.loadedRowImages, [rowId]: true } }));
            return;
        }

        // Mark as loading/loaded to prevent duplicate fetches
        // Ideally we'd have a 'loading' state per row, but simple boolean is okay if we assume fast enough or debounce
        set(state => ({ loadedRowImages: { ...state.loadedRowImages, [rowId]: true } }));

        try {
            const images = await getImageService().getRowImages(activeChecklist.id, rowId);

            set(state => {
                if (!state.activeChecklist) return state;

                const updatedWorkgroups = state.activeChecklist.workgroups.map(wg => ({
                    ...wg,
                    rows: wg.rows.map(row =>
                        row.id === rowId ? { ...row, images } : row
                    )
                }));

                return {
                    activeChecklist: {
                        ...state.activeChecklist,
                        workgroups: updatedWorkgroups
                    }
                };
            });
        } catch (err) {
            console.error(`[Store] Failed to fetch images for row ${rowId}`, err);
            // On error, maybe we should remove the loaded flag to allow retry?
            set(state => {
                const newLoaded = { ...state.loadedRowImages };
                delete newLoaded[rowId];
                return { loadedRowImages: newLoaded };
            });
        }
    },

    // Checklist CRUD
    saveChecklist: async () => {
        const { activeChecklist } = get();
        if (!activeChecklist) return;

        set({ isSaving: true });
        try {
            // Metadata only save
            const savedChecklist = await getChecklistService().saveChecklist(activeChecklist);
            set({
                isSaving: false,
                lastSaved: new Date(),
                activeChecklist: { ...activeChecklist, ...savedChecklist, updatedAt: new Date() }
            });
        } catch (err) {
            set({ error: (err as Error).message, isSaving: false });
        }
    },

    saveRow: async (rowId: string) => {
        const { activeChecklist } = get();
        if (!activeChecklist) return;

        let rowToSave: ChecklistRow | undefined;
        for (const wg of activeChecklist.workgroups) {
            const found = wg.rows.find(r => r.id === rowId);
            if (found) {
                rowToSave = found;
                break;
            }
        }
        if (!rowToSave) return;

        // Check if it's a new row (temp ID) -> Use createRow
        // But wait, addRow now calls createRow immediately? Yes, per plan.
        // So saveRow here should only be for UPDATES.

        console.log(`[Store] Updating Row: ${rowId}`);
        set({ isSaving: true });
        try {
            const updatedRow = await getChecklistService().updateRow(rowToSave);
            set(state => {
                if (!state.activeChecklist) return state;
                const updatedWorkgroups = state.activeChecklist.workgroups.map(wg => {
                    const rowExists = wg.rows.some(r => r.id === rowId);
                    if (!rowExists) return wg;

                    return {
                        ...wg,
                        rows: wg.rows.map(r => r.id === rowId ? updatedRow : r)
                    };
                });
                return {
                    isSaving: false,
                    lastSaved: new Date(),
                    activeChecklist: {
                        ...state.activeChecklist,
                        workgroups: updatedWorkgroups,
                        updatedAt: new Date()
                    }
                };
            });
        } catch (err) {
            console.error('[Store] Update Row Failed', err);
            set({ error: (err as Error).message, isSaving: false });
        }
    },

    // Row Operations
    updateRow: (rowId: string, updates: Partial<ChecklistRow>) => {
        // Optimistic update local state (for typing speed)
        set(state => {
            if (!state.activeChecklist) return state;

            let hasChanges = false;
            const updatedWorkgroups = state.activeChecklist.workgroups.map(wg => {
                const rowExists = wg.rows.some(r => r.id === rowId);
                if (!rowExists) return wg;

                hasChanges = true;
                return {
                    ...wg,
                    rows: wg.rows.map(row =>
                        row.id === rowId ? { ...row, ...updates } : row
                    ),
                };
            });

            if (!hasChanges) return state;

            return {
                activeChecklist: {
                    ...state.activeChecklist,
                    workgroups: updatedWorkgroups,
                    updatedAt: new Date(),
                },
            };
        });
    },

    addRow: async (workgroupId: string, afterRowId?: string) => {
        // Immediate server persistence
        const { activeChecklist } = get();
        if (!activeChecklist) return;

        const wg = activeChecklist.workgroups.find(w => w.id === workgroupId);
        if (!wg) return;

        // Calculate Order and Name
        const rows = wg.rows;
        const newOrder = afterRowId
            ? (rows.find(r => r.id === afterRowId)?.order ?? rows.length) + 1
            : rows.length;

        const nextItemNumber = rows.length + 1;
        const defaultName = `${wg.name} Item ${nextItemNumber}`;

        set(state => ({ processingItems: [...state.processingItems, workgroupId], isSaving: true }));
        try {
            const newRow = await getChecklistService().createRow(workgroupId, {
                order: newOrder,
                name: defaultName,
                description: '',
                answer: 'BLANK'
            });

            set(state => {
                if (!state.activeChecklist) return { processingItems: state.processingItems.filter(id => id !== workgroupId), isSaving: false };
                const updatedWorkgroups = state.activeChecklist.workgroups.map(w => {
                    if (w.id !== workgroupId) return w;
                    const newRows = [...w.rows];
                    if (afterRowId) {
                        const idx = newRows.findIndex(r => r.id === afterRowId);
                        newRows.splice(idx + 1, 0, newRow);
                    } else {
                        newRows.push(newRow);
                    }
                    return { ...w, rows: newRows };
                });
                return {
                    isSaving: false,
                    lastSaved: new Date(),
                    processingItems: state.processingItems.filter(id => id !== workgroupId),
                    activeChecklist: {
                        ...state.activeChecklist,
                        workgroups: updatedWorkgroups,
                        updatedAt: new Date()
                    }
                };
            });
        } catch (err) {
            console.error('[Store] Add Row Failed', err);
            set(state => ({
                error: (err as Error).message,
                isSaving: false,
                processingItems: state.processingItems.filter(id => id !== workgroupId)
            }));
        }
    },

    deleteRow: async (rowId: string) => {
        set(state => ({ processingItems: [...state.processingItems, rowId], isSaving: true }));
        try {
            await getChecklistService().deleteRow(rowId);
            set(state => {
                if (!state.activeChecklist) return { processingItems: state.processingItems.filter(id => id !== rowId), isSaving: false };
                const updatedWorkgroups = state.activeChecklist.workgroups.map(wg => ({
                    ...wg,
                    rows: wg.rows.filter(row => row.id !== rowId),
                }));
                return {
                    isSaving: false,
                    lastSaved: new Date(),
                    processingItems: state.processingItems.filter(id => id !== rowId),
                    activeChecklist: {
                        ...state.activeChecklist,
                        workgroups: updatedWorkgroups,
                        updatedAt: new Date()
                    }
                };
            });
        } catch (err) {
            set(state => ({
                error: (err as Error).message,
                isSaving: false,
                processingItems: state.processingItems.filter(id => id !== rowId)
            }));
        }
    },

    toggleAnswer: (rowId: string, answer: AnswerState) => {
        get().updateRow(rowId, { answer });
        get().saveRow(rowId); // Trigger save immediately
    },

    // Image Operations
    addImageToRow: async (rowId: string, image: ChecklistImage) => {
        const processId = `img-add-${rowId}`;
        set(state => ({ processingItems: [...state.processingItems, processId] }));

        const { activeChecklist } = get();
        if (!activeChecklist) return;

        // Find workgroupId
        let workgroupId = '';
        for (const wg of activeChecklist.workgroups) {
            if (wg.rows.find(r => r.id === rowId)) {
                workgroupId = wg.id;
                break;
            }
        }

        try {
            // Server Call

            const savedImage = await getImageService().addImage(activeChecklist.id, workgroupId, rowId, image.source, image.caption);

            set(state => {
                if (!state.activeChecklist) return { processingItems: state.processingItems.filter(p => p !== processId) };

                const updatedWorkgroups = state.activeChecklist.workgroups.map(wg => ({
                    ...wg,
                    rows: wg.rows.map(row =>
                        row.id === rowId
                            ? { ...row, images: [...row.images, savedImage] }
                            : row
                    ),
                }));

                // Ensure row is marked loaded so we don't overwrite if fetch happens
                return {
                    processingItems: state.processingItems.filter(p => p !== processId),
                    loadedRowImages: { ...state.loadedRowImages, [rowId]: true },
                    availableImageFolders: [...state.availableImageFolders, rowId], // Mark as having images
                    activeChecklist: {
                        ...state.activeChecklist,
                        workgroups: updatedWorkgroups,
                        updatedAt: new Date(),
                    },
                };
            });
        } catch (err) {
            console.error('[Store] Add Image Failed', err);
            set(state => ({
                error: (err as Error).message,
                processingItems: state.processingItems.filter(p => p !== processId)
            }));
        }
    },

    removeImageFromRow: async (rowId: string, imageId: string) => {
        const processId = `img-rm-${imageId}`;
        set(state => ({ processingItems: [...state.processingItems, processId] }));

        try {
            await getImageService().removeImage(imageId);

            set(state => {
                if (!state.activeChecklist) return { processingItems: state.processingItems.filter(p => p !== processId) };

                const updatedWorkgroups = state.activeChecklist.workgroups.map(wg => ({
                    ...wg,
                    rows: wg.rows.map(row =>
                        row.id === rowId
                            ? { ...row, images: row.images.filter(img => img.id !== imageId) }
                            : row
                    ),
                }));

                return {
                    processingItems: state.processingItems.filter(p => p !== processId),
                    activeChecklist: {
                        ...state.activeChecklist,
                        workgroups: updatedWorkgroups,
                        updatedAt: new Date(),
                    },
                };
            });
        } catch (err) {
            console.error('[Store] Remove Image Failed', err);
            set(state => ({
                error: (err as Error).message,
                processingItems: state.processingItems.filter(p => p !== processId)
            }));
        }
    },

    // Workgroup Operations
    addWorkgroup: async (number: number, name: string) => {
        const { activeChecklist } = get();
        if (!activeChecklist) return;

        set(state => ({ processingItems: [...state.processingItems, `add-wg-${activeChecklist.id}`], isSaving: true }));
        try {
            const newWg = await getChecklistService().createWorkgroup(activeChecklist.id, number, name);
            set(state => {
                if (!state.activeChecklist) return { processingItems: state.processingItems.filter(id => id !== `add-wg-${activeChecklist.id}`), isSaving: false };
                return {
                    isSaving: false,
                    lastSaved: new Date(),
                    processingItems: state.processingItems.filter(id => id !== `add-wg-${activeChecklist.id}`),
                    activeChecklist: {
                        ...state.activeChecklist,
                        workgroups: [...state.activeChecklist.workgroups, newWg],
                        updatedAt: new Date()
                    }
                };
            });
        } catch (err) {
            set(state => ({
                error: (err as Error).message,
                isSaving: false,
                processingItems: state.processingItems.filter(id => id !== `add-wg-${activeChecklist.id}`)
            }));
        }
    },

    deleteWorkgroup: async (workgroupId: string) => {
        set(state => ({ processingItems: [...state.processingItems, workgroupId], isSaving: true }));
        try {
            await getChecklistService().deleteWorkgroup(workgroupId);
            set(state => {
                if (!state.activeChecklist) return { processingItems: state.processingItems.filter(id => id !== workgroupId), isSaving: false };
                const updatedWorkgroups = state.activeChecklist.workgroups.filter(
                    wg => wg.id !== workgroupId
                );
                return {
                    isSaving: false,
                    lastSaved: new Date(),
                    processingItems: state.processingItems.filter(id => id !== workgroupId),
                    activeChecklist: {
                        ...state.activeChecklist,
                        workgroups: updatedWorkgroups,
                        updatedAt: new Date()
                    }
                };
            });
        } catch (err) {
            set(state => ({
                error: (err as Error).message,
                isSaving: false,
                processingItems: state.processingItems.filter(id => id !== workgroupId)
            }));
        }
    },

    updateWorkgroupNotes: async (workgroupId: string, notes: string) => {
        // Helper to find and update
        const { activeChecklist } = get();
        if (!activeChecklist) return;
        const wg = activeChecklist.workgroups.find(w => w.id === workgroupId);
        if (wg) {
            const updated = { ...wg, summaryNotes: notes };
            // Optimistic
            set(state => {
                if (!state.activeChecklist) return state;
                return {
                    activeChecklist: {
                        ...state.activeChecklist,
                        workgroups: state.activeChecklist.workgroups.map(w => w.id === workgroupId ? updated : w)
                    }
                };
            });
            // Server
            await getChecklistService().updateWorkgroup(updated);
        }
    },

    updateWorkgroup: async (workgroupId: string, updates: Partial<Workgroup>) => {
        const { activeChecklist } = get();
        if (!activeChecklist) return;
        const wg = activeChecklist.workgroups.find(w => w.id === workgroupId);
        if (wg) {
            const updated = { ...wg, ...updates };
            // Optimistic
            set(state => {
                if (!state.activeChecklist) return state;
                return {
                    activeChecklist: {
                        ...state.activeChecklist,
                        workgroups: state.activeChecklist.workgroups.map(w => w.id === workgroupId ? updated : w)
                    }
                };
            });
            // Server
            await getChecklistService().updateWorkgroup(updated);
        }
    },

    updateChecklist: (id: string, updates: Partial<Checklist>) => {
        set(state => {
            if (!state.activeChecklist || state.activeChecklist.id !== id) return state;

            const updatedChecklist = { ...state.activeChecklist, ...updates, updatedAt: new Date() };

            // Trigger save asynchronously
            getChecklistService().saveChecklist(updatedChecklist).catch(err => {
                set({ error: (err as Error).message });
            });

            return {
                activeChecklist: updatedChecklist,
                lastSaved: null,
            };
        });
    },

    // Revision Operations
    createRevision: async (summary: string) => {
        const { activeChecklist } = get();
        if (!activeChecklist) return;

        set({ isSaving: true });
        try {

            const revision = await getRevisionService().createRevision(activeChecklist.id, summary);

            set(state => {
                if (!state.activeChecklist) return { isSaving: false };
                return {
                    isSaving: false,
                    lastSaved: new Date(),
                    activeChecklist: {
                        ...state.activeChecklist,
                        currentRevisionNumber: revision.number,
                        revisions: [revision, ...(state.activeChecklist.revisions || [])],
                        updatedAt: new Date()
                    }
                };
            });
        } catch (err) {
            set({ error: (err as Error).message, isSaving: false });
        }
    },

    loadRevisions: async () => {
        const { activeChecklist } = get();
        if (!activeChecklist) return;

        set({ isLoading: true });
        try {
            const revisions = await getRevisionService().getRevisions(activeChecklist.id);
            set(state => {
                if (!state.activeChecklist) return { isLoading: false };
                return {
                    isLoading: false,
                    activeChecklist: {
                        ...state.activeChecklist,
                        revisions: revisions
                    }
                };
            });
        } catch (err) {
            set({ error: (err as Error).message, isLoading: false });
        }
    },

    restoreRevision: async (revisionId: string) => {
        set({ isLoading: true });
        try {
            const revision = await getRevisionService().getRevision(revisionId);
            if (revision && revision.snapshot) {
                set(state => ({
                    isLoading: false,
                    activeChecklist: {
                        ...revision.snapshot,
                        // Ensure we mistakenly don't overwrite metadata that shouldn't change if snapshot is old structure
                        id: state.activeChecklist?.id || revision.snapshot.id,
                    }
                }));
            } else {
                set({ isLoading: false, error: "Snapshot content missing" });
            }
        } catch (err) {
            set({ error: (err as Error).message, isLoading: false });
        }
    },

    uploadClientLogo: async (file: File) => {
        const { activeChecklist } = get();
        if (!activeChecklist) return;

        set({ isSaving: true });
        try {
            // 1. Upload to SharePoint
            const url = await getImageService().uploadClientLogo(activeChecklist.id, file);

            // 2. Update Checklist Metadata (Validation: Save URL to Dataverse)
            // We use updateChecklist logic but specific trigger
            const updatedChecklist = { ...activeChecklist, clientLogoUrl: url, updatedAt: new Date() };

            await getChecklistService().saveChecklist(updatedChecklist);

            set({
                isSaving: false,
                lastSaved: new Date(),
                activeChecklist: updatedChecklist
            });
        } catch (err) {
            set({ error: (err as Error).message, isSaving: false });
        }
    },

    // Utility
    clearError: () => set({ error: null }),
    setActiveChecklist: (checklist) => set({ activeChecklist: checklist }),
}));
