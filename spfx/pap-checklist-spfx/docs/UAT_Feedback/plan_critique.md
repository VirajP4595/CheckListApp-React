# Plan Critique – UAT Feedback Implementation

## 🟢 What's Good
- Clean separation of concerns: new services, store actions, UI components.
- Correct use of `@OData.Community.Display.V1.FormattedValue` for lookup display names.
- Config-driven group name and Flow URL — no hardcoding.
- Explicit cascade delete (safest approach).

---

## 🔴 Issues & Gaps

### 1. Delete Cascade — Race Conditions & Partial Failures
**Risk**: The plan says "delete all Rows → then Workgroups → then Checklist." If any middle request fails (network timeout, 403), we end up with orphaned records or a partially deleted checklist.

**Fix**: Wrap the cascade in a try/catch with rollback messaging. If deletion of Rows fails, abort and notify the user. Consider batching deletes using Dataverse `$batch` endpoint for atomicity.

---

### 2. Missing: Which Editor Component Gets the Archive/Delete Buttons?
**Gap**: The plan says "Editor toolbar" but doesn't specify the exact component. The toolbar is inside [ChecklistEditor.tsx](file:///c:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/components/Editor/ChecklistEditor.tsx) at lines 199-237 (the `editor-actions` div).

**Fix**: Specify `ChecklistEditor.tsx` → `editor-actions` div. Add the buttons after the Save button, with a visual separator.

---

### 3. Power Automate — Authentication Not Addressed
**Risk**: The Flow HTTP trigger URL may require authentication. SPFx `AadHttpClient` authenticates against Azure AD resources, but Power Automate HTTP triggers typically use either:
- Anonymous with a secret key in the URL, or
- Azure AD bearer token

**Fix**: Clarify with user. If the Flow URL contains a `sig` parameter (SAS-style), we can use `HttpClient` directly. If it needs Azure AD auth, we need `AadHttpClient` with the Flow's resource URI.

---

### 4. Job Dropdown in "Create Checklist" Dialog — Data Source
**Gap**: The create dialog needs a Job dropdown, but `getAllJobs()` currently only fetches `pap_jobid` and `pap_name`. We should also exclude Jobs that already have a checklist.

**Fix**: Either:
- Fetch all Jobs and filter client-side against `checklists` (already loaded), or
- Add a server-side `$filter` to exclude Jobs with existing checklists (if a nav property exists).

---

### 5. `WorkgroupSection` — Meeting Transcript Filter Placement
**Gap**: The plan says filter rows in `WorkgroupSection.tsx`, but this component receives `workgroup.rows` as a prop. The filtering should happen either:
- In the parent (`ChecklistEditor.tsx`) before passing rows, or
- Inside `WorkgroupSection`'s existing `filteredRows` useMemo (line 90-109).

**Fix**: Add the meeting-transcript filter to the existing `filteredRows` useMemo in `WorkgroupSection.tsx`. This is the cleanest spot — it already handles answer, review, and internal-only filters. However, `WorkgroupSection` doesn't currently have access to `checklist.jobDetails`. We need to pass `meetingOccurred` as a prop.

---

### 6. ChecklistEditor Sort Bug — Using `order` Not `number`
**Observation**: In `ChecklistEditor.tsx` line 263, workgroups are sorted by `.order`, but we changed `dataverseChecklistService.ts` to sort by `.number`. These will diverge if `order` ≠ `number` for any workgroup.

**Fix**: Change line 263 in `ChecklistEditor.tsx` from `.sort((a, b) => a.order - b.order)` to `.sort((a, b) => a.number - b.number)` for consistency.

---

### 7. Super Admin Check — Timing & Caching
**Risk**: `isSuperAdmin()` makes a SharePoint REST call. If called on every page load, it adds latency. If the user store loads before the SP group check resolves, components may briefly flash the wrong state.

**Fix**: 
- Cache the result in `sessionStorage` with a TTL (e.g., 5 minutes).
- Ensure `isSuperAdmin` defaults to `false` and buttons render only after the check completes (loading guard).

---

### 8. Due Date Urgency — Timezone Handling
**Risk**: Comparing `dueDate` to "today" across timezones can produce incorrect urgency indicators. Dataverse stores dates in UTC.

**Fix**: Use `new Date().setHours(0,0,0,0)` for the "today" comparison, and ensure `dueDate` is also normalized to midnight.

---

### 9. Archive — Dashboard Query Still Fetches Archived Items
**Gap**: `getAllChecklists()` doesn't filter by `statecode`. After archiving, the checklist would still appear in the API response unless we add `$filter=statecode eq 0`.

**Fix**: Add `$filter=statecode eq 0` to the `getAllChecklists()` query in `dataverseChecklistService.ts`.

---

### 10. Card UI Density — Too Many New Fields
**Risk**: Adding Lead Estimator, Reviewer, Due Date, Job Type, and status colors to an already dense card could make it cluttered and harder to scan.

**Fix**: Use a compact layout:
- Job Type as a small pill/badge in the header (not a full line).
- Due Date inline with the existing "Updated" date in the footer.
- Estimator/Reviewer as a single "Assigned: X | Review: Y" line.
- Consider a hover tooltip for secondary details if space is tight.

---

### 11. Plan Missing: `getChecklist()` Also Needs Updated `$expand`
**Gap**: The plan mentions updating `$expand` in `getAllChecklists()`, but `getChecklist()` (single checklist fetch) also expands Job fields (line 206). Both need updating.

**Fix**: Update `$expand` in both `getChecklist()` and `getAllChecklists()`.

---

### 12. Meeting-Transcript Filter — "Deferred" Flag Is Problematic
**Risk**: Defaulting `meetingOccurred` to `true` means the feature is effectively disabled until the flag source is implemented. This could ship as a no-op.

**Fix**: Add a clear TODO comment and consider adding a temporary manual toggle in the editor UI (e.g., a checkbox "Meeting occurred") that persists locally, so the feature can be tested before the Dataverse field is confirmed.

---

## 📋 Summary of Required Plan Updates

| # | Change |
|---|--------|
| 1 | Add `$batch` or error-handling strategy for cascade delete |
| 2 | Specify `ChecklistEditor.tsx` → `editor-actions` div for buttons |
| 3 | Clarify Power Automate auth mechanism |
| 4 | Handle "exclude Jobs with existing checklists" in create dialog |
| 5 | Pass `meetingOccurred` prop to `WorkgroupSection`, filter in `filteredRows` |
| 6 | Fix sort inconsistency in `ChecklistEditor.tsx` (use `number` not `order`) |
| 7 | Cache `isSuperAdmin` result with TTL |
| 8 | Normalize timezone for due date comparison |
| 9 | Add `statecode eq 0` filter to `getAllChecklists()` |
| 10 | Design compact card layout to avoid clutter |
| 11 | Update `$expand` in both `getChecklist()` AND `getAllChecklists()` |
| 12 | Add temporary toggle for `meetingOccurred` until Dataverse field is confirmed |
