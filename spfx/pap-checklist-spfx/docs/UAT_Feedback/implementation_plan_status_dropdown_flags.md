# Status Dropdown Redesign + Notify Admin + BTC Flags

## Overview

Three areas of change based on client requirements:

1. **Status dropdown updates** — rename 2 existing answer states, add 3 new ones
2. **Notify Admin flag** — per-row toggle + Teams notification flow
3. **Builder to Confirm (BTC) flag** — per-row toggle + PDF/email export of BTC items

---

## Part 1 — Status Dropdown Changes

### Current State

| Internal Key | Dataverse Int | Label | Color |
|--|--|--|--|
| `YES` | 1 | Yes | `#107c10` |
| `NO` | 2 | No | `#d13438` |
| `BLANK` | 3 | — | `#8a8886` |
| `PS` | 4 | PS | `#ff8c00` |
| `PC` | 5 | PC | `#0078d4` |
| `SUB` | 6 | SUB | `#8764b8` |
| `OTS` | 7 | OTS | `#038387` |

### Proposed Changes

| Change | Key | DV Int | New Label | Color |
|--|--|--|--|--|
| **Rename** | `SUB` | 6 | Subquote / Subcontractor Quote | `#8764b8` (same) |
| **Rename** | `NO` | 2 | Noted as Excluded | `#d13438` (same) |
| **Add** | `TBC` | 8 | TBC | `#a4262c` (dark red) |
| **Add** | `OPT_EXTRA` | 9 | Optional Extra | `#ca5010` (amber) |
| **Add** | `BUILDER_SPEC` | 10 | Builder Spec / Standard | `#498205` (olive green) |

> [!NOTE]
> Dataverse integers 8, 9, 10 are confirmed to match the choice/optionset values in the `pap_answer` column.

### Files to Modify

#### [MODIFY] [models/index.ts](file:///c:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/models/index.ts)
- Update `AnswerState` type union: add `'TBC' | 'OPT_EXTRA' | 'BUILDER_SPEC'`
- Update `ANSWER_STATES` array with the 3 new keys
- In `ANSWER_CONFIG`:
  - Change `SUB` label → `'Subquote / Subcontractor Quote'`
  - Change `NO` label → `'Noted as Excluded'`, description → `'Noted as excluded from scope'`
  - Add `TBC`, `OPT_EXTRA`, `BUILDER_SPEC` entries

#### [MODIFY] [dataverseChecklistService.ts](file:///c:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/services/dataverseChecklistService.ts)
- Add entries `8: 'TBC'`, `9: 'OPT_EXTRA'`, `10: 'BUILDER_SPEC'` to `ANSWER_MAP`
- Add reverse entries to `ANSWER_VALUE_MAP`

#### [MODIFY] [AnswerSelector.module.scss](file:///c:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/components/Editor/AnswerSelector.module.scss)
- Ensure the dropdown menu can handle longer label text (`Subquote / Subcontractor Quote` is ~32 chars)
- May need `min-width` increase on `.answer-trigger` or `.answer-menu-item`

#### [MODIFY] [PdfGeneratorService.ts](file:///c:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/services/PdfGeneratorService.ts)
- No structural changes needed — uses `ANSWER_CONFIG[row.answer]` dynamically
- Just verify new colors render correctly in PDF

---

## Part 2 — Notify Admin Flag

### Behaviour
- Each checklist row gets a **"Notify Admin"** toggle button
- When toggled ON, it triggers a **Power Automate flow** (via Dataverse column change) that sends a **Teams notification** to the relevant admin
- The flag should be **filterable** in the FilterBar

### Data Model Changes

#### [MODIFY] [models/index.ts](file:///c:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/models/index.ts)
- Add `notifyAdmin: boolean` to `ChecklistRow` interface
- Add default `notifyAdmin: false` in `DEFAULT_CHECKLIST_ROW`

#### [MODIFY] [dataverseChecklistService.ts](file:///c:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/services/dataverseChecklistService.ts)
- Add `pap_notifyadmin: boolean` to `DataverseRow` interface
- Add `col('notifyadmin')` to the `$select` query for rows
- Map in `mapRow`: `notifyAdmin: dv.pap_notifyadmin || false`
- Add to `createRow` and `updateRow` payloads (column name `pap_notifyadmin` is confirmed)

### UI Changes

#### [MODIFY] [ChecklistRowItem.tsx](file:///c:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/components/Editor/ChecklistRowItem.tsx)
- Add a new toggle button in the **actions column** (Column 3), following the same pattern as `markedForReview`:
  - Icon: `Alert20Regular` / `Alert20Filled` from Fluent icons
  - Tooltip: "Notify admin" / "Remove admin notification"
  - Toggle handler calls `updateRow(row.id, { notifyAdmin: !row.notifyAdmin })`

#### [MODIFY] [ChecklistRowItem.module.scss](file:///c:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/components/Editor/ChecklistRowItem.module.scss)
- Add `row-action-btn--notify` style with a distinct colour (e.g. `#0078d4` blue)

