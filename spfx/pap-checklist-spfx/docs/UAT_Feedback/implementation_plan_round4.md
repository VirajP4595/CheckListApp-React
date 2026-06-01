# Implementation Plan — Round 4 (Refined)

**Date:** 14 May 2026
**Source:** UAT feedback — Adrienne Simmons Teams chat + updated action items list

---

## Status Overview

| Item | Status |
|---|---|
| Job Details panel not populating (all fields `—`) | ✅ Fixed (13 May) |
| Common Notes text highlighting | ✅ Already delivered — pending Adrienne sign-off |
| RFQ email flow with line-item table | ✅ Already delivered (sends from viraj.empathy; shared mailbox blocked by SPFx) |
| PDF layout refresh (VP logo, builder/client logos, colors) | ✅ Already delivered |

---

## Bug Fixes (To Implement)

### BUG 1 — Site Address not populating

**Root cause:** `vin_buildarea` is a **boolean** field (e.g., `false` / `"No"`) — not a text address. The job address is **`vin_name`** (e.g., "209 Rainbow Street, Sandgate"), which is already fetched.

**Fix — `src/services/dataverseChecklistService.ts`:**
- In both `mapChecklist()` and `getChecklist()` inline block, change:
  ```typescript
  // BEFORE
  siteAddress: dv.pap_jobid.vin_buildarea || ''
  
  // AFTER
  siteAddress: dv.pap_jobid.vin_name || ''   // vin_name IS the job address
  ```
