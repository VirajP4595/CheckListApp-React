# Revision System Rework — Final Implementation Plan

## Overview

Replace the snapshot-based revision system with **inline revision sections** in the checklist editor. Each revision becomes a collapsible section containing its own workgroups and rows, dynamically created and editable just like the main checklist body.

### Decisions (Confirmed by User)
| # | Decision | Answer |
|---|----------|--------|
| 1 | Workgroup behavior | **Empty** — new workgroup created with same name/number, user adds rows from scratch |
| 2 | Dataverse column | User will provision `pap_revisionid` lookup on `pap_workgroup` |
| 3 | Snapshot cleanup | User handles (leave code deletion to us, Dataverse columns untouched) |
| 4 | Workgroup naming | **Editable** — same as normal checklist workgroups |
| 5 | Default state | **Collapsed** by default |
| 6 | Role restrictions | **None** for now |

---

## Proposed Changes

### 1. Data Models

#### [MODIFY] [index.ts](file:///C:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/models/index.ts)

**Revision interface** (lines 67-76) — remove `snapshot`:

```diff
 export interface Revision {
     id: string;
     checklistId: string;
     number: number;
     title: string;
     notes: string;
-    snapshot: Checklist;
     createdBy: string;
     createdAt: Date;
 }
```

**Workgroup interface** (lines 56-64) — add `revisionId`:

```diff
 export interface Workgroup {
     id: string;
     checklistId: string;
+    revisionId?: string;       // If set, belongs to a revision section (not the original checklist body)
     number: number;
     name: string;
     rows: ChecklistRow[];
     summaryNotes?: string;
     order: number;
 }
```

> No changes to `ChecklistRow`, `Checklist`, or other interfaces.

---

### 2. Service Layer

#### [MODIFY] [dataverseRevisionService.ts](file:///C:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/services/dataverseRevisionService.ts)

**Remove all snapshot/file logic. Simplified to metadata-only CRUD:**

| What to remove | Details |
|---|---|
| `DataverseRevision.pap_snapshotjson` field | Remove from interface |
| `snapshot` mapping in `mapRevision()` | Just return `undefined` or remove property entirely |
| `createRevision()` — snapshot serialization | Remove: `JSON.stringify(checklist)` blob creation |
| `createRevision()` — file upload & retry | Remove: `dataverseClient.uploadFile()` call and retry loop |
| `createRevision()` — `saveChecklist()` pre-call | The method currently saves full checklist before snapshotting — remove that |
| `getRevision()` — file download | Remove: `dataverseClient.downloadFile()` and JSON parsing |
| `getRevision()` — `getChecklist()` call for images | Remove entirely |

**Simplified `createRevision()`:**
```ts
async createRevision(checklistId: string, title: string, notes: string): Promise<Revision> {
    // 1. Get current revision number
    const checklist = await dataverseClient.getById<any>(entities.checklists, checklistId, col('currentrevisionnumber'));
    const nextNumber = (checklist[col('currentrevisionnumber')] || 0) + 1;

    // 2. Create revision metadata record only
    const result = await dataverseClient.create<any>(entities.revisions, {
        [col('name')]: title,
        [col('number')]: nextNumber,
        [col('summary')]: notes,
        [`${col('checklistid')}@odata.bind`]: `/${entities.checklists}(${checklistId})`
    });

    // 3. Increment revision counter on checklist
    await dataverseClient.update(entities.checklists, checklistId, {
        [col('currentrevisionnumber')]: nextNumber
    });

    return {
        id: result[col('revisionid')],
        checklistId,
        number: nextNumber,
        title,
        notes,
        createdBy: result['createdby@OData.Community.Display.V1.FormattedValue'] || '',
        createdAt: new Date(result.createdon)
    };
}
```

**Simplified `getRevisions()`** — already mostly correct, just remove snapshot mapping.

**Remove `getRevision()` method entirely** (no longer needed — no snapshot to fetch).

---

