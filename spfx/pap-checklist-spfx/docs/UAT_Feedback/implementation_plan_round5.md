# Implementation Plan — Round 5 + Round 4 Change 1 (Power Automate)

**Date:** 20 May 2026
**Source:** Client meeting notes PDF (19/05/26) + Round 4 deferral of Change 1

---

## Overview

This plan covers:
- **Round 4 Change 1** (revised): FQE revision auto-create now done via Power Automate — remove the in-app banner
- **Round 5 Changes 1–9** from client PDF: date stamps, compact layout, renamed labels, chat overhaul, PDF landscape, TBC rename, Teams notifications

All Round 4 items (BUG 1–5, Changes 2–7) are already implemented and committed.

---

## Status Overview

| Item | Status |
|---|---|
| R4 BUG 1–5 + Changes 2–7 | ✅ Implemented |
| R4 Change 1 (FQE banner → Power Automate) | 🔲 To implement (remove banner) |
| R5 Changes 1–9 | 🔲 To implement |

---

## Round 4 Change 1 — FQE Revision Auto-Create via Power Automate

**Context:** Previously planned as an in-app detection banner that fires when `fqeRevisionNumber > currentRevisionNumber`. Client now wants this done server-side via Power Automate with no in-app banner.

### App Changes — Remove In-App Banner

**File: `src/components/Editor/ChecklistEditor.tsx`**
- Remove `fqeBannerDismissed` and `fqeBannerCreating` state variables
- Remove `handleFqeCreateRevision` function
- Remove `showFqeBanner` computed value
- Remove the FQE banner JSX block (amber div with "FQE Revision N detected" text + Create Revision + Dismiss buttons)
- Keep `vin_revisionnumber` in the data fetching (useful for informational display later)

**File: `src/components/Editor/ChecklistEditor.module.scss`**
- Remove `.fqe-revision-banner` style block

### Power Automate Flow Spec (for client admin to build)

Trigger: **Dataverse — When a row is modified** on `vin_job` table, filter when `vin_revisionnumber` changes

Steps:
1. Get the linked `pap_checklist` record(s) where `_pap_jobid_value = triggerRow.vin_jobid`
2. For each checklist: if `vin_revisionnumber > pap_currentrevisionnumber`, create a `pap_revision` record:
   - `pap_checklistid` → checklist ID
   - `pap_name` → `"FQE Revision {vin_revisionnumber}"`
   - `pap_summary` → `"Auto-created from FQE revision update"`
   - `pap_revisionnumber` → `vin_revisionnumber`

No new app code needed — the existing `createRevision` Dataverse service already creates the revision record correctly.

---

## R5-CHANGE-1 — Auto Date Stamp on General Notes

**Context:** When a new General Notes entry is created, it should automatically get a timestamp so users know when it was written.

### Model Change
**File: `src/models/index.ts`**
- Add `createdAt?: Date` to `CommonNoteSection` interface

### UI Change
**File: `src/components/Editor/Sidebar/CommonNotes.tsx`**
- In `handleAddSection`: add `createdAt: new Date()` to the new section object
- In the section header render: display the date (e.g., `"Added 20 May 2026"`) in a small muted span to the right of the section title
- Existing sections without `createdAt` display nothing (graceful fallback)
- No Dataverse column change — CommonNotes are stored as JSON blob in `pap_commonnotes`

---

## R5-CHANGE-2 — Compact Layout + Filter Bar Repositioned

**Context:** Client wants to see more information on screen without scrolling. The Filter Bar should move to the top of the main content area (above Job Details), and the overall UI should shed excess padding/spacing.

### Filter Bar Reposition
**File: `src/components/Editor/ChecklistEditor.tsx`**
- Move `<FilterBar>` to render **before** `<JobMetadataHeader>` in the JSX (currently it renders after, around line 360)
- Add `position: sticky; top: 0; z-index: 10` to `.editor-filter-bar` so it stays visible while scrolling