#### [MODIFY] [FilterBar.tsx](file:///c:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/components/Editor/FilterBar.tsx)
- Add `notifyAdmin: boolean | null` to `FilterState`
- Add a "Notify Admin" checkbox in the filter panel

#### [MODIFY] [WorkgroupSection.tsx](file:///c:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/components/Editor/WorkgroupSection.tsx)
- Add `notifyAdmin` filter logic in the `filteredRows` computation (same pattern as `markedForReview`)

### Power Automate Integration
- The Teams notification is triggered **server-side** by Power Automate watching the `pap_notifyadmin` column change to `true` in Dataverse
- **No frontend code is needed** for the Teams alert — it's purely a Dataverse trigger → Power Automate flow → Teams connector
- The frontend just needs to persist the boolean correctly

---

## Part 3 — Builder to Confirm (BTC) Flag + PDF/Email Export

### Behaviour
- Each checklist row gets a **"BTC"** toggle button
- Users can **filter** to see all BTC items
- A new **"Export BTC Summary"** action generates a PDF of all BTC-flagged items and opens an email draft to the builder

### Data Model Changes

#### [MODIFY] [models/index.ts](file:///c:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/models/index.ts)
- Add `builderToConfirm: boolean` to `ChecklistRow` interface
- Add default `builderToConfirm: false` in `DEFAULT_CHECKLIST_ROW`

#### [MODIFY] [dataverseChecklistService.ts](file:///c:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/services/dataverseChecklistService.ts)
- Add `pap_buildertoconfirm: boolean` to `DataverseRow` interface
- Add `col('buildertoconfirm')` to the `$select` query
- Map in `mapRow`: `builderToConfirm: dv.pap_buildertoconfirm || false`
- Add to `createRow` and `updateRow` payloads (column name `pap_buildertoconfirm` is confirmed)

### UI Changes — Toggle

#### [MODIFY] [ChecklistRowItem.tsx](file:///c:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/components/Editor/ChecklistRowItem.tsx)
- Add BTC toggle button in actions column:
  - Icon: `PersonArrowRight20Regular` / `PersonArrowRight20Filled` (or `Send20Regular`)
  - Tooltip: "Builder to Confirm" / "Remove BTC flag"
  - Toggle handler: `updateRow(row.id, { builderToConfirm: !row.builderToConfirm })`

#### [MODIFY] [ChecklistRowItem.module.scss](file:///c:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/components/Editor/ChecklistRowItem.module.scss)
- Add `row-action-btn--btc` style with a distinct colour (e.g. `#ca5010` amber)

#### [MODIFY] [FilterBar.tsx](file:///c:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/components/Editor/FilterBar.tsx)
- Add `builderToConfirm: boolean | null` to `FilterState`
- Add a "Builder to Confirm" checkbox

#### [MODIFY] [WorkgroupSection.tsx](file:///c:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/components/Editor/WorkgroupSection.tsx)
- Add `builderToConfirm` filter logic

### UI Changes — BTC Export Action

#### [NEW] [BtcExportService.ts](file:///c:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/services/BtcExportService.ts)
- Collects all rows where `builderToConfirm === true`
- Generates a summary PDF via `jsPDF`
- Opens an email draft using `window.location.href = mailto:...`:
  - To: (Extracted from Job context)
  - Subject: `BTC Summary - [Job Address]`
  - Body: List of items requiring confirmation (PDF attached manually by user or sent as text summary)

> [!NOTE]
> Using `mailto:` as requested. The PDF will be downloaded by the user, and the email client will open for them to attach it.

---

## Summary of All File Changes

| File | Part 1 | Part 2 | Part 3 |
|------|--------|--------|--------|
| `models/index.ts` | ✅ | ✅ | ✅ |
| `dataverseChecklistService.ts` | ✅ | ✅ | ✅ |
| `AnswerSelector.module.scss` | ✅ | — | — |
| `PdfGeneratorService.ts` | ✅ (verify) | — | — |
| `ChecklistRowItem.tsx` | — | ✅ | ✅ |
| `ChecklistRowItem.module.scss` | — | ✅ | ✅ |
| `FilterBar.tsx" | — | ✅ | ✅ |
| `WorkgroupSection.tsx" | — | ✅ | ✅ |
| `ChecklistEditor.tsx" | — | — | ✅ |
| `BtcExportService.ts" [NEW] | — | — | ✅ |

---

## Dataverse Prerequisites

Before implementation:

1. **Confirm Dataverse answer optionset values** — integers 8, 9, 10 for TBC, Optional Extra, Builder Spec
2. **Create column `pap_notifyadmin`** (Boolean) on `pap_checklistrow`
3. **Create column `pap_buildertoconfirm`** (Boolean) on `pap_checklistrow`
4. **Set up Power Automate flow** — trigger on `pap_notifyadmin` = true → send Teams notification

---

## Verification Plan

### Automated
- `npx tsc --noEmit` after each part

### Manual
- Verify all 10 answer states render correctly in the dropdown, filters, and PDF
- Verify Notify Admin toggle persists to Dataverse and triggers Teams flow
- Verify BTC toggle, filtering, and PDF export with email draft