#### [MODIFY] [interfaces.ts](file:///C:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/services/interfaces.ts)

```diff
 export interface IRevisionService {
     createRevision(checklistId: string, title: string, notes: string): Promise<Revision>;
     getRevisions(checklistId: string): Promise<Revision[]>;
-    getRevision(revisionId: string): Promise<Revision | null>;
 }

 export interface IChecklistService {
     // ... existing methods ...
-    createWorkgroup(checklistId: string, number: number, name: string): Promise<Workgroup>;
+    createWorkgroup(checklistId: string, number: number, name: string, revisionId?: string): Promise<Workgroup>;
     // ... rest unchanged ...
 }
```

---

#### [MODIFY] [dataverseChecklistService.ts](file:///C:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/services/dataverseChecklistService.ts)

**1. `DataverseWorkgroup` interface** (line 58-69) — add `_pap_revisionid_value`:
```diff
 interface DataverseWorkgroup {
     [key: string]: unknown;
     pap_workgroupid: string;
     pap_name: string;
     pap_number: string;
     pap_order: number;
     pap_summarynotes?: string;
     _pap_checklistid_value: string;
+    _pap_revisionid_value?: string;     // Lookup to pap_revision
     [key: `pap_checklistrow_${string}`]: DataverseRow[] | undefined;
 }
```

**2. `mapWorkgroup()` function** (line 158-170) — map `revisionId`:
```diff
 function mapWorkgroup(dv: DataverseWorkgroup): Workgroup {
     const rows = (dv[navprops.workgroup_rows] as DataverseRow[] | undefined) || [];
     return {
         id: dv.pap_workgroupid,
         checklistId: dv._pap_checklistid_value,
+        revisionId: dv._pap_revisionid_value || undefined,
         number: parseFloat(dv.pap_number) || 0,
         name: dv.pap_name,
         rows: rows.map(mapRow).sort((a, b) => a.order - b.order),
         summaryNotes: dv.pap_summarynotes,
         order: dv.pap_order
     };
 }
```

**3. Workgroup query select** (around line 266) — add the revision lookup column to the query so it's returned:

