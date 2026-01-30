# PAP CheckList React - Phase 1 Implementation Plan

OneNote-style checklist for construction estimators. React 17, TypeScript 5.8, Fluent UI 9.

---

## Phase 1.1: Project Foundation

### [NEW] package.json
```json
{
  "dependencies": {
    "react": "17.0.2",
    "react-dom": "17.0.2",
    "@fluentui/react-components": "^9.46.0",
    "@fluentui/react-icons": "^2.0.230",
    "zustand": "^4.5.0",
    "jspdf": "^2.5.2",
    "html2canvas": "^1.4.1"
  },
  "devDependencies": {
    "typescript": "~5.8.0",
    "vitest": "^2.1.8",
    "@testing-library/react": "^12.1.5",
    "@testing-library/jest-dom": "5.17.0",
    "@vitest/ui": "^2.1.8",
    "@vitest/coverage-v8": "^2.1.8"
  }
}
```

### [NEW] tsconfig.json
- Target: ES2020, strict mode, path aliases (@models, @services, @components)

### [NEW] vitest.config.ts
- jsdom environment, React plugin, coverage reports

### [NEW] tests/setupTests.ts
- jest-dom matchers, cleanup after each test

### [NEW] public/index.html
- HTML shell with Inter font

---

## Phase 1.2: Data Models

### [NEW] src/models/index.ts

```typescript
// ─── ANSWER STATE ────────────────────────────────────────
export type AnswerState = 'YES' | 'NO' | 'BLANK' | 'PS' | 'PC' | 'SUB' | 'OTS';

export const ANSWER_CONFIG: Record<AnswerState, { label: string; color: string }> = {
  YES:   { label: 'Yes',  color: '#107c10' },
  NO:    { label: 'No',   color: '#d13438' },
  BLANK: { label: '—',    color: '#8a8886' },
  PS:    { label: 'PS',   color: '#ff8c00' },
  PC:    { label: 'PC',   color: '#0078d4' },
  SUB:   { label: 'SUB',  color: '#8764b8' },
  OTS:   { label: 'OTS',  color: '#038387' },
};

// ─── CHECKLIST (ROOT) ────────────────────────────────────
export interface Checklist {
  id: string;
  jobReference: string;
  title: string;
  currentRevisionNumber: number;
  status: 'draft' | 'in-review' | 'final';
  workgroups: Workgroup[];
  revisions: Revision[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── WORKGROUP ───────────────────────────────────────────
export interface Workgroup {
  id: string;
  checklistId: string;
  number: number;        // 20, 40, 180, 510
  name: string;
  rows: ChecklistRow[];
  summaryNotes?: string;
  order: number;
}

// ─── CHECKLIST ROW ───────────────────────────────────────
export interface ChecklistRow {
  id: string;
  workgroupId: string;
  description: string;
  answer: AnswerState;
  notes: string;
  markedForReview: boolean;
  images: ChecklistImage[];
  references?: string[];
  order: number;
}

// ─── INLINE IMAGE ────────────────────────────────────────
export interface ChecklistImage {
  id: string;
  rowId: string;
  caption?: string;
  source: string;
  order: number;
}

// ─── REVISION ────────────────────────────────────────────
export interface Revision {
  id: string;
  checklistId: string;
  number: number;
  summary: string;
  snapshot: Checklist;
  createdBy: string;
  createdAt: Date;
}

// ─── USER CONTEXT ────────────────────────────────────────
export interface UserContext {
  id: string;
  name: string;
  email: string;
  role: 'estimator' | 'reviewer' | 'admin';
}
```

---

## Phase 1.3: Service Interfaces & Mocks

### [NEW] src/services/interfaces.ts

```typescript
export interface IChecklistService {
  getChecklist(id: string): Promise<Checklist>;
  getAllChecklists(): Promise<Checklist[]>;
  saveChecklist(checklist: Checklist): Promise<void>;
  createChecklist(title: string, jobReference: string): Promise<Checklist>;
  deleteChecklist(id: string): Promise<void>;
}

export interface IRevisionService {
  createRevision(checklistId: string, summary: string): Promise<Revision>;
  getRevisions(checklistId: string): Promise<Revision[]>;
}

export interface IImageService {
  addImage(rowId: string, source: string, caption?: string): Promise<ChecklistImage>;
  removeImage(imageId: string): Promise<void>;
}

export interface IUserService {
  getCurrentUser(): Promise<UserContext>;
}
```

### [NEW] src/services/mockChecklistService.ts
- In-memory array storage
- `Promise.resolve()` for async simulation
- Deep clone on save to prevent mutation

### [NEW] src/services/mockRevisionService.ts
- Creates snapshot of current checklist
- Auto-increments revision number

### [NEW] src/services/mockImageService.ts
- Generates UUID for new images
- Stores Base64 in memory

