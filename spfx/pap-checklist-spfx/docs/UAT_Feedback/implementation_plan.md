# Implementation Plan – UAT Feedback

**Branch**: `feature/uat-feedback`  
**Last Updated**: 2026-03-01

---

## Goal

Enrich the checklist dashboard and editor with additional Job-table fields, role-based admin actions, and conditional row visibility. This plan incorporates all findings from the self-critique review.

---

## Implementation Order

| # | Feature | Estimated Effort |
|---|---------|-----------------|
| 1 | Discover Job table fields (temp service) | Small |
| 2 | Enrich cards with Job fields + status colors | Medium |
| 3 | Job Type dashboard filter | Small |
| 4 | Super Admin check + Archive/Delete | Large |
| 5 | Ad-hoc checklist creation via Power Automate | Medium |
| 6 | Meeting-transcript row hiding | Small |

---

## 1. Discover Job Table Fields

> **Purpose**: We don't know the exact logical names of all Job columns. This step fetches a real Job record and logs every field name.

#### [MODIFY] [dataverseJobService.ts](file:///c:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/services/dataverseJobService.ts)

**Add temporary `discoverJobFields()` method:**

```ts
async discoverJobFields(): Promise<Record<string, unknown>> {
    const response = await dataverseClient.get<{ value: DataverseJob[] }>(
        'pap_jobs',
        '$top=1'  // No $select — returns ALL columns
    );
    if (response.value.length > 0) {
        const job = response.value[0];
        console.log('[JobService] ALL JOB FIELDS:', JSON.stringify(Object.keys(job), null, 2));
        console.log('[JobService] FULL JOB DATA:', JSON.stringify(job, null, 2));
        return job;
    }
    return {};
}
```

**Output**: Save the discovered field names into `docs/UAT_Feedback/job_field_reference.md` for development reference.

**Cleanup**: Remove `discoverJobFields()` after field names are confirmed.

---

## 2. Enrich Cards with Job Fields + Status Colors

### 2a. Update Models

#### [MODIFY] [models/index.ts](file:///c:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/models/index.ts)

**Extend `Checklist.jobDetails`** (currently at line 109):

```ts
jobDetails?: {
    jobName: string;
    jobNumber: string;
    clientName: string;
    // ── NEW FIELDS ──
    leadEstimator?: string;    // Display name (from @OData FormattedValue)
    reviewer?: string;         // Display name (from @OData FormattedValue)
    dueDate?: Date;            // Job due date
    jobType?: string;          // Formatted optionset value (e.g., "Residential")
    meetingOccurred?: boolean; // Whether client meeting happened (deferred source)
};
```

### 2b. Update Dataverse Queries

#### [MODIFY] [dataverseChecklistService.ts](file:///c:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/services/dataverseChecklistService.ts)

> [!IMPORTANT]
> **Both** `getChecklist()` (line 206) **and** `getAllChecklists()` (line 324) have `$expand` clauses that must be updated identically.

**Update the `$expand` clause** (field names below are placeholders until Step 1 confirms them):

```ts
const expand = `pap_jobid($select=vin_name,_vin_account_value,vin_jobnumber,_vin_leadestimator_value,_vin_reviewer_value,vin_duedate,vin_jobtype,vin_meetingoccurred),createdby($select=fullname)`;
```

**Update `DataverseChecklist.pap_jobid` interface** (line 23-28):

```ts
pap_jobid?: {
    vin_name: string;
    _vin_account_value?: string;
    "_vin_account_value@OData.Community.Display.V1.FormattedValue"?: string;
    vin_jobnumber?: string;
    // ── NEW ──
    _vin_leadestimator_value?: string;
    "_vin_leadestimator_value@OData.Community.Display.V1.FormattedValue"?: string;
    _vin_reviewer_value?: string;
    "_vin_reviewer_value@OData.Community.Display.V1.FormattedValue"?: string;
    vin_duedate?: string;
    vin_jobtype?: number;
    "vin_jobtype@OData.Community.Display.V1.FormattedValue"?: string;
    vin_meetingoccurred?: boolean;
};
```

**Update `mapChecklist()` function** (line 153-157) and the inline mapping in `getChecklist()` (line 292-296):

