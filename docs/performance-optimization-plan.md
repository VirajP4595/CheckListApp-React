# Performance Optimization Plan

**Status:** ✅ Completed
**Date:** 2026-01-30
**Objective:** Improvements to make the application faster and more responsive, specifically addressing rendering bottlenecks in the Checklist Editor and initial load time.

## 1. Bottleneck Analysis

| Area | Issue | Impact |
|------|-------|--------|
| **Checklist Rendering** | `ChecklistRowItem` and `WorkgroupSection` re-render unnecessarily when unrelated state changes. | High input latency when typing; sluggish scrolling. |
| **List Processing** | Filtering and Sorting of rows happens on *every render* of `WorkgroupSection`. | CPU waste on every interaction. |
| **Initial Bundle** | The heavy `ChecklistEditor` and `TipTap` dependencies are loaded even when just viewing the Dashboard. | Slower initial page load. |
| **State Updates** | The `checklistStore` triggers updates of the entire `activeChecklist` object, potentially causing tree-wide re-renders if not memoized. | Global lag on local updates. |

## 2. Proposed Changes

### 2.1 Component Optimization

#### `src/components/Editor/ChecklistRowItem.tsx`
*   **Action:** Wrap in `React.memo`.
*   **Logic:** The component should only re-render if the distinct `row` prop changes. Since our Store creates new immutable row objects *only* when that specific row changes, this is an effective optimization.
*   **Detail:** `export const ChecklistRowItem = React.memo(...)`.

#### `src/components/Editor/WorkgroupSection.tsx`
*   **Action:** Wrap in `React.memo`.
*   **Action:** Memoize `filteredRows`.
*   **Logic:** Move `workgroup.rows.filter(...).sort(...)` inside a `useMemo` hook dependent on `[workgroup.rows, filters]`.

### 2.2 Code Splitting

#### `src/App.tsx`
*   **Action:** Implement `React.lazy` for routes.
*   **Logic:** Dynamically import `ChecklistEditor` only when creating or opening a checklist.
*   **Benefit:** Keeps the critical rendering path for the Dashboard lightweight.

### 2.3 Dataverse Batching (Future/Foundation)
*   **Action:** (Note only) Ensure `dataverseService` is ready for batching.
*   *Verification:* The current logic already fetches all rows in one query. We will defer complex batching (Project + Workgroups) as it provides diminishing returns compared to the rendering fixes.

## 3. Verification Steps

1.  **Typing Test:** Type rapidly in a Row Description. Ensure no lag.
2.  **Filter Test:** Toggling "Mark for Review" filter should be instant.
3.  **Load Test:** Check network tab to confirm `ChecklistEditor` chunk is loaded only on demand.
