# Implementation Plan — New Feature Set (Post-UAT)

**Last Updated**: 2026-03-27
**Status**: ✅ ALL FEATURES COMPLETE

---

## Overview

Seven features requested on top of existing UAT work. All implemented on `feature/uat-feedback`.

| # | Feature | Effort | Status |
|---|---------|--------|--------|
| 1 | Row Sections inside Workgroups | **Large** | ✅ Done |
| 2 | Estimator Dashboard Filter | Small | ✅ Done |
| 3 | Add "In-Revision" checklist status | Small | ✅ Done |
| 4 | Remove Estimate Type from Checklist Info | Small | ✅ Done |
| 5 | Job Type in PDF export | Small | ✅ Done |
| 6 | Order workgroups by number column | Small | ✅ Done |
| 7 | RFQ status in answer dropdown + supplier fields + export | **Large** | ✅ Done |

---

## Dataverse Prerequisites

> [!IMPORTANT]
> These columns/values must be provisioned **before** deploying to production.

| # | Table | Column/Change | Type | Notes |
|---|-------|--------------|------|-------|
| 1 | `pap_checklistrow` | `pap_section` | Choice (OptionSet) | `1` = "Client", `2` = "Estimator" |
| 2 | `pap_checklist` | `pap_status` OptionSet | Add new value | `4` = "In-Revision" |
| 3 | `pap_checklistrow` | `pap_answer` OptionSet | Add new value | `11` = "RFQ" |
| 4 | `pap_checklistrow` | `pap_suppliername` | String (100) | Supplier name for RFQ rows |
| 5 | `pap_checklistrow` | `pap_supplieremail` | String (200) | Supplier email for RFQ rows |

---

## 1. Row Sections Inside Workgroups ✅

**What was built:**
- `RowSection` type and `SECTION_CONFIG` in `src/models/index.ts`
- `section` property on `ChecklistRow` interface
- `createEmptyRow()` accepts `section` parameter
- `dataverseChecklistService.ts` maps `pap_section` OptionSet (1/2) ↔ `RowSection`
- `checklistStore.ts` `addRow` action accepts `section` parameter
- `WorkgroupSection.tsx` groups rows into "Client Checklist" and "Estimator Checklist" sub-sections with section-level "Add Row" buttons and insert-row dividers (lines 304-385)
- `PdfGeneratorService.ts` renders section sub-headers in workgroup output
- `RevisionViewer` reflects sections automatically (no changes needed)

---

## 2. Estimator Dashboard Filter ✅

**What was built:**
- `selectedEstimatorNames: string[]` in `DashboardFilterState`
- `EstimatorFilter` component in `DashboardFilterBar.tsx` (lines 218-299)
- Filtering logic in `Dashboard.tsx` using `selectedEstimatorNames`

---

## 3. Add "In-Revision" Checklist Status ✅

**What was built:**
- `'in-revision'` added to `ChecklistStatus` type in `models/index.ts` (line 31)
- `STATUS_CONFIG` entry with purple color `#5b5fc7`
- `STATUS_MAP` value `4` and `STATUS_VALUE_MAP` in `dataverseChecklistService.ts`
- "In Revision" added to `STATUS_OPTIONS` in `ChecklistInfoPanel.tsx`
- Purple badge style in `ChecklistEditor`

---

## 4. Remove Estimate Type from Checklist Info ✅

**What was built:**
- Estimate Type section removed from `ChecklistInfoPanel.tsx`

---

## 5. Job Type in PDF Export ✅

**What was built:**
- `jobType` included in header metadata line in `PdfGeneratorService.ts` (line 82)

---

## 6. Order Workgroups by Number Column ✅

**What was built:**
- `ChecklistEditor.tsx` line 337: `.sort((a, b) => a.number - b.number)`

---

## 7. RFQ Answer Status + Supplier Fields + RFQ Export ✅

**What was built:**
- `RFQ` added to `AnswerState` in `models/index.ts`
- `supplierName` and `supplierEmail` fields on `ChecklistRow`
- `pap_suppliername` / `pap_supplieremail` mapped in `dataverseChecklistService.ts`
- Supplier name/email inputs render in `ChecklistRowItem.tsx` when answer = RFQ
- `RfqExportService.ts` — PDF generation and email for RFQ items
- `useRfqExport.ts` — hook to trigger RFQ export
- "Email RFQ Summary" button in `ChecklistInfoPanel.tsx`
- `PdfGeneratorService.ts` shows supplier info below RFQ rows

---

## Additional Items Also Completed (from plan_critique.md)

| Item | Status |
|------|--------|
| BTC Flag (Builder To Confirm) per row | ✅ Done |
| Notify Admin Flag per row + dialog | ✅ Done |
| Insert Row at position (not just append) | ✅ Done |
| Dashboard archive filter (`statecode eq 0`) | ✅ Done |
| Due date timezone normalization | ✅ Done |
| Card compact layout (job type pill, urgency date, estimator/reviewer) | ✅ Done |
| Meeting transcript row hiding (via `meetingOccurred` prop) | ✅ Done |
| Ad-hoc checklist creation dialog | ✅ Done |
| Delete cascade error handling | ✅ Done — `dataverseChecklistService.ts` `deleteChecklist()` |

---

## Dropped Items (out of scope by decision)

- Super Admin Archive button
- EOD Estimator Activity Alert (Power Automate flow)
- Job dropdown filtering (exclude jobs with existing checklists)
- Meeting-transcript manual toggle UI