```ts
const jobDetails = dv.pap_jobid ? {
    jobName: dv.pap_jobid.vin_name,
    jobNumber: dv.pap_jobid.vin_jobnumber || '',
    clientName: dv.pap_jobid["_vin_account_value@OData.Community.Display.V1.FormattedValue"] || '',
    // ── NEW ──
    leadEstimator: dv.pap_jobid["_vin_leadestimator_value@OData.Community.Display.V1.FormattedValue"] || '',
    reviewer: dv.pap_jobid["_vin_reviewer_value@OData.Community.Display.V1.FormattedValue"] || '',
    dueDate: dv.pap_jobid.vin_duedate ? new Date(dv.pap_jobid.vin_duedate) : undefined,
    jobType: dv.pap_jobid["vin_jobtype@OData.Community.Display.V1.FormattedValue"] || '',
    meetingOccurred: dv.pap_jobid.vin_meetingoccurred ?? true  // Default true until confirmed
} : undefined;
```

**Add `statecode` filter to `getAllChecklists()`** (line 328) to exclude archived checklists:

```ts
// BEFORE:
`$select=${select}&$expand=${expand}&$orderby=modifiedon desc&$top=50`

// AFTER:
`$select=${select}&$expand=${expand}&$filter=statecode eq 0&$orderby=modifiedon desc&$top=50`
```

### 2c. Update Card UI

#### [MODIFY] [ChecklistCard.tsx](file:///c:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/components/Dashboard/ChecklistCard.tsx)

**Card layout with new fields:**

```
┌──────────────────────────────────────────────┐
│ 🟢 [Status Border]                          │
│  Job Ref                    [Job Type Badge] │
│  Checklist Title                             │
│──────────────────────────────────────────────│
│  Status: ● Draft    REV 0                    │
│  Client: Acme Corp                           │
│  Job: 12345 - Building Extension             │
│  Type: Residential                           │
│──────────────────────────────────────────────│
│  Due: 15 Mar 2026  ⚠️               │
│  Estimator: J. Smith  |  Reviewer: A. Jones  │
│  Updated 1 Mar 2026                          │
└──────────────────────────────────────────────┘
```

**Due date urgency helper** (add to `ChecklistCard.tsx`):

```ts
const getDueDateUrgency = (dueDate?: Date): { label: string; className: string } | null => {
    if (!dueDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);  // Normalize timezone
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { label: `Overdue by ${Math.abs(diffDays)}d`, className: 'due-overdue' };
    if (diffDays <= 3) return { label: `Due in ${diffDays}d`, className: 'due-urgent' };
    return { label: formatDate(dueDate), className: 'due-normal' };
};
```

#### [MODIFY] [Dashboard.module.scss](file:///c:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/components/Dashboard/Dashboard.module.scss)

**Add status-based card borders:**

```scss
.checklist-card {
    border-left: 4px solid transparent;
    transition: border-color 0.2s ease;

    &--status-draft      { border-left-color: #8a8886; }
    &--status-in-review  { border-left-color: #ff8c00; }
    &--status-final      { border-left-color: #107c10; }
}
```

**Add due-date urgency styles:**

```scss
.due-overdue { color: #d13438; font-weight: 600; }
.due-urgent  { color: #ff8c00; font-weight: 500; }
.due-normal  { color: #616161; }
```

**Add job-type badge:**

```scss
.job-type-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 500;
    background: #f0f0f0;
    color: #424242;
}
```

### 2d. Fix Sort Inconsistency

#### [MODIFY] [ChecklistEditor.tsx](file:///c:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/components/Editor/ChecklistEditor.tsx)

**Line 263**: Change sort from `order` to `number` for consistency with the service layer:

```diff
- .sort((a, b) => a.order - b.order)
+ .sort((a, b) => a.number - b.number)
```

---

## 3. Job Type Dashboard Filter

#### [MODIFY] [DashboardFilterBar.tsx](file:///c:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/components/Dashboard/DashboardFilterBar.tsx)

**Update `DashboardFilterState` interface** (line 21):

```ts
export interface DashboardFilterState {
    search: string;
    selectedJobIds: string[];
    selectedClientNames: string[];
    selectedJobTypes: string[];    // ← NEW
    selectedStatuses: ChecklistStatus[];
    sort: SortParams;
}
```

