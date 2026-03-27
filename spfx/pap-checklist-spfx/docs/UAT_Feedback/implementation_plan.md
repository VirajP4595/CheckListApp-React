# Implementation Plan — New Feature Set (Post-UAT)

**Last Updated**: 2026-03-25

---

## Overview

Seven features requested on top of existing UAT work. Ordered by dependency (foundational changes first).

| # | Feature | Effort |
|---|---------|--------|
| 1 | Row Sections inside Workgroups | **Large** |
| 2 | Estimator Dashboard Filter | Small |
| 3 | Add "In-Revision" checklist status | Small |
| 4 | Remove Estimate Type from Checklist Info | Small |
| 5 | Job Type in PDF export | Small |
| 6 | Order workgroups by number column | Small |
| 7 | RFQ status in answer dropdown + supplier fields + export | **Large** |

---

## Dataverse Prerequisites

> [!IMPORTANT]
> These columns/values must be provisioned **before** implementation begins.

| # | Table | Column/Change | Type | Notes |
|---|-------|--------------|------|-------|
| 1 | `pap_checklistrow` | `pap_section` | Choice (OptionSet) | Values: `1` = "Checklist Filler / Client", `2` = "Estimator". **OR** String column if freeform sections are desired later. |
| 2 | `pap_checklist` | `pap_status` OptionSet | Add new value | `4` = "In-Revision" |
| 3 | `pap_checklistrow` | `pap_answer` OptionSet | Add new value | `11` = "RFQ" |
| 4 | `pap_checklistrow` | `pap_suppliername` | String (100) | Supplier name, only relevant when answer = RFQ |
| 5 | `pap_checklistrow` | `pap_supplieremail` | String (200) | Supplier email, only relevant when answer = RFQ |

---

## 1. Row Sections Inside Workgroups

### Goal
Group rows within each workgroup into named sections: **"Checklist Filler / Client"** and **"Estimator"**. When "Add Row" is clicked inside a section, the new row inherits that section. The PDF and preview must reflect section groupings.

### 1a. Data Model

#### [MODIFY] [index.ts](file:///c:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/models/index.ts)

Add section type and update `ChecklistRow`:

```ts
// ─── ROW SECTION ─────────────────────────────────────────
export type RowSection = 'client' | 'estimator';

export const SECTION_CONFIG: Record<RowSection, { label: string; color: string }> = {
    'client':    { label: 'Checklist Filler / Client', color: '#0078d4' },
    'estimator': { label: 'Estimator',                 color: '#8764b8' },
};

export const ROW_SECTIONS: RowSection[] = ['client', 'estimator'];
```

Add `section` to `ChecklistRow`:

```diff
 export interface ChecklistRow {
     id: string;
     workgroupId: string;
+    section?: RowSection;       // Which section this row belongs to
     name: string;
     ...
 }
```

Update `createEmptyRow()` to accept `section`:

```diff
-export function createEmptyRow(workgroupId: string, order: number): ChecklistRow {
+export function createEmptyRow(workgroupId: string, order: number, section?: RowSection): ChecklistRow {
     return {
         id: generateId(),
         workgroupId,
+        section,
         name: '',
         ...
     };
 }
```

### 1b. Dataverse Service

#### [MODIFY] [dataverseChecklistService.ts](file:///c:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/services/dataverseChecklistService.ts)

**`DataverseRow` interface** — add:
```diff
+    pap_section?: number;       // 1 = client, 2 = estimator
```

**Add section maps**:
```ts
const SECTION_MAP: Record<number, RowSection> = { 1: 'client', 2: 'estimator' };
const SECTION_VALUE_MAP: Record<RowSection, number> = { 'client': 1, 'estimator': 2 };
```

**`mapRow()`** — add:
```diff
+        section: dv.pap_section ? SECTION_MAP[dv.pap_section] : undefined,
```

**Row `$select` query** — add `col('section')`.

**`createRow()`** — add to payload:
```diff
+            [col('section')]: rowData.section ? SECTION_VALUE_MAP[rowData.section] : null,
```

**`updateRow()`** — add to payload:
```diff
+            [col('section')]: row.section ? SECTION_VALUE_MAP[row.section] : null,
```

### 1c. Store

#### [MODIFY] [checklistStore.ts](file:///c:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/stores/checklistStore.ts)

