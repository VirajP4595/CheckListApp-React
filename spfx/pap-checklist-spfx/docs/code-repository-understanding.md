# Code Repository Understanding

**Project:** PAP Checklist SPFx
**Version:** SPFx 1.22.1
**Context:** Construction Estimator Checklist Management Application

This document is the definitive technical guide for the PAP Checklist codebase. It covers architecture, data schemas, key systems, and development guidelines.

---

## 1. Technology Stack

### Platform & Build
- **Platform:** SharePoint Framework (SPFx) 1.22.1 — deployed as an `.sppkg` web part into SharePoint
- **Build Tool:** Heft (`@microsoft/spfx-web-build-rig`) — configured via `heft.json`. TypeScript compiles to ES5 for SharePoint browser compatibility
- **Dev Server:** `https://localhost:4321` (Heft's webpack-dev-server with HMR)
- **Package Output:** `sharepoint/solution/pap-checklist-spfx.sppkg`

### Frontend Framework
- **Runtime:** React 17.0.2 (SPFx-compatible version)
- **Language:** TypeScript ~5.x, strict mode
- **Component Library:** Fluent UI React v9 (`@fluentui/react-components`, `@fluentui/react-icons`)
- **State Management:** Zustand — minimal global stores with granular selectors
- **Styling:** SCSS Modules (`.module.scss`) + shared design tokens in `src/styles/`
- **Rich Text:** TipTap — headless WYSIWYG editor for row descriptions
- **PDF Generation:** `jspdf` + `jspdf-autotable` — manual layout engine

### Authentication & APIs
- **Auth:** Handled automatically by the SPFx host — no MSAL client in the frontend. The web part receives `SpHttpClient` and `AadHttpClient` factory references via the SPFx `WebPartContext`, injected at boot in `PapChecklistWebPart.ts`.
- **Dataverse:** Microsoft Dataverse Web API (OData v9.2)
- **SharePoint:** SharePoint REST API + Microsoft Graph (via `AadHttpClient`) for file/image storage and group membership
- **Email:** Microsoft Graph API (`Mail.Send` scope) via `graphEmailService.ts`
- **Power Automate:** HTTP trigger (signed URL) — invoked from `AdhocChecklistDialog.tsx` via `SpHttpClient`

---

## 2. Project Structure

```
src/
├── webparts/papChecklist/
│   └── PapChecklistWebPart.ts     # SPFx entry point — bootstraps React, injects context
├── App.tsx                         # Root component — Dashboard ↔ Editor routing, deep-link support
├── components/
│   ├── Checklist/
│   │   ├── DeleteProgressModal.tsx
│   │   └── PdfGenerationProgressModal.tsx
│   ├── Dashboard/
│   │   ├── Dashboard.tsx           # Checklist grid with filter state
│   │   ├── ChecklistCard.tsx       # Individual card (job metadata, status, urgency)
│   │   ├── DashboardFilterBar.tsx  # Client + Estimator + Status + Search filters
│   │   └── AdhocChecklistDialog.tsx # Ad-hoc checklist creation via Power Automate
│   ├── Editor/
│   │   ├── ChecklistEditor.tsx     # Main editor orchestrator (lazy-loaded chunk)
│   │   ├── ChecklistRowItem.tsx    # Atomic row — answer selector, flags, images, notes
│   │   ├── WorkgroupSection.tsx    # Collapsible workgroup with Client/Estimator sub-sections
│   │   ├── AnswerSelector.tsx      # Answer state button strip
│   │   ├── InlineImageArea.tsx     # Drag/paste image area per row
│   │   ├── RichTextEditor.tsx      # TipTap wrapper
│   │   ├── FilterBar.tsx           # Editor-level row filters
│   │   ├── NotifyAdminDialog.tsx   # Notify admin email dialog
│   │   ├── CarpentryLabourDialog.tsx
│   │   ├── AutoSaveIndicator.tsx
│   │   ├── HelpGuide.tsx
│   │   └── Sidebar/
│   │       ├── CollaborationSidebar.tsx  # Tabbed sidebar container
│   │       ├── ChecklistInfoPanel.tsx    # Status, job details, export actions
│   │       ├── ChecklistInfoDialog.tsx   # Mobile/dialog variant of info panel
│   │       ├── JobMetadataHeader.tsx     # Job metadata bar (number, type, estimator, etc.)
│   │       ├── ChecklistChat.tsx         # Internal comments feed
│   │       ├── ChecklistFiles.tsx        # File attachment manager
│   │       ├── CommonNotes.tsx           # Shared rich-text notes
│   │       ├── ActivityLogPanel.tsx      # Change timeline
│   │       ├── RevisionListTab.tsx       # Revision history tab
│   │       └── BrandingPanel.tsx         # Client logo upload
│   └── Revision/
│       ├── RevisionViewer.tsx      # Full revision preview
│       ├── RevisionPanel.tsx
│       ├── RevisionSection.tsx
│       └── RevisionCard.tsx
├── config/
│   └── environment.ts              # All runtime config (URLs, group names, Flow URLs)
├── hooks/
│   ├── usePdfExport.ts
│   ├── useBtcExport.ts
│   └── useRfqExport.ts
├── models/
│   └── index.ts                    # All TypeScript interfaces and enums
├── services/
│   ├── dataverseService.ts         # Generic OData HTTP client (GET/POST/PATCH/DELETE)
│   ├── dataverseChecklistService.ts # Checklist/Workgroup/Row CRUD + mapping
│   ├── dataverseRevisionService.ts  # Revision create/fetch
│   ├── dataverseJobService.ts       # Job lookup for ad-hoc dialog
│   ├── activityLogService.ts        # Activity log (1-row/day JSON blob)
│   ├── sharePointService.ts         # Image & file upload/download via SharePoint REST
│   ├── sharePointGroupService.ts    # SP group membership check (super admin)
│   ├── graphEmailService.ts         # Graph email sending (Mail.Send)
│   ├── PdfGeneratorService.ts       # Manual PDF layout engine (jsPDF)
│   ├── BtcExportService.ts          # Builder To Confirm export
│   ├── RfqExportService.ts          # RFQ summary email export
│   ├── serviceFactory.ts            # Dependency injection — initialised in WebPart.ts
│   └── interfaces.ts               # Service interfaces (IChecklistService, etc.)
├── stores/
│   ├── checklistStore.ts            # All checklist data + UI state + CRUD actions
│   └── userStore.ts                 # User identity, isSuperAdmin (5min cache), loading guard
├── styles/
│   ├── _variables.scss              # All design tokens (colors, spacing, shadows, transitions)
│   ├── _mixins.scss                 # Shared utilities (input-filled, media queries)
│   └── global.scss                  # Reset & base styles
└── utils/
    └── pdfRichTextRenderer.ts       # Converts TipTap HTML → jsPDF draw commands
```

---

## 3. Architecture & Data Flow

### SPFx Bootstrap
`PapChecklistWebPart.ts` is the SPFx entry point. It:
1. Receives the `WebPartContext` from SharePoint (contains `SpHttpClient`, `AadHttpClientFactory`, user identity)
2. Passes context into `serviceFactory.ts` which instantiates all services with the correct HTTP clients
3. Renders `<App />` with services injected via props

### Service → Store → Component Pattern

Strict unidirectional data flow:

1. **Component** dispatches a Zustand action (e.g., `updateRow(rowId, patch)`)
2. **Store** optimistically updates local state immediately (instant UI response), then calls the service
3. **Service** constructs the OData payload, calls `dataverseService.ts` (which injects the auth token), and executes the HTTP request
4. On failure: store rolls back state and shows an error toast

### Authentication (SPFx-managed)
- No MSAL client in this project — auth is entirely managed by the SharePoint host
- `dataverseService.ts` uses `AadHttpClient` (provisioned for the Dataverse resource) to acquire tokens transparently
- `sharePointService.ts` uses `SpHttpClient` for SharePoint REST calls
- `graphEmailService.ts` uses `AadHttpClient` (provisioned for `https://graph.microsoft.com`)

---

## 4. Key Systems Deep Dive

### 4.1. Domain Models (`src/models/index.ts`)

#### AnswerState (11 values)
| Code | Label | Meaning |
|------|-------|---------|
| `YES` | Yes | Included in scope |
| `NO` | Noted as Excluded | Explicitly excluded |
| `BLANK` | Nothing Selected | Intentionally unanswered |
| `PS` | PS | Provisional Sum |
| `PC` | PC | Prime Cost |
| `SUB` | Subquote / Subcontractor Quote | Subcontractor supplied |
| `OTS` | OTS | Owner to Supply |
| `TBC` | TBC | To Be Confirmed |
| `OPT_EXTRA` | Optional Extra | Optional scope item |
| `BUILDER_SPEC` | Builder Spec / Standard | Builder specification |
| `RFQ` | RFQ | Request for Quote (requires supplier name + email) |

#### ChecklistStatus (4 values)
| Code | Label | Dataverse Value |
|------|-------|----------------|
| `draft` | Draft | 1 |
| `in-review` | In Review | 2 |
| `in-revision` | In Revision | 4 |
| `final` | Final | 3 |

#### RowSection (2 values)
| Code | Label | Dataverse Value |
|------|-------|----------------|
| `client` | Checklist Filler / Client | 1 |
| `estimator` | Estimator | 2 |

#### ChecklistRow (key fields)
```ts
interface ChecklistRow {
    id: string;
    workgroupId: string;
    section?: RowSection;        // Sub-section within the workgroup
    name: string;                // Short item name
    description: string;         // Rich text HTML description
    answer: AnswerState;
    supplierName?: string;       // Only when answer = 'RFQ'
    supplierEmail?: string;      // Only when answer = 'RFQ'
    notes: string;
    markedForReview: boolean;
    notifyAdmin: boolean;        // Triggers admin notification email
    builderToConfirm: boolean;   // BTC flag — included in BTC export
    internalOnly: boolean;
    images: ChecklistImage[];
    order: number;
}
```

#### Checklist (key fields)
```ts
interface Checklist {
    id: string;
    title: string;
    status: ChecklistStatus;
    workgroups: Workgroup[];
    revisions: Revision[];
    jobDetails?: {
        jobName: string;
        jobNumber: string;
        clientName: string;
        leadEstimator?: string;
        reviewer?: string;
        dueDate?: Date;
        jobType?: string;
        meetingOccurred?: boolean;   // Controls meeting-transcript row visibility
        // QBE fields (editor-only):
        qbeFlagged?: boolean;
        qbeLow?: number | null;
        qbeHigh?: number | null;
        siteAddress?: string;
        threeDModel?: boolean | null;
    };
    // ...
}
```

### 4.2. Dataverse Schema

#### `pap_checklist`
| Column | Type | Notes |
|--------|------|-------|
| `pap_checklistid` | GUID | Primary key |
| `pap_name` | String | Checklist title |
| `pap_status` | Choice | 1=Draft, 2=In Review, 3=Final, 4=In-Revision |
| `pap_jobid` | Lookup → `pap_job` | Source of truth for job metadata |
| `pap_currentrevisionnumber` | Int | Incremented on each revision |
| `pap_commonnotes` | Memo | Shared rich-text notes |
| `pap_clientlogourl` | String | SharePoint URL for branding logo |
| `pap_chatdata` | Memo (JSON) | Internal comment thread |
| `pap_filedata` | Memo (JSON) | Attached file metadata array |
| `pap_carpentrylabourimageurl` | String | Carpentry labour image |
| `pap_carpentrylabourdescription` | String | Carpentry labour notes |
| `statecode` | Int | 0=Active, 1=Inactive (archived). `getAllChecklists()` filters `statecode eq 0` |

#### `pap_workgroup`
| Column | Type | Notes |
|--------|------|-------|
| `pap_workgroupid` | GUID | Primary key |
| `pap_checklistid` | Lookup → `pap_checklist` | Parent checklist |
| `pap_number` | Int | CSI-style number (20, 40, 180…) — used for sort order |
| `pap_name` | String | Section name (e.g., "Preliminaries") |
| `pap_order` | Int | Display order (legacy, prefer `pap_number` for sorting) |
| `pap_summarynotes` | Memo | Workgroup-level notes |

#### `pap_checklistrow`
| Column | Type | Notes |
|--------|------|-------|
| `pap_checklistrowid` | GUID | Primary key |
| `pap_workgroupid` | Lookup → `pap_workgroup` | Parent workgroup |
| `pap_description_primary` | String | Item name (short) |
| `pap_description` | Memo | Rich text HTML description |
| `pap_notes` | Memo | Assumptions/notes |
| `pap_answer` | Choice | 1=YES, 2=NO, 3=BLANK, 4=PS, 5=PC, 6=SUB, 7=OTS, 8=TBC, 9=OPT_EXTRA, 10=BUILDER_SPEC, 11=RFQ |
| `pap_section` | Choice | 1=Client, 2=Estimator |
| `pap_suppliername` | String (100) | Supplier name — only for RFQ rows |
| `pap_supplieremail` | String (200) | Supplier email — only for RFQ rows |
| `pap_buildertoconfirm` | Boolean | BTC flag |
| `pap_notifyadmin` | Boolean | Notify admin flag |
| `pap_markedforreviewed` | Boolean | Mark for review |
| `pap_internalonly` | Boolean | Internal-only row |
| `pap_order` | Int | Row position within workgroup |

#### `pap_job` (read-only via `$expand`)
| Column | Notes |
|--------|-------|
| `vin_name` | Job name |
| `vin_jobnumber` | Job number |
| `_vin_account_value` | Client name (lookup formatted value) |
| `_vin_estimator_value` | Lead estimator (lookup formatted value) |
| `_ownerid_value` | Reviewer (owner formatted value) |
| `vin_duedate` | Due date |
| `vin_jobtype` | Job type label |
| `vin_jobstartmtg` | Meeting occurred (bool) |
| `vin_buildarea` | Site address |
| `vin_qbeflagged` | QBE flagged |
| `vin_qbelow` / `vin_qbehigh` | QBE estimate range |
| `vin_dmodelsuited` | 3D model suitable |

#### `pap_revision`
Stores revision snapshots. Each revision has a title, summary, and a set of `pap_workgroup` rows linked to the revision (not the original checklist) via `pap_revisionid` lookup.

#### `pap_activitylog`
One row per checklist per day. `pap_entries` is a JSON array of activity events (row_added, row_updated, file_uploaded, etc.).

### 4.3. PDF Export Engine
**File:** `src/services/PdfGeneratorService.ts`

Manual rendering using `jsPDF` — does not print the HTML DOM. Required for:
- Strict pagination with repeated headers across pages
- Rich text rendering: `pdfRichTextRenderer.ts` parses TipTap HTML to vector draw commands
- Image optimization: downloads, resizes, and embeds images at controlled quality
- Section sub-headers per workgroup (Client / Estimator sections)
- Job type included in header metadata line
- Supplier info rendered below RFQ rows

### 4.4. Optimistic UI Updates
**File:** `src/stores/checklistStore.ts`

When a user clicks an answer state:
1. Store immediately patches local state (React re-renders at once)
2. A debounced (300ms) background call fires to `dataverseChecklistService.ts`
3. `processingItems` Set tracks in-flight rows (shows spinner)
4. On API failure: state is rolled back and an error toast is shown
5. Key mutations also call `activityLogService.logActivity()` (fire-and-forget)

### 4.5. Super Admin Gating
**File:** `src/stores/userStore.ts`

`isSuperAdmin` is determined by SharePoint group membership (`SP_Checklist_SuperAdmin`). The result is cached in `sessionStorage` with a 5-minute TTL. The `isAdminChecked` flag prevents UI from rendering privileged actions before the check resolves (avoids flashing).

### 4.6. Image Pipeline
**File:** `src/components/Editor/InlineImageArea.tsx`, `sharePointService.ts`

1. User drags/pastes → `FileReader` creates a local Base64 Data URL for instant preview
2. `SharePointService` uploads binary to `PAP Attachments/{checklistId}/images/`
3. Returned SharePoint URL replaces the Base64 source in the row's `images[]` array
4. On checklist load: `listImageFolders()` pre-fetches which rows have image folders — the store only fetches image metadata for rows that are known to have them (eliminates hundreds of 404s for empty rows)

---

## 5. Configuration (`src/config/environment.ts`)

```ts
export const AppConfig = {
    dataverse: {
        url: "https://[org].crm.dynamics.com",
        apiPath: "/api/data/v9.2",
        publisherPrefix: "pap_"
    },
    sharepoint: {
        absoluteUrl: "https://[tenant].sharepoint.com/sites/[site]",
        documentLibrary: "PAPAttachments"
    },
    admin: {
        superAdminGroup: "SP_Checklist_SuperAdmin",
        btcAdminEmail: "admin@example.com"
    },
    powerAutomate: {
        createChecklistFlowUrl: "https://[flow-trigger-url]"  // Signed HTTP trigger URL
    }
};
```

> **Security note:** The `createChecklistFlowUrl` is a signed trigger URL visible in client source. This is a known trade-off for SPFx (no server-side proxy available without additional infrastructure). Rotate the signature if it is exposed outside the organisation.

---

## 6. Build & Deployment

### Development
```bash
cd spfx/pap-checklist-spfx
npm run start        # Heft build-watch + webpack dev server on https://localhost:4321
```
Open the Hosted Workbench: `https://[tenant].sharepoint.com/sites/[site]/_layouts/15/workbench.aspx`

### Production Build
```bash
npm run build        # Full Heft build + gulp bundle --ship + package-solution --ship
npm run clean        # Clean build artifacts
```
Output: `sharepoint/solution/pap-checklist-spfx.sppkg`

### Deployment
1. Upload `.sppkg` to SharePoint App Catalog
2. Deploy (make available to all sites)
3. Approve pending API access requests in SharePoint Admin → Advanced → API Access

---

## 7. Performance Architecture

### Code Splitting
`ChecklistEditor` (heavy: TipTap, jsPDF) is lazy-loaded via `React.lazy`. The Dashboard loads instantly; the Editor chunk is fetched only when a checklist is opened.

### Render Optimisation
- `ChecklistRowItem` and `WorkgroupSection` are wrapped in `React.memo`
- `filteredRows` inside `WorkgroupSection` is memoised with `useMemo([workgroup.rows, filters])`
- Store reducers only clone the specific workgroup/row being modified — unrelated sections keep their object references, preventing tree-wide re-renders
- Granular Zustand selectors (components subscribe to `state.addRow`, not `state`)

### Image Loading
`listImageFolders()` on checklist open builds an allowlist of rows that have images. Only those rows attempt metadata fetches, eliminating N×404 requests for empty rows.

---

## 8. Common Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| 401 Unauthorized | User not in Dataverse security role, or API permissions not approved | Add user to Dataverse role; approve API Access in SharePoint Admin |
| 403 on Graph email | `Mail.Send` scope not approved | Approve in SharePoint Admin → API Access |
| Images not loading | SharePoint permissions or deleted folder | Verify `PAP Attachments` library permissions |
| Super admin actions not showing | `isAdminChecked` still loading, or user not in `SP_Checklist_SuperAdmin` group | Wait for load; verify SP group membership |
| Ad-hoc flow not triggering | Flow URL revoked or incorrect environment | Update `createChecklistFlowUrl` in `environment.ts` |

---

## 9. Development Guidelines

- **Naming:** `PascalCase` for components, `camelCase` for functions/variables, `SCREAMING_SNAKE` for constants
- **CSS:** SCSS Modules only. No inline styles. Use `_variables.scss` tokens. Use `@include input-filled` for input fields.
- **No `any`:** Avoid TypeScript `any` unless absolutely necessary
- **Testing:** Heft/Jest — run `npm test` before commits
- **Linting:** ESLint with SPFx ruleset — `npm run lint`
- **State:** Never mutate store state directly. Always use immutable spread patterns in store reducers.