**Add `JobTypeFilter` component** (same searchable menu pattern as `ClientFilter`):

```ts
const JobTypeFilter: React.FC<{
    checklists: Checklist[];
    selectedTypes: string[];
    onChange: (types: string[]) => void;
}> = ({ checklists, selectedTypes, onChange }) => {
    // Extract unique job types from checklists
    const jobTypeOptions = useMemo(() => {
        const types = new Set<string>();
        checklists.forEach(c => {
            if (c.jobDetails?.jobType) types.add(c.jobDetails.jobType);
        });
        return Array.from(types).sort();
    }, [checklists]);
    // ... same search + menu pattern as ClientFilter
};
```

**Add to filter bar JSX** (after ClientFilter, before Status).

**Update `clearFilters()`**: Reset `selectedJobTypes: []`.

**Update `hasActiveFilters`**: Include `filters.selectedJobTypes.length > 0`.

#### [MODIFY] [Dashboard.tsx](file:///c:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/components/Dashboard/Dashboard.tsx)

**Initialize** `selectedJobTypes: []` in filter state.

**Add filtering logic** in `filteredChecklists` useMemo:

```ts
// Filter by Job Type
if (filters.selectedJobTypes?.length > 0) {
    result = result.filter(c =>
        c.jobDetails?.jobType && filters.selectedJobTypes.includes(c.jobDetails.jobType)
    );
}
```

---

## 4. Super Admin – Archive & Delete

### 4a. Configuration

#### [MODIFY] [environment.ts](file:///c:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/config/environment.ts)

```ts
export const AppConfig = {
    dataverse: { /* existing */ },
    sharepoint: { /* existing */ },
    // ── NEW ──
    admin: {
        superAdminGroup: "SP_Checklist_SuperAdmin",
    },
    powerAutomate: {
        createChecklistFlowUrl: "",  // User will populate
    }
};
```

### 4b. SharePoint Group Service

#### [NEW] [sharePointGroupService.ts](file:///c:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/services/sharePointGroupService.ts)

```ts
import { SPHttpClient } from '@microsoft/sp-http';
import { WebPartContext } from '@microsoft/sp-webpart-base';
import { AppConfig } from '../config/environment';

let _context: WebPartContext | null = null;
let _cachedResult: boolean | null = null;
let _cacheTimestamp: number = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function initGroupService(context: WebPartContext) {
    _context = context;
}

export async function isSuperAdmin(): Promise<boolean> {
    // Return cached result if fresh
    if (_cachedResult !== null && (Date.now() - _cacheTimestamp) < CACHE_TTL_MS) {
        return _cachedResult;
    }

    if (!_context) throw new Error('Group service not initialized');

    const groupName = AppConfig.admin.superAdminGroup;
    const url = `${_context.pageContext.web.absoluteUrl}/_api/web/sitegroups/getbyname('${groupName}')/CanCurrentUserViewMembership`;

    try {
        // If user is in the group, this succeeds.
        // Alternative: check /Users endpoint for the current user.
        const userUrl = `${_context.pageContext.web.absoluteUrl}/_api/web/sitegroups/getbyname('${encodeURIComponent(groupName)}')/Users?$filter=Id eq ${_context.pageContext.legacyPageContext.userId}`;
        const response = await _context.spHttpClient.get(userUrl, SPHttpClient.configurations.v1);
        const data = await response.json();

        _cachedResult = data.value && data.value.length > 0;
        _cacheTimestamp = Date.now();
        return _cachedResult;
    } catch (err) {
        console.warn('[GroupService] Failed to check super admin status:', err);
        _cachedResult = false;
        _cacheTimestamp = Date.now();
        return false;
    }
}
```

> **Critique fix applied**: Result is cached in memory with 5-minute TTL. Defaults to `false` on error.

### 4c. User Store

#### [MODIFY] [userStore.ts](file:///c:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/stores/userStore.ts)