**File: `src/components/Editor/ChecklistEditor.module.scss`**
- Add sticky positioning + subtle background/shadow to the filter bar wrapper

### Compactness — Editor Layout
**File: `src/components/Editor/ChecklistEditor.module.scss`**
- Reduce `container` mixin's horizontal padding (or override directly in `.editor-main`)
- Reduce gap between major sections (revisions, notes, workgroups) from `$spacing-6` toward `$spacing-3`

**File: `src/components/Editor/WorkgroupSection.module.scss`**
- Reduce workgroup card padding (top/bottom) by ~30%
- Tighten the workgroup header height

**File: `src/components/Editor/ChecklistRowItem.module.scss`**
- Reduce row padding from current value to `$spacing-2` top/bottom
- Tighten collapsed row height

**File: `src/components/Editor/Sidebar/JobMetadataHeader.module.scss`**
- Reduce `.job-metadata` card padding from `1.25rem 1.5rem` to `0.75rem 1rem`
- Reduce grid gap

---

## R5-CHANGE-3 — Revisions Above General Notes

**Context:** Currently the order in the main editor content is: Job Details → Filter Bar → General Notes → Revisions → Workgroups. Client wants Revisions before General Notes.

**File: `src/components/Editor/ChecklistEditor.tsx`**
- Swap the render order: place the Revisions section before the `<CommonNotes>` block
- Final order: Filter Bar (sticky) → Job Details → Revisions → General Notes → Workgroups

---

## R5-CHANGE-4 — Remove Workgroup Chat + Enhance Global Chat (Unread Badge + Thumbs-Up)

**Context:** Remove the per-workgroup chat popup. The global sidebar chat (ChecklistChat) already exists and uses `checklist.comments` stored in Dataverse `pap_chatdata`. Enhance it with: unread message count badge on the Chat tab, and per-message thumbs-up reactions.

### Remove Workgroup Chat
**File: `src/components/Editor/WorkgroupSection.tsx`**
- Remove the `<WorkgroupChatDialog>` render and `showChat` state (lines ~252–270)
- Remove the chat Tooltip/Button from the workgroup actions header
- Remove `import WorkgroupChatDialog` and `import { Chat20Regular }` if no longer used

**File: `src/components/Editor/WorkgroupSection.module.scss`**
- Remove `.workgroup-chat-btn`, `.chat-icon-wrapper`, `.chat-badge` styles

Note: `WorkgroupChatDialog.tsx` can be left in place unused for now (removed in a future cleanup).

### Extend ChecklistComment Model
**File: `src/models/index.ts`**
- Add `likes?: string[]` to `ChecklistComment` (array of user display names who have liked/reacted)

### Enhance ChecklistChat Component
**File: `src/components/Editor/Sidebar/ChecklistChat.tsx`**
- Add thumbs-up button on each message: clicking adds/removes the current user from `msg.likes`
- Show like count and a list of who liked (tooltip on hover)
- Call `onUpdate({ comments: updatedComments })` then `onSave()` to persist

**Unread tracking (localStorage — no Dataverse change needed):**
- Key: `chat_lastread_${checklistId}_${userId}`
- When Chat tab is opened/focused: write current timestamp to localStorage
- Unread count = messages where `createdAt > lastReadTimestamp`

### Chat Tab Badge
**File: `src/components/Editor/Sidebar/CollaborationSidebar.tsx`**
- Compute `unreadCount` from `checklist.comments` vs localStorage last-read timestamp
- Display a red pill badge on the Chat tab icon when `unreadCount > 0`

---

## R5-CHANGE-5 — Remove Notify Admin + BTC Flags from Estimator/Reviewer Rows

**Context:** These flags should only be available for Client/Checklist rows, not Estimator or Reviewer rows.

**File: `src/components/Editor/ChecklistRowItem.tsx`**
- Wrap the Notify Admin button in `{row.section !== 'estimator' && row.section !== 'reviewer' && (...)}`
- Wrap the BTC button in the same condition
- These flags remain on client rows and continue to work normally

---