- Remove `vin_buildarea` from the expand `$select` (it's a boolean, not an address)
- Update `DataverseChecklist.pap_jobid` interface: remove `vin_buildarea?: string`, add note that `vin_name` doubles as site address

**Files:** `src/services/dataverseChecklistService.ts`

---

### BUG 2 — QBE Complete = Yes not flowing from FQE card

**Root cause:** Code uses `vin_qbeflagged` (a different concept — "QBE Flagged/Reviewed") but the field shown in the FQE card as "QB Complete" is **`vin_qbecomplete`** (confirmed in `job_metadata_sample.json` line 176).

**Fix — `src/services/dataverseChecklistService.ts`:**

1. Add `vin_qbecomplete` to the expand `$select` in both `getChecklist` (line 297) and `getAllChecklists` (line 548)
2. Update `DataverseChecklist.pap_jobid` interface: add `vin_qbecomplete?: boolean`
3. In both `mapChecklist()` and `getChecklist()` inline `jobDetails` block, change:
   ```typescript
   // BEFORE
   qbeFlagged: dv.pap_jobid.vin_qbeflagged ?? false,
   
   // AFTER
   qbeFlagged: dv.pap_jobid.vin_qbecomplete ?? false,   // QB Complete = Yes/No
   ```
4. Keep `vin_qbeflagged` in the interface for future use (it means "QBE Flagged for review" — a separate concept)

**Files:** `src/services/dataverseChecklistService.ts`

---

### BUG 3 — QBE High/Low range not appearing when QB Complete = Yes

**Root cause:** Depends on BUG 2 fix. `qbeFlagged` was always `false` so the conditional range never showed. Once BUG 2 is fixed, confirm the conditional renders correctly.

**Verify in `src/components/Editor/Sidebar/JobMetadataHeader.tsx`:**
```tsx
{job.qbeFlagged && (job.qbeLow !== null || job.qbeHigh !== null) && (
    <div className={styles['qbe-range']}>...</div>
)}
```
This is already correct. Also ensure `vin_qbelow` and `vin_qbehigh` are in the expand `$select` (they already are).

**Files:** No code change needed after BUG 2 fix — verify only.

---

### BUG 4 — Internal item flag showing in checklist preview

**Root cause:** `RevisionViewer.tsx` filters rows by `answer !== 'BLANK'` but does **not** filter out `internalOnly: true` rows. The editor correctly hides them but the preview/revision viewer does not.

**Fix — `src/components/Revision/RevisionViewer.tsx` (~line 68):**
```typescript
// BEFORE
const visibleRows = workgroup.rows.filter((r: any) =>
    r.answer && r.answer !== 'BLANK' && r.answer.trim() !== ''
);

// AFTER
const visibleRows = workgroup.rows.filter((r: any) =>
    r.answer && r.answer !== 'BLANK' && r.answer.trim() !== '' && !r.internalOnly
);
```

**Files:** `src/components/Revision/RevisionViewer.tsx`

---

### BUG 5 — PAP logo renders poorly in PDF export

**Root cause:** Logo is converted from Blob → Base64 PNG at fixed 21mm height. No compression control; source image may be low-DPI.

**Fix — `src/services/PdfGeneratorService.ts`:**
- Increase DPI scaling by rendering at 2× pixel density before adding to PDF
- Switch `addImage` format from `'PNG'` to `'JPEG'` with compression quality `0.95`
- If the logo source is a SharePoint URL, re-fetch at its native resolution before generating
- Keep the 21mm height constraint but calculate width from native aspect ratio

**Files:** `src/services/PdfGeneratorService.ts`

---

## Change Requests — To Build

### CHANGE 1 — Auto-create checklist revision when FQE revision created

**Context:** When a new revision is created in the FQE job card (`vin_revisionnumber` increments), the checklist should automatically get a matching revision. Mirrors the "checklist created on FQE" behaviour.

**Approach (in-app detection, no new Power Automate flow needed):**

1. Add `vin_revisionnumber` to the job expand `$select` in both `getChecklist` and `getAllChecklists`
2. Map to `jobDetails.fqeRevisionNumber?: number`
3. In `ChecklistEditor.tsx`, after loading: compare `activeChecklist.jobDetails.fqeRevisionNumber` with `activeChecklist.currentRevisionNumber`
4. If `fqeRevisionNumber > currentRevisionNumber`, show a non-blocking banner: *"FQE Revision [N] detected — create matching checklist revision?"* with a **Create Revision** button
5. Clicking calls the existing `createRevision(title, notes)` store action with auto-populated title `"FQE Revision ${fqeRevisionNumber}"` and empty notes
6. Banner dismisses after creation or if user clicks "Dismiss"

**Files:**
- `src/services/dataverseChecklistService.ts` — add `vin_revisionnumber` to expands + interface + mapping
- `src/models/index.ts` — add `fqeRevisionNumber?: number` to `jobDetails`
- `src/components/Editor/ChecklistEditor.tsx` — add revision sync banner logic

---

### CHANGE 2 — Rename "Common Notes" → "General Notes"

**All UI-facing string changes (4 locations + 1 activity log):**

| File | Line | Current | Change To |
|---|---|---|---|
| `src/components/Editor/Sidebar/CommonNotes.tsx` | 125 | `"Common Notes"` (UI label) | `"General Notes"` |
| `src/components/Editor/Sidebar/CommonNotes.tsx` | 46 | `'Updated Common Notes'` (activity log) | `'Updated General Notes'` |
| `src/components/Revision/RevisionViewer.tsx` | 238 | `<h3>Common Notes</h3>` | `<h3>General Notes</h3>` |
| `src/services/dataverseChecklistService.ts` | 165 | `title: 'Common Notes'` (legacy migration default) | `title: 'General Notes'` |

**Variable/class names stay unchanged** (renaming `commonNotes` variables would risk regressions).

---

### CHANGE 3 — Newest entry at top of General Notes

**Context:** New note entries should prepend (newest first), replacing the current append behavior.

**Find the note creation handler** in `src/components/Editor/Sidebar/CommonNotes.tsx`:
```typescript
// BEFORE (append)
const updated = [...checklist.commonNotes, newNote];

// AFTER (prepend)
const updated = [newNote, ...checklist.commonNotes];
```

**Files:** `src/components/Editor/Sidebar/CommonNotes.tsx`

---

### CHANGE 4 — New Job Details Fields (General Info Section)

**Location:** Below General Notes (renamed Common Notes), above workgroup/Preliminaries. New dedicated card component.

**Fields (4 fields, 6 Dataverse columns needed):**

| Field | Type | Default | Behaviour |
|---|---|---|---|
| Hard Submission Deadline | Boolean | No | If Yes → date picker appears |
| Hard Submission Date | Date | — | Only visible when Hard Deadline = Yes |
| Builder Supplied Quotes | Boolean | No | Toggle only |
| Contract Type | Choice | Standard | Dropdown: Standard / Cost Plus |
| Build Stages | Boolean | No | If Yes → text box appears |
| Build Stages Notes | Text | — | Only visible when Build Stages = Yes |

**New Dataverse columns on `pap_checklist` (client admin must create):**

| Display Name | Schema Name | Type |
|---|---|---|
| Hard Submission Deadline | `pap_hardsubmissiondeadline` | Boolean (Two Options) |
| Hard Submission Date | `pap_hardsubmissiondate` | Date and Time |
| Builder Supplied Quotes | `pap_buildersuppliedquotes` | Boolean (Two Options) |
| Contract Type | `pap_contracttype` | Choice (1=Standard, 2=Cost Plus) |
| Build Stages | `pap_buildstages` | Boolean (Two Options) |
| Build Stages Notes | `pap_buildstagesnotes` | Multiple Lines of Text |

> Code can ship before columns exist — fields return empty until created.

**`src/models/index.ts` — add to `Checklist`:**
```typescript
hardDeadline?: boolean;
hardDeadlineDate?: Date | null;
builderSuppliedQuotes?: boolean;
contractType?: 'standard' | 'cost-plus' | null;
buildStages?: boolean;
buildStagesNotes?: string;
```

**`src/services/dataverseChecklistService.ts`:**
- Add all 6 to `$select` and `DataverseChecklist` interface
- Map in `getChecklist` return block
- Add to `saveChecklist` PATCH payload

**New component: `src/components/Editor/GeneralInfoSection.tsx`**
- Layout: 2-column grid for boolean toggles; conditional date picker and text area expand in place
- Styling: matches General Notes card (`@include card`, `@include input-filled` from `_mixins.scss`)
- Auto-save on blur with 2s debounce
- Props: `{ checklist, onUpdate, onSave, readOnly? }`

**`src/components/Editor/ChecklistEditor.tsx`:**
- Import `GeneralInfoSection`
- Place after `<CommonNotes>` / `<GeneralNotes>`, before workgroup list

---

### CHANGE 5 — Google Maps Link + Real Estate.com.au Link

**Context:** Link icons appear in the Job Details panel next to the site address. Google Maps URL already stored on the Dataverse job as `vin_googlemapslink`. REA link constructed from `vin_name`.

**`src/services/dataverseChecklistService.ts`:**
- Add `vin_googlemapslink` to expand `$select` for both `getChecklist` and `getAllChecklists`
- Add `vin_googlemapslink?: string` to `DataverseChecklist.pap_jobid` interface
- Map to `jobDetails.googleMapsLink: dv.pap_jobid.vin_googlemapslink || ''`

**`src/models/index.ts`:**
- Add `googleMapsLink?: string` to `jobDetails`

**`src/components/Editor/Sidebar/JobMetadataHeader.tsx`:**
- In the Site Address field row, add two icon-link buttons:
  - **Google Maps** → `job.googleMapsLink` (use stored URL directly; fallback: construct from `vin_name`)
  - **Real Estate.com.au** → `https://www.realestate.com.au/buy/property/search?keywords=${encodeURIComponent(job.jobName)}`
- Both open `target="_blank" rel="noopener noreferrer"`
- Only render if `job.jobName` is non-empty
- Icons: `Location20Regular` (Maps), `Home20Regular` (REA)

**Files:**
- `src/services/dataverseChecklistService.ts`
- `src/models/index.ts`
- `src/components/Editor/Sidebar/JobMetadataHeader.tsx`
- `src/components/Editor/Sidebar/JobMetadataHeader.module.scss`

---

### CHANGE 6 — Files Panel: Multi-File Upload with Date Stamps

**Context:** Current model already stores `uploadedAt: Date` per file. Need multi-file selection + date stamp visible in list. Acts as a "back page" record — everything received for the job.

**`src/components/Editor/Sidebar/ChecklistFiles.tsx`:**
- Add `multiple` attribute to `<input type="file" multiple />`
- Update handler to iterate `Array.from(e.target.files || [])` and call `uploadFile(file)` sequentially
- Show batch progress: "Uploading 2 / 5…"
- Ensure date stamp (`file.uploadedAt`) displays in file list with locale date format (already in model and UI — verify it renders)
- Add drag-and-drop zone: handle `onDrop` with `Array.from(e.dataTransfer.files)`

**`src/stores/checklistStore.ts`:** No change needed — `uploadFile` called in a loop.

---

### CHANGE 7 — PDF Condensation (Critical)

**Context:** A $4M job produces ~100 pages. Goal: significantly shrink by collapsing row data and embedding images inline.

**Target layout per row:**
```
[Answer Badge] Item Name                    [accent border: blue=client, orange=estimator]
Notes text (directly below, no extra block header, colored by section)
[Image thumbnail inline, below notes, constrained to ~40mm height]
```

**Changes to `src/services/PdfGeneratorService.ts`:**

1. **Collapse section headers:** Remove the bold section-name header ("CHECKLIST FILLER / CLIENT" / "ESTIMATOR") that prints before each group. Instead, use a subtle left-border color per section (client = blue `#3b82f6`, estimator = orange `#f97316`) on each row.

2. **Collapse notes block:** Remove the `NOTES:` label and surrounding background box. Print notes text directly below the item name in the same row block, smaller font (8pt):
   - Client/checklist notes: color `#555555`
   - Estimator notes: color `#b35c00` (warm amber — visually distinct)

3. **Inline images:** Instead of a separate 2-column image grid section after each workgroup, embed images directly below the notes for that specific row. Constrain each image to max 40mm height, max content-width. Multiple images flow vertically.

4. **Tighter line spacing:** Reduce inter-row padding from ~8mm to ~3mm.

5. **Remove "by [estimator]" tags:** Not currently rendered in PDF (confirmed by code audit) — no change needed.

**Estimator vs client color logic:**
```typescript
const isEstimatorRow = row.section === 'estimator';
const notesColor = isEstimatorRow ? '#b35c00' : '#555555';
const rowAccentColor = isEstimatorRow ? '#f97316' : '#3b82f6';
```

---

### CHANGE 8 — RFQ PDF: Allow PDF File Attachments on Row Items

**Status: Pending Viraj confirmation before implementing.**

**Planned approach (once confirmed):**
- Extend `ChecklistRow` to support `attachments: ChecklistAttachment[]` alongside images, with a `type: 'pdf'` discriminator
- In `src/services/RfqExportService.ts`, when a PDF attachment exists on a row, embed a reference link or "See attached PDF" annotation
- Upload flow: same SharePoint document library, filtered by MIME type

---

## 3D Model Fields

**Action:** Leave as placeholders. No code changes required.

---

## Already Delivered — Pending Client Review

| Feature | Notes |
|---|---|
| Text highlighting in General Notes | Built. Adrienne to verify. |
| RFQ email flow | Sends from viraj.empathy (hard-coded). Shared mailbox estimates@priceplan.au blocked in SPFx without per-user delegation. |
| PDF layout refresh | VP logo + builder/client logo in header, updated colors — in dev. |

---

## Critical Files Summary

| File | Changes |
|---|---|
| `src/services/dataverseChecklistService.ts` | BUG 1: siteAddress→vin_name; BUG 2: qbeFlagged→vin_qbecomplete; Add vin_revisionnumber, vin_googlemapslink; General Info 6 columns |
| `src/models/index.ts` | Add fqeRevisionNumber, googleMapsLink to jobDetails; add 6 General Info fields to Checklist |
| `src/components/Revision/RevisionViewer.tsx` | BUG 4: add `&& !r.internalOnly` filter; CHANGE 2: rename heading |
| `src/services/PdfGeneratorService.ts` | BUG 5: logo quality; CHANGE 7: full condensation refactor |
| `src/components/Editor/Sidebar/CommonNotes.tsx` | CHANGE 2: rename label + activity log; CHANGE 3: prepend new entries |
| `src/components/Editor/ChecklistEditor.tsx` | CHANGE 1: revision sync banner; CHANGE 4: add GeneralInfoSection |
| `src/components/Editor/GeneralInfoSection.tsx` | CHANGE 4: new component |
| `src/components/Editor/GeneralInfoSection.module.scss` | CHANGE 4: new styles |
| `src/components/Editor/Sidebar/JobMetadataHeader.tsx` | CHANGE 5: Maps + REA links |
| `src/components/Editor/Sidebar/JobMetadataHeader.module.scss` | CHANGE 5: link button styles |
| `src/components/Editor/Sidebar/ChecklistFiles.tsx` | CHANGE 6: multi-file upload + date stamps |

---

## Dataverse Columns Required (Client Admin)

Create these on `pap_checklist` before General Info section will save data:

| Schema Name | Type |
|---|---|
| `pap_hardsubmissiondeadline` | Boolean |
| `pap_hardsubmissiondate` | Date and Time |
| `pap_buildersuppliedquotes` | Boolean |
| `pap_contracttype` | Choice (1=Standard, 2=Cost Plus) |
| `pap_buildstages` | Boolean |
| `pap_buildstagesnotes` | Multiple Lines of Text |

---

## Verification Checklist

| # | Test | Expected |
|---|---|---|
| BUG 1 | Open checklist with linked job | Site Address shows job address (e.g., "209 Rainbow Street, Sandgate") |
| BUG 2 | Open North Beach Bespoke checklist | QBE shows "Yes" matching the FQE card |
| BUG 3 | Open checklist where QB Complete = Yes | QBE Low and High range appears |
| BUG 4 | Open revision viewer with internal rows | Internal-only rows do not appear in preview |
| BUG 5 | Export any checklist to PDF | PAP logo is crisp, not blurry |
| CHANGE 1 | Open checklist where FQE revision > checklist revision | Banner: "FQE Revision N detected" with Create button |
| CHANGE 2 | Open checklist editor | Section reads "General Notes" throughout |
| CHANGE 3 | Add a new General Note | New note appears at the top of the list |
| CHANGE 4 | Open any checklist | New General Info section visible below General Notes |
| CHANGE 5 | Open any checklist with linked job | Map and REA icons appear next to site address; clicking opens correct URL |
| CHANGE 6 | Click Upload → select 3 files | All 3 appear with upload date stamps |
| CHANGE 7 | Export a large checklist to PDF | Page count significantly reduced |