**`addRow` action** — update to accept an optional `section` parameter:

```diff
-addRow: async (workgroupId: string, afterRowId?: string) => {
+addRow: async (workgroupId: string, afterRowId?: string, section?: RowSection) => {
```

Pass `section` through to `createEmptyRow(workgroupId, order, section)` and to `createRow(workgroupId, { ...newRow, section })`.

### 1d. UI — WorkgroupSection

#### [MODIFY] [WorkgroupSection.tsx](file:///c:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/components/Editor/WorkgroupSection.tsx)

Inside the expanded workgroup content, group rows by section:

```tsx
const groupedRows = useMemo(() => {
    const sections: { key: RowSection | 'none'; label: string; rows: ChecklistRow[] }[] = [];
    
    // Always show Client section first, Estimator second, unsectioned at top
    const clientRows = filteredRows.filter(r => r.section === 'client');
    const estimatorRows = filteredRows.filter(r => r.section === 'estimator');
    const unsectionedRows = filteredRows.filter(r => !r.section);
    
    if (unsectionedRows.length > 0) sections.push({ key: 'none', label: 'General', rows: unsectionedRows });
    if (clientRows.length > 0 || true) sections.push({ key: 'client', label: SECTION_CONFIG.client.label, rows: clientRows });
    if (estimatorRows.length > 0 || true) sections.push({ key: 'estimator', label: SECTION_CONFIG.estimator.label, rows: estimatorRows });
    
    return sections;
}, [filteredRows]);
```

Render each section with a thin sub-header and its own "Add Row" button:

```tsx
{groupedRows.map(section => (
    <div key={section.key} className={styles['workgroup-section']}>
        <div className={styles['section-header']}>
            <span className={styles['section-dot']} style={{ backgroundColor: SECTION_CONFIG[section.key]?.color || '#888' }} />
            <span className={styles['section-label']}>{section.label}</span>
            <span className={styles['section-count']}>{section.rows.length} items</span>
        </div>
        {/* Render rows */}
        {section.rows.sort((a, b) => a.order - b.order).flatMap((row, index) => [
            <ChecklistRowItem key={row.id} row={row} workgroupId={workgroup.id} isCompact={!expandTasks} />,
            <div key={`insert-${row.id}`} className={styles['insert-row-divider']}>
                <button className={styles['insert-row-btn']}
                    onClick={() => addRow(workgroup.id, row.id, section.key !== 'none' ? section.key : undefined)}>
                    <span className={styles['insert-row-icon']}>+</span>
                </button>
            </div>
        ])}
        {/* Section-level Add Row */}
        <button className={styles['insert-row-btn']}
            onClick={() => addRow(workgroup.id, undefined, section.key !== 'none' ? section.key : undefined)}>
            + Add row to {section.label}
        </button>
    </div>
))}
```

#### [MODIFY] [WorkgroupSection.module.scss](file:///c:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/components/Editor/WorkgroupSection.module.scss)

Add new styles:
```scss
.workgroup-section {
    margin-bottom: $spacing-2;
}

.section-header {
    display: flex;
    align-items: center;
    gap: $spacing-2;
    padding: $spacing-2 $spacing-3;
    font-size: $font-size-sm;
    font-weight: $font-weight-semibold;
    color: $color-gray-700;
    border-bottom: 1px solid $color-border;
}

.section-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
}

.section-label {
    flex: 1;
}

.section-count {
    @include body-small;
    color: $color-gray-500;
}
```

### 1e. PDF Export — Sections

#### [MODIFY] [PdfGeneratorService.ts](file:///c:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/services/PdfGeneratorService.ts)

Inside `renderWorkgroup()`, group `visibleRows` by section and render a **sub-header** for each section:

```ts
import { SECTION_CONFIG, RowSection } from '../models';

// Inside renderWorkgroup, after filtering visibleRows:
const sectionGroups = new Map<string, ChecklistRow[]>();
for (const row of visibleRows) {
    const key = row.section || 'none';
    if (!sectionGroups.has(key)) sectionGroups.set(key, []);
    sectionGroups.get(key)!.push(row);
}

// Render order: client first, estimator second, unsectioned at end
const orderedSections: [string, ChecklistRow[]][] = [
    ['client', sectionGroups.get('client') || []],
    ['estimator', sectionGroups.get('estimator') || []],
    ['none', sectionGroups.get('none') || []],
].filter(([_, rows]) => rows.length > 0);

for (const [sectionKey, sectionRows] of orderedSections) {
    // Draw section sub-header
    if (sectionKey !== 'none') {
        checkPageBreak(8);
        const config = SECTION_CONFIG[sectionKey as RowSection];
        doc.setFontSize(9);
        doc.setTextColor(config.color);
        doc.setFont('helvetica', 'bold');
        doc.text(`▸ ${config.label}`, margin.left + 2, cursorY + 5);
        cursorY += 7;
    }
    // Render rows in this section (existing row rendering loop)
    for (const row of sectionRows) { ... }
}
```

#### [MODIFY] [BtcExportService.ts](file:///c:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/services/BtcExportService.ts)

Include section labels in email body:

```diff
-btcItems.push(`<li><strong>${wg.number}</strong>: ${rowName}</li>`);
+const sectionTag = row.section ? ` [${SECTION_CONFIG[row.section].label}]` : '';
+btcItems.push(`<li><strong>${wg.number}${sectionTag}</strong>: ${rowName}</li>`);
```

### 1f. Preview (RevisionViewer)

The `RevisionViewer` renders workgroups using `WorkgroupSection`. The sections will **automatically** reflect — **no changes needed**.

---

## 2. Estimator Dashboard Filter

#### [MODIFY] [DashboardFilterBar.tsx](file:///c:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/components/Dashboard/DashboardFilterBar.tsx)

**`DashboardFilterState`** — add `selectedEstimators: string[]`.

**Add `EstimatorFilter` component** (same pattern as `ClientFilter`).

#### [MODIFY] [Dashboard.tsx](file:///c:/Projects/PAP-CheckList-React/spfx/pap-checklist-spfx/src/components/Dashboard/Dashboard.tsx)

Add filtering logic in `filteredChecklists` useMemo for `selectedEstimators`.

---

## 3. Add "In-Revision" Checklist Status

#### [MODIFY] [index.ts] — Update `ChecklistStatus` and `STATUS_CONFIG`.
#### [MODIFY] [dataverseChecklistService.ts] — Update `STATUS_MAP` and `STATUS_VALUE_MAP`.
#### [MODIFY] [ChecklistInfoPanel.tsx] — Add "In Revision" to `STATUS_OPTIONS`.
#### [MODIFY] [ChecklistEditor.tsx] — Update `getStatusClass()`.
#### [MODIFY] [ChecklistEditor.module.scss] — Add purple badge style.

---

## 4. Remove Estimate Type from Checklist Info

#### [MODIFY] [ChecklistInfoPanel.tsx] — Remove Estimate Type section and code.

---

## 5. Job Type in PDF Export

#### [MODIFY] [PdfGeneratorService.ts] — Include Job Type in header metadata line.

---

## 6. Order Workgroups by Number Column

#### [MODIFY] [ChecklistEditor.tsx] — Change workgroup sort from `order` to `number`.

---

## 7. RFQ Answer Status + Supplier Fields + RFQ Export

### 7a. Data Model
#### [MODIFY] [index.ts] — Add `RFQ` AnswerState and supplier fields to `ChecklistRow`.

### 7b. Dataverse Service
#### [MODIFY] [dataverseChecklistService.ts] — Map `RFQ` and supplier fields.

### 7c. UI — Row-Level Supplier Fields
#### [MODIFY] [ChecklistRowItem.tsx] — Render supplier inputs when answer is RFQ.

### 7e. RFQ Export Service
#### [NEW] [RfqExportService.ts] — PDF generation/email for RFQ items.

### 7f. RFQ Export Hook
#### [NEW] [useRfqExport.ts] — Hook to trigger RFQ export.

### 7g. RFQ Export Button in Checklist Info
#### [MODIFY] [ChecklistInfoPanel.tsx] — Add "Email RFQ Summary" button.

### 7h. PDF — RFQ Supplier Info
#### [MODIFY] [PdfGeneratorService.ts] — Show supplier info below RFQ items.

---

## Implementation Order
Foundation (Models/Maps) → Dataverse → Store → Quick Wins (2-6) → Workgroup Sections → RFQ UI → RFQ Export.

## Verification Plan
Manual test matrix for sections, filters, statuses, and PDF exports.
