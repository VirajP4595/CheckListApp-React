import { create } from 'zustand';
import type { Checklist, ChecklistRow, AnswerState, ChecklistImage, Workgroup } from '../models';
import { generateId, createEmptyRow } from '../models';
import { getChecklistService } from '../services';

interface ChecklistState {
    // Data
    checklists: Checklist[];
    activeChecklist: Checklist | null;

    // UI State
    isLoading: boolean;
    isSaving: boolean;
    lastSaved: Date | null;
    error: string | null;

    // Actions - Data Loading
    loadChecklists: () => Promise<void>;
    loadChecklist: (id: string) => Promise<void>;

    // Actions - Checklist CRUD
    createChecklist: (title: string, jobReference: string) => Promise<Checklist>;
    saveChecklist: () => Promise<void>;

    // Actions - Row Operations
    updateRow: (rowId: string, updates: Partial<ChecklistRow>) => void;
    addRow: (workgroupId: string, afterRowId?: string) => void;
    deleteRow: (rowId: string) => void;
    toggleAnswer: (rowId: string, answer: AnswerState) => void;

    // Actions - Image Operations
    addImageToRow: (rowId: string, image: ChecklistImage) => void;
    removeImageFromRow: (rowId: string, imageId: string) => void;

    // Actions - Workgroup Operations
    addWorkgroup: (number: number, name: string) => void;
    deleteWorkgroup: (workgroupId: string) => void;
    updateWorkgroupNotes: (workgroupId: string, notes: string) => void;
    updateWorkgroup: (workgroupId: string, updates: Partial<Workgroup>) => void;

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
        set({ isLoading: true, error: null });
        try {
            const checklist = await getChecklistService().getChecklist(id);
            set({ activeChecklist: checklist, isLoading: false });
        } catch (err) {
            set({ error: (err as Error).message, isLoading: false });
        }
    },

    // Checklist CRUD
    createChecklist: async (title: string, jobReference: string) => {
        set({ isLoading: true, error: null });
        try {
            const newChecklist = await getChecklistService().createChecklist(title, jobReference);
            set(state => ({
                checklists: [...state.checklists, newChecklist],
                isLoading: false,
            }));
            return newChecklist;
        } catch (err) {
            set({ error: (err as Error).message, isLoading: false });
            throw err;
        }
    },

    saveChecklist: async () => {
        const { activeChecklist } = get();
        if (!activeChecklist) return;

        set({ isSaving: true });
        try {
            await getChecklistService().saveChecklist(activeChecklist);
            set({ isSaving: false, lastSaved: new Date() });
        } catch (err) {
            set({ error: (err as Error).message, isSaving: false });
        }
    },

    // Row Operations
    updateRow: (rowId: string, updates: Partial<ChecklistRow>) => {
        set(state => {
            if (!state.activeChecklist) return state;

            const updatedWorkgroups = state.activeChecklist.workgroups.map(wg => ({
                ...wg,
                rows: wg.rows.map(row =>
                    row.id === rowId ? { ...row, ...updates } : row
                ),
            }));

            return {
                activeChecklist: {
                    ...state.activeChecklist,
                    workgroups: updatedWorkgroups,
                    updatedAt: new Date(),
                },
            };
        });
    },

    addRow: (workgroupId: string, afterRowId?: string) => {
        set(state => {
            if (!state.activeChecklist) return state;

            const updatedWorkgroups = state.activeChecklist.workgroups.map(wg => {
                if (wg.id !== workgroupId) return wg;

                const rows = [...wg.rows];
                const newOrder = afterRowId
                    ? (rows.find(r => r.id === afterRowId)?.order ?? rows.length) + 1
                    : rows.length;

                const newRow = createEmptyRow(workgroupId, newOrder);

                if (afterRowId) {
                    const insertIndex = rows.findIndex(r => r.id === afterRowId) + 1;
                    rows.splice(insertIndex, 0, newRow);
                    // Reorder subsequent rows
                    rows.forEach((row, idx) => {
                        row.order = idx;
                    });
                } else {
                    rows.push(newRow);
                }

                return { ...wg, rows };
            });

            return {
                activeChecklist: {
                    ...state.activeChecklist,
                    workgroups: updatedWorkgroups,
                    updatedAt: new Date(),
                },
            };
        });
    },

    deleteRow: (rowId: string) => {
        set(state => {
            if (!state.activeChecklist) return state;

            const updatedWorkgroups = state.activeChecklist.workgroups.map(wg => ({
                ...wg,
                rows: wg.rows.filter(row => row.id !== rowId),
            }));

            return {
                activeChecklist: {
                    ...state.activeChecklist,
                    workgroups: updatedWorkgroups,
                    updatedAt: new Date(),
                },
            };
        });
    },

    toggleAnswer: (rowId: string, answer: AnswerState) => {
        get().updateRow(rowId, { answer });
    },

    // Image Operations
    addImageToRow: (rowId: string, image: ChecklistImage) => {
        set(state => {
            if (!state.activeChecklist) return state;

            const updatedWorkgroups = state.activeChecklist.workgroups.map(wg => ({
                ...wg,
                rows: wg.rows.map(row =>
                    row.id === rowId
                        ? { ...row, images: [...row.images, image] }
                        : row
                ),
            }));

            return {
                activeChecklist: {
                    ...state.activeChecklist,
                    workgroups: updatedWorkgroups,
                    updatedAt: new Date(),
                },
            };
        });
    },

    removeImageFromRow: (rowId: string, imageId: string) => {
        set(state => {
            if (!state.activeChecklist) return state;

            const updatedWorkgroups = state.activeChecklist.workgroups.map(wg => ({
                ...wg,
                rows: wg.rows.map(row =>
                    row.id === rowId
                        ? { ...row, images: row.images.filter(img => img.id !== imageId) }
                        : row
                ),
            }));

            return {
                activeChecklist: {
                    ...state.activeChecklist,
                    workgroups: updatedWorkgroups,
                    updatedAt: new Date(),
                },
            };
        });
    },

    // Workgroup Operations
    addWorkgroup: (number: number, name: string) => {
        set(state => {
            if (!state.activeChecklist) return state;

            const newWorkgroup: Workgroup = {
                id: generateId(),
                checklistId: state.activeChecklist.id,
                number,
                name,
                rows: [],
                order: state.activeChecklist.workgroups.length,
            };

            return {
                activeChecklist: {
                    ...state.activeChecklist,
                    workgroups: [...state.activeChecklist.workgroups, newWorkgroup],
                    updatedAt: new Date(),
                },
            };
        });
    },

    deleteWorkgroup: (workgroupId: string) => {
        set(state => {
            if (!state.activeChecklist) return state;

            const updatedWorkgroups = state.activeChecklist.workgroups.filter(
                wg => wg.id !== workgroupId
            );

            return {
                activeChecklist: {
                    ...state.activeChecklist,
                    workgroups: updatedWorkgroups,
                    updatedAt: new Date(),
                },
            };
        });
    },

    updateWorkgroupNotes: (workgroupId: string, notes: string) => {
        set(state => {
            if (!state.activeChecklist) return state;

            const updatedWorkgroups = state.activeChecklist.workgroups.map(wg =>
                wg.id === workgroupId ? { ...wg, summaryNotes: notes } : wg
            );

            return {
                activeChecklist: {
                    ...state.activeChecklist,
                    workgroups: updatedWorkgroups,
                    updatedAt: new Date(),
                },
            };
        });
    },

    updateWorkgroup: (workgroupId: string, updates: Partial<Workgroup>) => {
        set(state => {
            if (!state.activeChecklist) return state;

            const updatedWorkgroups = state.activeChecklist.workgroups.map(wg =>
                wg.id === workgroupId ? { ...wg, ...updates } : wg
            );

            return {
                activeChecklist: {
                    ...state.activeChecklist,
                    workgroups: updatedWorkgroups,
                    updatedAt: new Date(),
                },
            };
        });
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
                lastSaved: null, // Reset last saved until confirmed? Or just rely on optimistic update. 
                // Actually, saveChecklist handles set({ isSaving: false, lastSaved: new Date() }).
                // But here we are calling service directly.
                // Let's try to reuse saveChecklist logic or just set state and let separate save call handle it?
                // Simplified approach: Update state, and trigger background save.
                // We'll optimistically update activeChecklist.
            };
        });
    },

    // Utility
    clearError: () => set({ error: null }),
    setActiveChecklist: (checklist) => set({ activeChecklist: checklist }),
}));