```ts
interface UserState {
    user: UserContext | null;
    isSuperAdmin: boolean;       // ← NEW
    isAdminChecked: boolean;     // ← NEW (loading guard)
    isLoading: boolean;
    setUser: (user: UserContext | null) => void;
    setSuperAdmin: (val: boolean) => void;
    loadUser: () => Promise<void>;
}

export const useUserStore = create<UserState>((set) => ({
    user: null,
    isSuperAdmin: false,
    isAdminChecked: false,
    isLoading: false,
    setUser: (user) => set({ user }),
    setSuperAdmin: (val) => set({ isSuperAdmin: val, isAdminChecked: true }),
    loadUser: async () => {
        set({ isLoading: true });
        set({ isLoading: false });
    },
}));
```

> **Critique fix applied**: `isAdminChecked` acts as a loading guard — components don't render admin buttons until this is `true`.

### 4d. Checklist Store — Archive & Delete Actions

#### [MODIFY] [checklistStore.ts](file:///c:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/stores/checklistStore.ts)

**Add `archiveChecklist` action:**

```ts
archiveChecklist: async (id: string) => {
    try {
        // Soft-delete: set statecode to inactive
        await dataverseClient.update(entities.checklists, id, { statecode: 1 });
        // Remove from local state
        set(state => ({
            checklists: state.checklists.filter(c => c.id !== id),
            activeChecklist: state.activeChecklist?.id === id ? null : state.activeChecklist,
        }));
    } catch (err) {
        console.error('[Store] Archive failed:', err);
        throw err;
    }
}
```

**Add `deleteChecklist` action with explicit cascade:**

```ts
deleteChecklist: async (id: string) => {
    try {
        // 1. Get all workgroups for this checklist
        const wgResponse = await dataverseClient.get<{ value: { pap_workgroupid: string }[] }>(
            entities.workgroups,
            `$filter=_pap_checklistid_value eq ${id}&$select=pap_workgroupid`
        );
        const workgroupIds = wgResponse.value.map(wg => wg.pap_workgroupid);

        // 2. Delete all rows for each workgroup
        if (workgroupIds.length > 0) {
            const rowFilter = workgroupIds.map(wgId => `_pap_workgroupid_value eq ${wgId}`).join(' or ');
            const rowResponse = await dataverseClient.get<{ value: { pap_checklistrowid: string }[] }>(
                entities.checklistrows,
                `$filter=${rowFilter}&$select=pap_checklistrowid`
            );

            for (const row of rowResponse.value) {
                await dataverseClient.delete(entities.checklistrows, row.pap_checklistrowid);
            }
        }

        // 3. Delete all workgroups
        for (const wgId of workgroupIds) {
            await dataverseClient.delete(entities.workgroups, wgId);
        }

        // 4. Delete the checklist itself
        await dataverseClient.delete(entities.checklists, id);

        // 5. Remove from local state
        set(state => ({
            checklists: state.checklists.filter(c => c.id !== id),
            activeChecklist: state.activeChecklist?.id === id ? null : state.activeChecklist,
        }));
    } catch (err) {
        console.error('[Store] Delete failed at some step — partial deletion may have occurred:', err);
        throw err;  // Caller should show error to user
    }
}
```

> **Critique fix applied**: Error is caught and re-thrown so the UI can display a warning about partial deletion.

### 4e. Editor UI — Archive/Delete Buttons

#### [MODIFY] [ChecklistEditor.tsx](file:///c:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/components/Editor/ChecklistEditor.tsx)

**Location**: `editor-actions` div (lines 199-237), after the Save button.

**Add imports:**

```ts
import { Archive24Regular, Delete24Regular } from '@fluentui/react-icons';
import { Dialog, DialogTrigger, DialogSurface, DialogTitle, DialogBody, DialogContent, DialogActions } from '@fluentui/react-components';
import { useUserStore } from '../../stores';
```

**Add state & handlers:**

```ts
const { isSuperAdmin, isAdminChecked } = useUserStore();
const { archiveChecklist, deleteChecklist } = useChecklistStore();
const [showArchiveDialog, setShowArchiveDialog] = useState(false);
const [showDeleteDialog, setShowDeleteDialog] = useState(false);
const [isDeleting, setIsDeleting] = useState(false);

const handleArchive = async () => {
    setIsDeleting(true);
    try {
        await archiveChecklist(checklistId);
        onBack(); // Navigate to dashboard
    } catch { /* show error toast */ }
    finally { setIsDeleting(false); }
};

const handleDelete = async () => {
    setIsDeleting(true);
    try {
        await deleteChecklist(checklistId);
        onBack();
    } catch { /* show error toast — warn about partial deletion */ }
    finally { setIsDeleting(false); }
};
```