In `getChecklist()`, after fetching workgroups, add `_pap_revisionid_value` to the workgroup query or ensure it comes through (Dataverse returns lookup values by default when not specifying `$select` on the workgroup query — the current code doesn't use `$select` for workgroups so this should already be included).

**4. Direct mapping in `getChecklist()` inline workgroup mapper** (line 310-328) — add `revisionId`:
```diff
 const workgroups = workgroupsResponse.value.map(wg => {
     const wgRows = allRows.filter(r => r._pap_workgroupid_value === wg.pap_workgroupid);
     return {
         id: wg.pap_workgroupid,
         checklistId: wg._pap_checklistid_value,
+        revisionId: wg._pap_revisionid_value || undefined,
         number: parseFloat(wg.pap_number) || 0,
```

**5. `createWorkgroup()` method** (line 449-469) — accept optional `revisionId`:
```diff
-async createWorkgroup(checklistId: string, number: number, name: string): Promise<Workgroup> {
+async createWorkgroup(checklistId: string, number: number, name: string, revisionId?: string): Promise<Workgroup> {
     console.log(`[Dataverse] Creating Workgroup: "${name}" for Checklist: ${checklistId}`);
-    const result = await dataverseClient.create<{ pap_workgroupid: string }>(entities.workgroups, {
+    const payload: Record<string, unknown> = {
         [col('name')]: name,
         [col('number')]: String(number),
         [col('order')]: number,
         [`${col('checklistid')}@odata.bind`]: `/${entities.checklists}(${checklistId})`
-    });
+    };
+    if (revisionId) {
+        payload[`${col('revisionid')}@odata.bind`] = `/${entities.revisions}(${revisionId})`;
+    }
+    const result = await dataverseClient.create<{ pap_workgroupid: string }>(entities.workgroups, payload);

     return {
         id: result.pap_workgroupid,
         checklistId: checklistId,
+        revisionId: revisionId,
         number: number,
         name: name,
         rows: [],
         order: number,
         summaryNotes: ''
     };
 }
```

---

### 3. Zustand Store

#### [MODIFY] [checklistStore.ts](file:///C:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/stores/checklistStore.ts)

**Remove `restoreRevision` action** (lines 672-691) — delete entirely.

**Remove from state interface**: Remove `restoreRevision` from the `ChecklistState` interface.

**Simplify `createRevision` action** (lines 622-648) — currently calls `getRevisionService().createRevision()` which internally does snapshotting. After the service refactor, this will just create metadata. The store action itself looks clean already — keeps working as-is since it calls the service and adds to `activeChecklist.revisions`.

**Add new action — `addRevisionWorkgroup`:**
```ts
addRevisionWorkgroup: async (revisionId: string, sourceWorkgroupNumber: number, sourceWorkgroupName: string) => {
    const { activeChecklist } = get();
    if (!activeChecklist) return;

    const processId = `add-rev-wg-${revisionId}`;
    set(state => ({ processingItems: [...state.processingItems, processId], isSaving: true }));

    try {
        // Create empty workgroup with same name/number, linked to revision
        const newWg = await getChecklistService().createWorkgroup(
            activeChecklist.id,
            sourceWorkgroupNumber,
            sourceWorkgroupName,
            revisionId    // <-- new param
        );

        logActivity(activeChecklist.id, 'revision_workgroup_added', `${sourceWorkgroupName} → REV`);

        set(state => {
            if (!state.activeChecklist) return {
                processingItems: state.processingItems.filter(id => id !== processId),
                isSaving: false
            };
            return {
                isSaving: false,
                lastSaved: new Date(),
                processingItems: state.processingItems.filter(id => id !== processId),
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
            processingItems: state.processingItems.filter(id => id !== processId)
        }));
    }
},
```

**Modify `addWorkgroup` action** (line 490) — no change needed. It already calls `createWorkgroup()` without a `revisionId`, so it creates original workgroups as before.

**Existing actions that work for both original and revision workgroups (zero changes):**
- `addRow(workgroupId)` — works because rows belong to workgroups
- `deleteRow(rowId)` — works generically
- `updateRow(…)` / `saveRow(…)` / `toggleAnswer(…)` — all operate on row IDs
- `deleteWorkgroup(workgroupId)` — cascade deletes the workgroup and its rows
- `updateWorkgroup(workgroupId, { name, number })` — updates name/number

---

### 4. New UI Component — RevisionSection

#### [NEW] [RevisionSection.tsx](file:///C:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/components/Revision/RevisionSection.tsx)

**Props:**
```ts
interface RevisionSectionProps {
    revision: Revision;
    revisionWorkgroups: Workgroup[];           // workgroups where revisionId === this revision's id
    originalWorkgroups: Workgroup[];            // workgroups where revisionId is undefined (for dropdown)
    onRowChange: () => void;                   // triggers autosave
    filters: FilterState;                      // pass through editor filters
    expandTasks: boolean;                      // pass through editor expand state
}
```

**Internal state:**
```ts
const [isExpanded, setIsExpanded] = useState(false);   // collapsed by default
const [isDropdownOpen, setIsDropdownOpen] = useState(false);
```

**Component structure:**
```tsx
<div className={styles.revisionSection}>
    {/* Collapsible Header */}
    <div className={styles.revisionHeader} onClick={toggleExpand}>
        <ChevronDown20Regular /> or <ChevronRight20Regular />
        <span className={styles.revisionBadge}>REV {revision.number}</span>
        <span className={styles.revisionTitle}>{revision.title}</span>
        <span className={styles.revisionMeta}>
            {formatDate(revision.createdAt)} • {revision.createdBy}
        </span>
        <span className={styles.revisionCount}>
            {revisionWorkgroups.length} workgroup(s)
        </span>
    </div>

    {/* Expandable Body */}
    {isExpanded && (
        <div className={styles.revisionBody}>
            {/* Notes (if present) */}
            {revision.notes && (
                <div className={styles.revisionNotes}>{revision.notes}</div>
            )}

            {/* Add Workgroup Dropdown */}
            <div className={styles.addWorkgroupRow}>
                <Combobox
                    placeholder="Add workgroup to this revision..."
                    onOptionSelect={(_, data) => handleAddWorkgroup(data.optionValue)}
                >
                    {originalWorkgroups.map(wg => (
                        <Option key={wg.id} value={wg.id}>
                            {wg.number} — {wg.name}
                        </Option>
                    ))}
                </Combobox>
            </div>

            {/* Revision Workgroups — reuse WorkgroupSection */}
            <div className={styles.revisionWorkgroups}>
                {revisionWorkgroups
                    .sort((a, b) => a.order - b.order)
                    .map(wg => (
                        <WorkgroupSection
                            key={wg.id}
                            workgroup={wg}
                            onRowChange={onRowChange}
                            filters={filters}
                            isCollapsed={false}          // expanded within revision
                            expandTasks={expandTasks}
                        />
                    ))}
            </div>
        </div>
    )}
</div>
```

**`handleAddWorkgroup` handler:**
```ts
const addRevisionWorkgroup = useChecklistStore(state => state.addRevisionWorkgroup);

const handleAddWorkgroup = async (sourceWorkgroupId: string) => {
    const source = originalWorkgroups.find(wg => wg.id === sourceWorkgroupId);
    if (!source) return;
    await addRevisionWorkgroup(revision.id, source.number, source.name);
};
```

**Imports required:**
- `Combobox`, `Option` from `@fluentui/react-components`
- `ChevronDown20Regular`, `ChevronRight20Regular` from `@fluentui/react-icons`
- `WorkgroupSection` from `../Editor/WorkgroupSection`
- `useChecklistStore` from `../../stores`
- `FilterState` from `../Editor/FilterBar`

---

#### [NEW] [RevisionSection.module.scss](file:///C:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/components/Revision/RevisionSection.module.scss)

Uses design tokens from `_variables.scss` and mixins from `_mixins.scss`:

```scss
@use '../../styles/variables' as *;
@use '../../styles/mixins' as *;

.revisionSection {
    @include surface;
    margin-bottom: $spacing-4;
    border-left: 3px solid $color-primary-light;
    transition: box-shadow $transition-base;
}

.revisionHeader {
    @include flex-between;
    padding: $spacing-3 $spacing-4;
    cursor: pointer;
    gap: $spacing-3;
    user-select: none;

    &:hover {
        background-color: $color-gray-50;
    }
}

.revisionBadge {
    display: inline-flex;
    align-items: center;
    padding: $spacing-1 $spacing-3;
    background-color: $color-primary-subtle;
    color: $color-primary;
    font-size: $font-size-xs;
    font-weight: $font-weight-bold;
    border-radius: $border-radius-full;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    white-space: nowrap;
}

.revisionTitle {
    @include heading-4;
    flex: 1;
    @include truncate;
}

.revisionMeta {
    @include body-small;
    white-space: nowrap;
}

.revisionCount {
    @include body-small;
    white-space: nowrap;
}

.revisionBody {
    padding: $spacing-2 $spacing-4 $spacing-4;
    @include fade-in;
}

.revisionNotes {
    @include body-small;
    padding: $spacing-2 $spacing-3;
    background-color: $color-gray-50;
    border-radius: $border-radius-sm;
    margin-bottom: $spacing-3;
    border-left: 2px solid $color-gray-300;
}

.addWorkgroupRow {
    margin-bottom: $spacing-4;

    :global(.fui-Combobox) {
        @include dropdown-filled;
        width: 100%;
        max-width: 400px;
    }
}

.revisionWorkgroups {
    display: flex;
    flex-direction: column;
    gap: $spacing-3;
}
```

---

### 5. Editor Layout Changes

#### [MODIFY] [ChecklistEditor.tsx](file:///C:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/components/Editor/ChecklistEditor.tsx)

**Imports — Add:**
```ts
import { RevisionSection } from '../Revision/RevisionSection';
```

**Imports — Remove:**
```diff
-import { RevisionPanel } from '../Revision/RevisionPanel';
-import { RevisionViewer } from '../Revision/RevisionViewer';
```

**Remove import of `Revision` type** from models (line 6) — no longer needed for `viewingRevision` state. Keep the simpler import.

**State variables — Remove** (lines 54, 57):
```diff
-const [showRevisionPanel, setShowRevisionPanel] = useState(false);
-const [viewingRevision, setViewingRevision] = useState<Revision | null>(null);
```

**Handlers — Remove entirely:**
- `handleViewRevision` (lines 89-106) — fetched full revision with snapshot
- `handleViewPreview` (lines 108-168) — built preview snapshot, merged images, created pseudo-revision with `snapshot` property
- `handleCloseRevision` (line 170-172)

> The Preview button now no longer uses the snapshot-based RevisionViewer. It will need to be reimplemented separately if needed, but that's out of scope for this revision rework. The "Preview" button can remain but should be rewired to the PDF preview directly (or temporarily disabled).

**Layout JSX changes** (insert between `JobMetadataHeader` and `CommonNotes`, lines 322-327):

```diff
 <main className={styles['editor-main']}>
     <JobMetadataHeader checklist={activeChecklist} />
+
+    {/* ─── Revision Sections (descending order, newest first) ─── */}
+    {activeChecklist.revisions.length > 0 && (
+        <div className={styles['editor-revisions']}>
+            {activeChecklist.revisions
+                .sort((a, b) => b.number - a.number)
+                .map(revision => (
+                    <RevisionSection
+                        key={revision.id}
+                        revision={revision}
+                        revisionWorkgroups={activeChecklist.workgroups.filter(
+                            wg => wg.revisionId === revision.id
+                        )}
+                        originalWorkgroups={activeChecklist.workgroups.filter(
+                            wg => !wg.revisionId
+                        )}
+                        onRowChange={triggerAutoSave}
+                        filters={filters}
+                        expandTasks={expandTasks}
+                    />
+                ))}
+        </div>
+    )}
+
     <CommonNotes ... />
```

**Workgroup list** (lines 340-352) — filter out revision workgroups:
```diff
 <div className={styles['editor-workgroups']} id="checklist-print-content">
-    {activeChecklist.workgroups
+    {activeChecklist.workgroups
+        .filter(wg => !wg.revisionId)
         .filter(wg => filters.workgroupIds.length === 0 || filters.workgroupIds.includes(wg.id))
```

**FilterBar workgroups prop** (line 332) — pass only original workgroups:
```diff
 <FilterBar
     filters={filters}
     onFiltersChange={setFilters}
-    workgroups={activeChecklist.workgroups}
+    workgroups={activeChecklist.workgroups.filter(wg => !wg.revisionId)}
```

**Remove mobile revision panel** (lines 368-388):
```diff
-    {/* Mobile Actions */}
-    <div className={styles['editor-mobile-actions']}>
-        <Button ... onClick={() => setShowRevisionPanel(!showRevisionPanel)}>Revisions</Button>
-    </div>
-
-    {/* Mobile Revision Panel */}
-    {showRevisionPanel && (
-        <div className={styles['editor-mobile-revision']}>
-            <RevisionPanel checklistId={checklistId} onViewRevision={handleViewRevision} />
-        </div>
-    )}
```

**Remove revision viewer overlay** (lines 392-400):
```diff
-    {viewingRevision && (
-        <RevisionViewer revision={viewingRevision} onClose={handleCloseRevision} />
-    )}
```

**Update `ChecklistInfoDialog` usage** (line 263-267) — remove `onViewRevision`:
```diff
 <ChecklistInfoDialog
     checklist={activeChecklist}
-    onViewRevision={handleViewRevision}
     triggerClassName={styles['editor-action-btn']}
 />
```

**Preview button** (lines 284-293) — rewire or disable since it used snapshot logic. For now, keep the button but have it call `exportPdf` or show a toast:
```diff
 <Button
     className={styles['editor-action-btn']}
     appearance="subtle"
     icon={<Eye24Regular />}
-    onClick={handleViewPreview}
+    onClick={() => void exportPdf(activeChecklist)}
     disabled={isSaving}
     title="Preview Checklist"
 >
     Preview
 </Button>
```

---

#### [MODIFY] [ChecklistEditor.module.scss](file:///C:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/components/Editor/ChecklistEditor.module.scss)

**Add new class for revision section container:**
```scss
.editor-revisions {
    display: flex;
    flex-direction: column;
    gap: $spacing-3;
    margin-bottom: $spacing-4;
}
```

---

### 6. Sidebar Touch Points

#### [MODIFY] [ChecklistInfoDialog.tsx](file:///C:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/components/Editor/Sidebar/ChecklistInfoDialog.tsx)

**Remove `onViewRevision` prop** (line 28):
```diff
 interface ChecklistInfoDialogProps {
     checklist: Checklist;
-    onViewRevision: (revision: any) => void;
     triggerClassName?: string;
 }
```

**Remove `handleViewRevision` usage** (line 47) and the revision tab content that calls `onViewRevision`. The revision tab in the info dialog can now show a **read-only list** of revisions with their metadata (title, date, notes) since the actual editing happens inline.

If the revision tab had a `RevisionPanel` embedded, remove or simplify it.

#### [MODIFY] [CollaborationSidebar.tsx](file:///C:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/components/Editor/Sidebar/CollaborationSidebar.tsx)

**Remove `onViewRevision` prop** (line 33):
```diff
 interface CollaborationSidebarProps {
     checklist: Checklist;
-    onViewRevision: (revision: any) => void;
 }
```

Remove corresponding prop passing to child components.

---

### 7. Revision Panel Simplification

#### [MODIFY] [RevisionPanel.tsx](file:///C:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/components/Revision/RevisionPanel.tsx)

Simplify to be a **"Create Revision" dialog trigger** only:
- Keep the "Create Revision" button and dialog UI (title + notes inputs + submit)
- **Remove** the revision list rendering and `RevisionCard` usage
- **Remove** `onViewRevision` prop (line 25)
- The component can optionally be renamed to `CreateRevisionDialog` in a follow-up

This component will now be used **inside the editor header** (near the Save/Info buttons) as a simple dialog trigger button, rather than a sidebar panel.

**In `ChecklistEditor.tsx`**, add the Create Revision button to the header actions area (near line 260-315):
```tsx
<RevisionPanel checklistId={checklistId} />
```

---

### 8. File Deletions

#### [DELETE] [RevisionViewer.tsx](file:///C:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/components/Revision/RevisionViewer.tsx)
Full-screen snapshot overlay — no longer needed.

#### [DELETE] [RevisionViewer.module.scss](file:///C:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/components/Revision/RevisionViewer.module.scss)

#### [DELETE] [RevisionCard.tsx](file:///C:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/components/Revision/RevisionCard.tsx)
Replaced by `RevisionSection` header UI.

---

## Files Affected — Complete List

| # | File | Action | Lines Changed |
|---|------|--------|---------------|
| 1 | `models/index.ts` | MODIFY | ~5 lines (remove `snapshot`, add `revisionId?`) |
| 2 | `services/interfaces.ts` | MODIFY | ~5 lines (remove `getRevision`, add `revisionId?` param) |
| 3 | `services/dataverseRevisionService.ts` | MODIFY | ~80 lines removed (snapshot logic), ~30 lines simplified |
| 4 | `services/dataverseChecklistService.ts` | MODIFY | ~15 lines (interface + mappers + createWorkgroup) |
| 5 | `stores/checklistStore.ts` | MODIFY | ~30 lines removed (`restoreRevision`), ~30 lines added (`addRevisionWorkgroup`) |
| 6 | `components/Revision/RevisionSection.tsx` | **NEW** | ~120 lines |
| 7 | `components/Revision/RevisionSection.module.scss` | **NEW** | ~80 lines |
| 8 | `components/Editor/ChecklistEditor.tsx` | MODIFY | ~60 lines removed (snapshot handlers, viewer, mobile panel), ~25 lines added (inline revision sections) |
| 9 | `components/Editor/ChecklistEditor.module.scss` | MODIFY | ~5 lines (new `.editor-revisions` class) |
| 10 | `components/Revision/RevisionPanel.tsx` | MODIFY | Simplify to dialog-only (~50 lines removed) |
| 11 | `components/Editor/Sidebar/ChecklistInfoDialog.tsx` | MODIFY | ~10 lines (remove `onViewRevision` prop + handler) |
| 12 | `components/Editor/Sidebar/CollaborationSidebar.tsx` | MODIFY | ~5 lines (remove `onViewRevision` prop) |
| 13 | `components/Revision/RevisionViewer.tsx` | **DELETE** | Full file |
| 14 | `components/Revision/RevisionViewer.module.scss` | **DELETE** | Full file |
| 15 | `components/Revision/RevisionCard.tsx` | **DELETE** | Full file |

---

## Implementation Order

| Phase | Files | Rationale |
|-------|-------|-----------|
| **1. Models** | `models/index.ts` | Foundation — all other layers depend on these types |
| **2. Services** | `interfaces.ts`, `dataverseRevisionService.ts`, `dataverseChecklistService.ts` | Data layer must be correct before store/UI |
| **3. Store** | `checklistStore.ts` | Business logic layer — depends on services |
| **4. New Component** | `RevisionSection.tsx`, `RevisionSection.module.scss` | Build the new UI before wiring into editor |
| **5. Editor** | `ChecklistEditor.tsx`, `ChecklistEditor.module.scss` | Wire in new component, remove old snapshot UI |
| **6. Sidebar cleanup** | `ChecklistInfoDialog.tsx`, `CollaborationSidebar.tsx`, `RevisionPanel.tsx` | Remove stale `onViewRevision` plumbing |
| **7. Deletions** | `RevisionViewer.tsx`, `RevisionViewer.module.scss`, `RevisionCard.tsx` | Clean up dead code |
| **8. Build** | `npm run build` | Verify zero compilation errors |

---

## Verification Plan

### Build Verification
```bash
cd C:\Projects\PAP-CheckList-React\spfx\pap-checklist-spfx
npm run build
```
Must produce zero TypeScript errors and zero SCSS compilation errors.

### Functional Verification Checklist
| # | Test | Expected |
|---|------|----------|
| 1 | Open a checklist in the editor | Layout: `JobMetadataHeader` → Revision sections (if any) → `CommonNotes` → `FilterBar` → Workgroups |
| 2 | Create a revision via header button | Dialog appears → enter title/notes → submit → new `RevisionSection` appears at top (collapsed) |
| 3 | Expand a revision section | Shows notes, "Add workgroup" dropdown, and any existing revision workgroups |
| 4 | Add a workgroup to a revision | Select from dropdown → empty workgroup appears inside revision section |
| 5 | Add rows to a revision workgroup | Click "Add Row" → standard row creation (name, answer, notes, images) |
| 6 | Edit revision workgroup name/number | Click edit icon → change name → save → reflects immediately |
| 7 | Delete a revision workgroup | Click delete → confirmation → workgroup + rows removed from revision |
| 8 | Multiple revisions sorted descending | REV 3 above REV 2 above REV 1 |
| 9 | Original workgroups unaffected | Below CommonNotes, no `revisionId`, filterable via FilterBar |
| 10 | No snapshot overlay/viewer | No full-screen overlay, no "View Revision" snapshot loading |
| 11 | Build succeeds | `npm run build` → 0 errors |