### [NEW] src/services/mockData.ts

**Realistic mock checklist:**
```typescript
const mockChecklist: Checklist = {
  id: 'CL-001',
  jobReference: 'PRJ-2024-0142',
  title: 'Smith Residence - New Build',
  status: 'draft',
  workgroups: [
    {
      number: 20, name: 'Preliminaries',
      rows: [
        { description: 'Site establishment', answer: 'YES', notes: 'Standard setup. Builder to confirm crane access...' },
        { description: 'Temporary fencing', answer: 'PS', notes: 'Allowance $3,500. Subject to site conditions.' },
      ]
    },
    {
      number: 40, name: 'Demolition',
      rows: [
        { description: 'Existing structure removal', answer: 'NO', notes: 'Client confirmed no demolition required.' },
      ]
    },
    {
      number: 180, name: 'Structural',
      rows: [
        { description: 'Concrete slab', answer: 'YES', notes: 'M40 concrete. Engineer to confirm reinforcement schedule.' },
        { description: 'Steel framing', answer: 'SUB', notes: 'Subcontractor: ABC Steel. Quote ref #ST-2024-88.' },
      ]
    },
    {
      number: 510, name: 'Plumbing',
      rows: [
        { description: 'Rough-in plumbing', answer: 'YES', notes: 'Allowance for 2x WC, 1x shower, kitchen. Excludes spa bath.' },
        { description: 'Hot water system', answer: 'OTS', notes: 'Owner to supply Rinnai B26. We install only.' },
      ]
    },
  ],
  revisions: [
    { number: 1, summary: 'Initial estimate based on preliminary drawings', createdAt: '2024-11-15' }
  ]
};
```

### [NEW] src/services/index.ts
- Factory function to get service instances
- Easy swap from mock to real services later

---

## Phase 1.4: State Management

### [NEW] src/stores/checklistStore.ts

```typescript
interface ChecklistState {
  checklists: Checklist[];
  activeChecklistId: string | null;
  isLoading: boolean;
  isSaving: boolean;
  lastSaved: Date | null;
  
  // Actions
  setChecklists: (checklists: Checklist[]) => void;
  setActiveChecklist: (id: string) => void;
  updateRow: (workgroupId: string, rowId: string, updates: Partial<ChecklistRow>) => void;
  addRow: (workgroupId: string) => void;
  deleteRow: (rowId: string) => void;
  toggleAnswer: (rowId: string, answer: AnswerState) => void;
  addImage: (rowId: string, image: ChecklistImage) => void;
  removeImage: (imageId: string) => void;
  triggerAutoSave: () => void;
}
```

### [NEW] src/stores/userStore.ts
- Mock user context: `{ name: 'John Smith', role: 'estimator' }`

---

## Phase 1.5: Dashboard

### [NEW] src/components/Dashboard/Dashboard.tsx
- Responsive grid (1 col mobile, 2 tablet, 3 desktop)
- Header with "Create New" button
- List of ChecklistCard components

### [NEW] src/components/Dashboard/ChecklistCard.tsx
- Fluent UI Card
- Status badge (Draft/In Review/Final)
- Job reference, title, last updated
- Click to navigate to editor

---

## Phase 1.6: Checklist Editor

### [NEW] src/components/Editor/ChecklistEditor.tsx
- Document-style vertical layout
- Header: title, job ref, status, save indicator
- Maps workgroups to WorkgroupSection components
- Auto-save on changes (debounced 2s)

### [NEW] src/components/Editor/WorkgroupSection.tsx
- Header: `{number} — {name}` (e.g. "20 — Preliminaries")
- Fluent UI Card container
- List of ChecklistRowItem components
- "Add row" button at bottom
- Optional summary notes field

### [NEW] src/components/Editor/ChecklistRowItem.tsx
- **Description**: Read-only or editable text
- **AnswerSelector**: Inline 7-state toggle (color-coded pills)
- **Notes**: Auto-growing Textarea (no char limit)
- **Images**: Inline thumbnails with delete action
- **Review flag**: Toggle button
- **Keyboard**: Enter adds new row, Backspace on empty deletes

### [NEW] src/components/Editor/AnswerSelector.tsx
- Fluent UI MenuButton or Dropdown
- 7 options with color indicators
- Inline toggle (no modal)

### [NEW] src/components/Editor/InlineImageArea.tsx
- Paste handler (Ctrl+V captures clipboard image)
- Drag-drop zone
- Immediate Base64 preview
- Thumbnail grid with captions

### [NEW] src/components/Editor/AutoSaveIndicator.tsx
- States: Idle, Saving..., Saved ✓
- Subtle bottom-right position

---

## Phase 1.7: Revisions

### [NEW] src/components/Revision/RevisionPanel.tsx
- Sidebar or modal panel
- Create revision button + summary input
- List of RevisionCard components