**Add JSX** (inside `editor-actions`, after Save button):

```tsx
{isAdminChecked && isSuperAdmin && (
    <>
        <div className={styles['editor-action-divider']} />
        <Button
            appearance="subtle"
            icon={<Archive24Regular />}
            onClick={() => setShowArchiveDialog(true)}
            disabled={isDeleting}
            title="Archive Checklist"
        >
            Archive
        </Button>
        <Button
            appearance="subtle"
            icon={<Delete24Regular />}
            onClick={() => setShowDeleteDialog(true)}
            disabled={isDeleting}
            style={{ color: '#d13438' }}
            title="Permanently Delete"
        >
            Delete
        </Button>
    </>
)}
```

**Confirmation Dialogs**: Archive gets a simple "Are you sure?" dialog. Delete gets a stronger warning: *"This will permanently remove this checklist, all workgroups, and all items. This action cannot be undone."*

---

## 5. Ad-hoc Checklist Creation (Super Admin)

#### [NEW] [powerAutomateService.ts](file:///c:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/services/powerAutomateService.ts)

```ts
import { AppConfig } from '../config/environment';

export async function triggerCreateChecklist(
    jobId: string,
    checklistName: string,
    createdByEmail: string
): Promise<void> {
    const url = AppConfig.powerAutomate.createChecklistFlowUrl;
    if (!url) throw new Error('Power Automate Flow URL not configured');

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, checklistName, createdByEmail })
    });

    if (!response.ok) {
        throw new Error(`Flow trigger failed: ${response.status} ${response.statusText}`);
    }
}
```

> **Note**: Power Automate HTTP triggers with SAS key in URL work with plain `fetch()`. No Azure AD auth needed.

#### [MODIFY] [Dashboard.tsx](file:///c:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/components/Dashboard/Dashboard.tsx)

**Add "Create Checklist" button** in the header area, visible only when `isSuperAdmin && isAdminChecked`:

- Opens a `Dialog` with:
  - **Job dropdown**: Use existing `JobFilter` pattern, but single-select. Exclude Jobs that already have a checklist in the loaded list (client-side filter against `checklists.map(c => c.jobDetails?.jobName)`).
  - **Checklist name**: Text input.
- On submit: Call `triggerCreateChecklist()`, close dialog, show `MessageBar` toast: *"Checklist creation in progress. Please check back in ~10 minutes."*

---

## 6. Hide Meeting-Transcript Rows

#### [MODIFY] [WorkgroupSection.tsx](file:///c:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/components/Editor/WorkgroupSection.tsx)

**Add `meetingOccurred` prop:**

```ts
interface WorkgroupSectionProps {
    workgroup: Workgroup;
    onRowChange: () => void;
    filters?: FilterState;
    isCollapsed?: boolean;
    expandTasks?: boolean;
    meetingOccurred?: boolean;  // ← NEW
}
```

**Update `filteredRows` useMemo** (line 90-109) to include the transcript filter:

```ts
const filteredRows = useMemo(() => {
    return workgroup.rows.filter(row => {
        // ── NEW: Hide transcript rows if meeting didn't occur ──
        if (meetingOccurred === false) {
            if (row.name.toLowerCase().includes('meeting transcript')) {
                return false;
            }
        }

        // Existing filters...
        if (filters?.answerStates && filters.answerStates.length > 0) { /* ... */ }
        if (filters?.markedForReview !== null && filters?.markedForReview !== undefined) { /* ... */ }
        if (filters?.internalOnly !== null && filters?.internalOnly !== undefined) { /* ... */ }
        return true;
    });
}, [workgroup.rows, filters, meetingOccurred]);
```

#### [MODIFY] [ChecklistEditor.tsx](file:///c:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/components/Editor/ChecklistEditor.tsx)

**Pass `meetingOccurred` to each `WorkgroupSection`** (line 265-272):