## R5-CHANGE-6 — Rename Section Labels + "Answers" → "Key"

**Context:** Client wants clearer terminology across the app.

### Section label renames
**File: `src/components/Editor/WorkgroupSection.tsx`**
- `"Client Checklist"` → `"Client/Checklist Notes"`
- `"Estimator Checklist"` → `"Estimator Notes"`
- `"Reviewers Checklist"` → `"Reviewer Notes"`

**File: `src/components/Revision/RevisionViewer.tsx`**
- `"Checklist Filler / Client"` → `"Client/Checklist Notes"`
- `"Estimator"` → `"Estimator Notes"`

### "Answers" → "Key"
Search codebase for UI-facing `"Answers"` / `"Answer"` strings in:
- `FilterBar.tsx` — answer state filter dropdown label
- `ChecklistRowItem.tsx` — any answer state label
- `RevisionViewer.tsx` — section header labels
- `PdfGeneratorService.ts` — any "Answer" column heading

Replace all user-facing occurrences with `"Key"`. Keep internal variable names (`answer`, `answerState`, `AnswerState`) unchanged.

---

## R5-CHANGE-7 — PDF: Landscape Layout + Image Captions + RFQ Line Items Table

**Context:** Current portrait PDF is too long for large jobs. Switch to landscape A4, add image captions, and render the currently missing RFQ line items table.

### Landscape Layout
**File: `src/services/PdfGeneratorService.ts`**
- Change orientation to `'landscape'`
- Page dimensions: `pageW = 297mm, pageH = 210mm`
- Recalculate margin, content width, and column positions throughout

### New Landscape Row Layout (3-column)
```
| Key badge (25mm) | Item Name + Notes (120mm) | Images (~120mm remaining) |
```
- Column 1 (25mm): Answer/Key badge pill, vertically centered
- Column 2 (120mm): Item name (bold), notes text below in smaller font with section colour
- Column 3 (remaining): Inline images, max 35mm height each, 2 per row side-by-side if space allows

### Image Captions
- If `img.caption` is non-empty, print caption text below the image in 7pt italic grey (`#888888`)

### RFQ Line Items Table
- When `row.answer === 'RFQ'` and `row.rfqLineItems?.length > 0`, render a compact table in column 3:
  - Columns: Item No. | Description | Qty | Unit
  - Header row: light blue background `#e3f2fd`, 8pt bold
  - Data rows: alternating white/`#f8f8f8`, 8pt regular
- Supplier name/email block renders above the line items table

---

## R5-CHANGE-8 — Rename TBC → "Confirmation Required" + Red Row Styling

**Context:** "TBC" is replaced with "Confirmation Required" as the display label. Rows with this answer highlight red automatically.

### Label Change
**File: `src/models/index.ts`**
- `ANSWER_CONFIG['TBC'].label`: `'TBC'` → `'Confirmation Required'`
- `ANSWER_CONFIG['TBC'].description`: `'To Be Confirmed'` → `'Confirmation Required'`
- Internal `AnswerState` key stays `'TBC'` — no Dataverse changes

### Red Row Styling
**File: `src/components/Editor/ChecklistRowItem.tsx`**
- Add `row.answer === 'TBC' ? styles['row--confirmation-required'] : ''` to the outer row div

**File: `src/components/Editor/ChecklistRowItem.module.scss`**
```scss
.row--confirmation-required {
    background: rgba(#a4262c, 0.06);
    border-left: 3px solid #a4262c;
}
```

RevisionViewer's `getAnswerStyle` reads from `ANSWER_CONFIG` — label update propagates automatically.

---

## R5-CHANGE-9 — Teams Notification When Notify Admin is Toggled

**Context:** When an estimator toggles Notify Admin ON on a row, post an Adaptive Card to the admin Teams channel via Power Automate.

### App Changes
**File: `src/config/environment.ts`**
- Add `notifyAdminTeamsFlowUrl: ""` (populated by client admin after creating the PA flow)