### [NEW] src/components/Revision/RevisionCard.tsx
- "REV {n}" badge
- Human-written summary
- Created date and user
- Click to view snapshot

### [NEW] src/components/Revision/RevisionViewer.tsx
- Read-only checklist display
- Dimmed styling, "Historical Snapshot" badge
- Close button to return to editor

---

## Phase 1.8: PDF Export

### [NEW] src/components/Export/PdfPreview.tsx
- Document-style layout matching editor
- Workgroup headers, rows, notes, images

### [NEW] src/components/Export/ExportButton.tsx
- jsPDF + html2canvas integration
- "Export PDF" button
- Downloads file: `{jobReference}-checklist.pdf`

---

## Application Entry

### [NEW] src/index.tsx
```tsx
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
ReactDOM.render(
  <FluentProvider theme={webLightTheme}><App /></FluentProvider>,
  document.getElementById('root')
);
```

### [NEW] src/App.tsx
- Simple routing: Dashboard vs Editor view
- State-based navigation (no router library)

---

## Project Structure

```
PAP-CheckList-React/
├── public/index.html
├── src/
│   ├── components/
│   │   ├── Dashboard/
│   │   │   ├── Dashboard.tsx
│   │   │   └── ChecklistCard.tsx
│   │   ├── Editor/
│   │   │   ├── ChecklistEditor.tsx
│   │   │   ├── WorkgroupSection.tsx
│   │   │   ├── ChecklistRowItem.tsx
│   │   │   ├── AnswerSelector.tsx
│   │   │   ├── InlineImageArea.tsx
│   │   │   └── AutoSaveIndicator.tsx
│   │   ├── Revision/
│   │   │   ├── RevisionPanel.tsx
│   │   │   ├── RevisionCard.tsx
│   │   │   └── RevisionViewer.tsx
│   │   └── Export/
│   │       ├── PdfPreview.tsx
│   │       └── ExportButton.tsx
│   ├── models/index.ts
│   ├── services/
│   │   ├── interfaces.ts
│   │   ├── mockChecklistService.ts
│   │   ├── mockRevisionService.ts
│   │   ├── mockImageService.ts
│   │   ├── mockData.ts
│   │   └── index.ts
│   ├── stores/
│   │   ├── checklistStore.ts
│   │   └── userStore.ts
│   ├── App.tsx
│   └── index.tsx
├── tests/
│   ├── setupTests.ts
│   └── components/
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## Verification Plan

### Phase 1.1 Verification
- [x] `npm install` completes without errors
- [x] `npm start` launches dev server
- [x] `npm test` runs Vitest

### Phase 1.2-1.3 Verification
- [x] Models compile with strict TypeScript
- [x] Mock services return realistic data
- [x] `getChecklist()` returns 4+ workgroups

### Phase 1.5 Verification
- [x] Dashboard shows checklist cards
- [x] Create button adds new checklist
- [x] Click card navigates to editor

### Phase 1.6 Verification
- [x] All 7 answer states toggle correctly
- [x] Notes auto-grow to 500+ characters
- [x] Paste image shows inline preview
- [x] Auto-save indicator works

### Phase 1.7 Verification
- [x] Create revision with summary
- [x] View read-only snapshot
- [x] Clear visual distinction

### Phase 1.8 Verification
- [x] PDF preview matches layout
- [x] Download produces valid PDF

---

## Phase 2: Optimization & Enhancements (In Progress/Partially Complete)

### Phase 2.1: Image Optimization
- **Lazy Loading**: Fetch images only when row expanded.
- **Resizing**: Client-side resizing (Max 1920px) before upload.
- **Thumbnails**: Use SharePoint thumbnails for grid view.
- **Auto-Naming**: Default new rows to "{Workgroup} Item {N}".

### Phase 2.2: Advanced Revisions
- **Architecture**: Store snapshots as JSON files in Dataverse `File` column (`pap_snapshotfile`).
- **Completeness**: Fetch all image metadata before snapshotting.
- **Progress UI**: Show progress bars for snapshot generation.

### Phase 2.3: PDF Generation
- **Engine**: Client-side generation using `jspdf`.
- **Quality**: Use 'Large' Graph API variants (optimized high-res).
- **Branding**:
    - Manage Client Logo in "Checklist Info" tab (stored in SharePoint).
    - Fallback to PAP Logo.
- **Upload**: Auto-upload generated PDF to `reports/` folder in SharePoint.

---

## Phase 3: Maintenance & Production Readiness

### Phase 3.1: Documentation & Scripts
- [x] Update Backend Implementation Plan to match real schema.
- [x] Update Environment Setup Guide.
- [x] Refine provisioning and seeding scripts.
- [x] Create Migration/Deployment Guide.