```tsx
<WorkgroupSection
    key={workgroup.id}
    workgroup={workgroup}
    onRowChange={triggerAutoSave}
    filters={filters}
    isCollapsed={!expandWorkgroups}
    expandTasks={expandTasks}
    meetingOccurred={activeChecklist.jobDetails?.meetingOccurred}  // ← NEW
/>
```

> **Critique fix applied**: Defaults to `true` (show all rows) when `meetingOccurred` is undefined.

---

## Initialization Checklist

The Super Admin check and group service need to be initialized during app startup.

#### [MODIFY] [PapChecklistWebPart.ts](file:///c:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/webparts/papChecklist/PapChecklistWebPart.ts)

During `onInit()` or `render()`, after initializing `dataverseClient`:

```ts
import { initGroupService, isSuperAdmin } from '../../services/sharePointGroupService';
import { useUserStore } from '../../stores';

// In render or onInit:
initGroupService(this.context);
isSuperAdmin().then(isAdmin => {
    useUserStore.getState().setSuperAdmin(isAdmin);
});
```

---

## Files Changed Summary

| Action | File | Section |
|--------|------|---------|
| MODIFY | `config/environment.ts` | Add `admin.superAdminGroup`, `powerAutomate.createChecklistFlowUrl` |
| MODIFY | `models/index.ts` | Extend `jobDetails` with 5 new fields |
| MODIFY | `services/dataverseJobService.ts` | Temp `discoverJobFields()` method |
| MODIFY | `services/dataverseChecklistService.ts` | Update `$expand` in both queries, update mappers, add `statecode` filter |
| NEW | `services/sharePointGroupService.ts` | Super Admin check with 5min cache |
| NEW | `services/powerAutomateService.ts` | Flow trigger for ad-hoc creation |
| MODIFY | `stores/userStore.ts` | Add `isSuperAdmin`, `isAdminChecked` |
| MODIFY | `stores/checklistStore.ts` | Add `archiveChecklist()`, `deleteChecklist()` |
| MODIFY | `components/Dashboard/ChecklistCard.tsx` | New fields, status border, due date urgency |
| MODIFY | `components/Dashboard/Dashboard.module.scss` | Status borders, urgency colors, badge styles |
| MODIFY | `components/Dashboard/DashboardFilterBar.tsx` | Add `JobTypeFilter` + state |
| MODIFY | `components/Dashboard/Dashboard.tsx` | Job Type filter logic, Create button, dialog |
| MODIFY | `components/Editor/ChecklistEditor.tsx` | Archive/Delete buttons, sort fix, pass meetingOccurred |
| MODIFY | `components/Editor/WorkgroupSection.tsx` | `meetingOccurred` prop, transcript row filter |
| MODIFY | `webparts/papChecklist/PapChecklistWebPart.ts` | Init group service, set admin state |

---

## Verification Plan

| # | Test | Expected Result |
|---|------|-----------------|
| 1 | Load dashboard | Cards show Lead Estimator, Reviewer, Due Date, Job Type |
| 2 | Card with Draft status | Grey left border |
| 3 | Card with In Review status | Amber left border |
| 4 | Card with Final status | Green left border |
| 5 | Card with overdue Due Date | Red text, "Overdue by Xd" |
| 6 | Card with Due Date in 2 days | Amber text, "Due in 2d" |
| 7 | Select Job Type filter | Only matching checklists shown |
| 8 | Clear all filters | All checklists visible again |
| 9 | Login as Super Admin | Archive + Delete buttons visible in editor |
| 10 | Login as regular user | Archive + Delete buttons NOT visible |
| 11 | Archive a checklist | Confirmation → removed from dashboard → card gone |
| 12 | Delete a checklist | Strong confirmation → all children deleted → card gone |
| 13 | Partial delete failure | Error message shown, user advised to check Dataverse |
| 14 | Create Checklist (Super Admin) | Dialog shows → Job dropdown + name → toast shown |
| 15 | Create Checklist (regular user) | Button not visible |
| 16 | Open checklist where meeting didn't occur | Rows with "Meeting Transcript" hidden |
| 17 | Open checklist where meeting occurred (or unknown) | All rows visible |
