# Plan Critique – UAT Feedback Implementation

**Last Updated**: 2026-03-27
**Status**: All actionable issues resolved or dropped by decision.

---

## 🟢 What's Good
- Clean separation of concerns: new services, store actions, UI components.
- Correct use of `@OData.Community.Display.V1.FormattedValue` for lookup display names.
- Config-driven group name and Flow URL — no hardcoding.
- Explicit cascade delete (safest approach).

---

## Issues & Gaps — Resolution Status

### 1. Delete Cascade — Race Conditions & Partial Failures
**Risk**: If any middle request fails (network timeout, 403), orphaned records are left with no feedback.

**Resolution**: ✅ **Fixed** — `deleteChecklist()` in `dataverseChecklistService.ts` now wrapped in `try/catch`. On failure, throws a user-facing error message indicating partial deletion may have occurred. Original error details preserved in the message.

---

### 2. Missing: Which Editor Component Gets the Archive/Delete Buttons?
**Gap**: Plan didn't specify exact component location.

**Resolution**: ⬛ **Dropped** — Archive button removed from scope. Delete button for super admins is implemented in `ChecklistEditor.tsx` `editor-actions` div (lines 222-235).

---

### 3. Power Automate — Authentication Not Addressed
**Risk**: Flow HTTP trigger may require Azure AD auth.

**Resolution**: ⬛ **Dropped** — EOD Estimator Activity Alert flow removed from scope entirely.

---

### 4. Job Dropdown in "Create Checklist" Dialog — Exclude Jobs with Existing Checklists
**Gap**: `AdhocChecklistDialog.tsx` shows all jobs regardless of existing checklists.

**Resolution**: ⬛ **Dropped** — Out of scope by decision.

---

### 5. `WorkgroupSection` — Meeting Transcript Filter Placement
**Gap**: `WorkgroupSection` needed access to `checklist.jobDetails.meetingOccurred`.

**Resolution**: ✅ **Fixed** — `meetingOccurred` passed as a prop to `WorkgroupSection`. Filtering applied inside the existing `filteredRows` useMemo (lines 93-102). Rows with name matching "From Meeting Transcript" are hidden when `meetingOccurred` is false.

---

### 6. ChecklistEditor Sort Bug — Using `order` Not `number`
**Observation**: Workgroups sorted by `.order` instead of `.number`, causing divergence.

**Resolution**: ✅ **Fixed** — `ChecklistEditor.tsx` line 337 now sorts by `.sort((a, b) => a.number - b.number)`.

---

### 7. Super Admin Check — Timing & Caching
**Risk**: `isSuperAdmin()` makes a SharePoint REST call on every load — latency + state flash risk.

**Resolution**: ✅ **Fixed** — Result cached in `sessionStorage` with 5-minute TTL in `userStore.ts`. Components guard on `isAdminChecked` loading flag before rendering super-admin actions.

---

### 8. Due Date Urgency — Timezone Handling
**Risk**: Comparing `dueDate` to "today" across timezones produces incorrect urgency indicators.

**Resolution**: ✅ **Fixed** — `ChecklistCard.tsx` lines 48-50 normalize both `today` and `dueDate` to midnight via `setHours(0, 0, 0, 0)`.

---

### 9. Archive — Dashboard Query Still Fetches Archived Items
**Gap**: `getAllChecklists()` didn't filter by `statecode`.

**Resolution**: ✅ **Fixed** — `dataverseChecklistService.ts` line 467 query includes `$filter=statecode eq 0`.

---

### 10. Card UI Density — Too Many New Fields
**Risk**: Dense card with Lead Estimator, Reviewer, Due Date, Job Type would be cluttered.

**Resolution**: ✅ **Fixed** — Compact layout implemented in `ChecklistCard.tsx`:
- Job Type as pill badge inline with job reference
- Due Date with urgency colour coding (overdue/warning/normal)
- Estimator/Reviewer as a single inline "Estimator: X | Reviewer: Y" line

---

### 11. Plan Missing: `getChecklist()` Also Needs Updated `$expand`
**Gap**: Plan only mentioned updating `getAllChecklists()` expand.

**Resolution**: ✅ **N/A** — The divergence is intentional. `getChecklist()` (line 267) includes extra editor-only QBE fields (`vin_buildarea`, `vin_qbeflagged`, `vin_qbelow`, `vin_qbehigh`, `vin_dmodelsuited`) not needed on dashboard cards. Both functions are correctly scoped.

---

### 12. Meeting-Transcript Filter — "Deferred" Flag Is Problematic
**Risk**: `meetingOccurred` defaulting to `true` ships the feature as a no-op.

**Resolution**: ⬛ **Dropped** — Manual toggle UI removed from scope. The feature reads `meetingOccurred` from the Dataverse `vin_jobstartmtg` field on the Job record. Filtering works correctly when the field is populated.

---

## Summary

| # | Issue | Status |
|---|-------|--------|
| 1 | Delete cascade error handling | ✅ Fixed |
| 2 | Archive/Delete button placement | ⬛ Dropped |
| 3 | Power Automate auth | ⬛ Dropped |
| 4 | Job dropdown filtering | ⬛ Dropped |
| 5 | Meeting transcript filter placement | ✅ Fixed |
| 6 | Workgroup sort inconsistency | ✅ Fixed |
| 7 | Super admin check caching | ✅ Fixed |
| 8 | Due date timezone normalization | ✅ Fixed |
| 9 | Archive statecode filter | ✅ Fixed |
| 10 | Card UI density | ✅ Fixed |
| 11 | `getChecklist()` $expand parity | ✅ N/A (intentional) |
| 12 | Meeting-transcript manual toggle | ⬛ Dropped |