**File: `src/components/Editor/ChecklistRowItem.tsx`**
- In `handleToggleNotify`, when toggling ON: fire-and-forget `fetch(env.notifyAdminTeamsFlowUrl, { method: 'POST', body: JSON.stringify({ checklistTitle, workgroupName, rowName, rowNotes, estimator: currentUser }) })`
- Skip if `notifyAdminTeamsFlowUrl` is empty; log errors to console only

### Power Automate Flow Spec (client admin to build)
- Trigger: HTTP request (same pattern as existing `createChecklistFlowUrl`)
- Body: `{ checklistTitle, workgroupName, rowName, rowNotes, estimator }`
- Action: Post Adaptive Card to admin Teams channel with row details + deep-link button

---

## Deferred

- **Chat @mention → Teams DM** — Parse `@Name` in ChecklistChat and trigger PA flow to DM the mentioned user. Deferred to a future round.

---

## Feasibility Notes

| Item | Risk | Notes |
|---|---|---|
| R4-C1 | Low (app) | Removes banner only; PA flow built by client admin |
| R5-C1 | Low | JSON blob field addition — non-breaking |
| R5-C2 | Medium | Visual regression risk; test multiple screen sizes |
| R5-C3 | Low | 2-line JSX reorder |
| R5-C4 | Medium | localStorage unread tracking is simple; thumbs-up extends existing model |
| R5-C5 | Low | Conditional render around existing buttons |
| R5-C6 | Low | String-only changes; internals untouched |
| R5-C7 | High | Full PDF layout refactor — most complex item in this round |
| R5-C8 | Low | Config label + one CSS class |
| R5-C9 | Medium | Trivial app-side; PA flow needed from client |

---

## Critical Files Summary

| File | Changes |
|---|---|
| `src/components/Editor/ChecklistEditor.tsx` | Remove FQE banner; reorder Revisions/Notes; reposition FilterBar |
| `src/components/Editor/ChecklistEditor.module.scss` | Remove fqe-revision-banner; sticky filter bar; spacing reduction |
| `src/models/index.ts` | `CommonNoteSection.createdAt`; `ChecklistComment.likes`; TBC label |
| `src/components/Editor/Sidebar/CommonNotes.tsx` | Auto date stamp on new sections |
| `src/components/Editor/Sidebar/CollaborationSidebar.tsx` | Unread badge on Chat tab |
| `src/components/Editor/Sidebar/ChecklistChat.tsx` | Thumbs-up + unread tracking |
| `src/components/Editor/WorkgroupSection.tsx` | Remove workgroup chat; rename section labels |
| `src/components/Editor/ChecklistRowItem.tsx` | Hide flags for estimator/reviewer; TBC red class; Teams PA call |
| `src/components/Editor/ChecklistRowItem.module.scss` | `.row--confirmation-required` |
| `src/components/Revision/RevisionViewer.tsx` | Updated section label strings |
| `src/services/PdfGeneratorService.ts` | Landscape; image captions; RFQ line items table |
| `src/config/environment.ts` | `notifyAdminTeamsFlowUrl` |

---

## Verification Checklist

| # | Test | Expected |
|---|---|---|
| R4-C1 | Open checklist where FQE revision > checklist revision | No amber banner appears |
| R5-C1 | Add new General Note section | Date stamp appears; old sections show nothing |
| R5-C2 | Open editor on a laptop | Filter bar sticky; content more compact |
| R5-C3 | Open any checklist editor | Revisions above General Notes |
| R5-C4 | Open chat with new messages | Red badge on Chat tab; thumbs-up per message |
| R5-C5 | Open Estimator row actions | No Notify Admin or BTC buttons |
| R5-C6 | Open any workgroup | Correct new section labels; "Key" instead of "Answers" |
| R5-C7 | Export checklist to PDF | Landscape; image captions; RFQ line items table |
| R5-C8 | Set row to "Confirmation Required" | Red left border + faint background; badge says "Confirmation Required" |
| R5-C9 | Toggle Notify Admin ON | Teams card posted to admin channel |
