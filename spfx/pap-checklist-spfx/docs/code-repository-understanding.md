# Code Repository Understanding

**Project:** PAP Checklist React
**Version:** 1.0.0
**Context:** Construction Estimator "OneNote-style" Checklist Application

This document is the definitive technical guide for the PAP Checklist codebase. It is designed to allow a new developer to understand every aspect of the project, from high-level architecture to specific implementation details of key features.

---

## 1. Technology Stack

The application is a Single Page Application (SPA) built on a modern Microsoft-aligned stack.

### Core Frameworks
*   **Runtime:** [React 17.0.2](https://reactjs.org/) - Chosen for stability and compatibility with existing enterprise environments.
*   **Build Tool:** [Vite 5.4.0](https://vitejs.dev/) - Provides near-instant dev server start and optimized production builds.
*   **Language:** [TypeScript ~5.4.0](https://www.typescriptlang.org/) - Strict mode enabled for type safety.

### UI & Styling
*   **Component Library:** [Fluent UI React Components v9](https://react.fluentui.dev/) - Microsoft's latest design system, ensuring consistent look-and-feel with Dynamics 365.
*   **Styling Engine:** SCSS Modules (`*.module.scss`) with `sass-embedded`.
*   **Icons:** `@fluentui/react-icons`.

### State & Logic
*   **State Management:** [Zustand](https://github.com/pmndrs/zustand) - Minimalist store for global state (User, Checklists, UI flags).
*   **Rich Text Editor:** [TipTap](https://tiptap.dev/) - Headless WYSIWYG editor for row descriptions.
*   **PDF Generation:** `jspdf` + `jspdf-autotable` (Custom manual rendering engine).

### Backend & Auth
*   **Identity:** [MSAL Browser v3](https://github.com/AzureAD/microsoft-authentication-library-for-js) (Azure Active Directory).
*   **API:** Microsoft Dataverse Web API (OData v4).
*   **File Storage:** Microsoft SharePoint (via Graph API or direct integration).

---

## 2. Project Structure

Everything of importance lives in `src/`. Here is the anatomy of the codebase:

```text
src/
├── components/          # React Components (View Layer)
│   ├── Checklist/       # Shared checklist-specific components
│   ├── Dashboard/       # Dashboard view (Checklist List)
│   │   ├── ChecklistCard.tsx     # Individual card item
│   │   └── Dashboard.tsx         # Main grid view
│   ├── Editor/          # The Core Editing Interface
│   │   ├── Sidebar/     # Info panels, revision history, activity log
│   │   │   ├── ActivityLogPanel.tsx  # Timeline view of changes
│   │   │   ├── ChecklistFiles.tsx    # File attachment manager
│   │   │   ├── CommonNotes.tsx       # Shared notes with rich text
│   │   │   └── CollaborationSidebar.tsx # Sidebar container
│   │   ├── ChecklistEditor.tsx   # Main orchestrator
│   │   ├── ChecklistRowItem.tsx  # Atomic row component (Input + Actions)
│   │   ├── RichTextEditor.tsx    # TipTap wrapper
│   │   └── WorkgroupSection.tsx  # Collapsible section container

│   └── Revision/        # Revision viewing UI
├── config/              # Static Configuration
│   └── environment.ts   # URLs, Client IDs, Tenant IDs
├── models/              # TypeScript Type Definitions
│   └── index.ts         # Shared interfaces (Checklist, Row, User)
├── providers/           # Context Providers
│   └── AuthProvider.tsx # MSAL User Context wrapper
├── services/            # API Communication Layer (The "Backend" logic)
│   ├── dataverseService.ts          # Generic OData Client (GET/POST/PATCH)
│   ├── dataverseChecklistService.ts # Domain logic for Checklists
│   ├── activityLogService.ts        # Activity log (1-row/day JSON)
│   ├── PdfGeneratorService.ts       # Manual PDF Layout Engine
│   ├── serviceFactory.ts            # Dependency Injection container
│   └── sharePointService.ts         # Image & File upload handling
├── stores/              # Global State
│   ├── checklistStore.ts # The "Brain" - Actions & State
│   └── userStore.ts     # User profile data
├── styles/              # Global variables & Mixins
│   ├── _mixins.scss     # Media queries, flex helpers
│   ├── _variables.scss  # Brand colors, spacing tokens
│   └── global.scss      # Reset & base styles
├── utils/               # Helper Functions
│   └── pdfRichTextRenderer.ts # Translates HTML -> PDF Draw Commands
├── App.tsx              # Main routing component
└── index.tsx            # Entry point (Theme & Auth setup)
```

---

## 3. Architecture & Data Flow

### The "Service-Store-Component" Pattern

We follow a strict unidirectional data flow for consistency.

1.  **Component (UI)**: Dispatches an action (e.g., `toggleAnswer`).
2.  **Store (Zustand)**:
    *   **Optimistically** updates the local state immediately (UI updates instantly).
    *   **Asynchronously** calls the Service Layer.
    *   **Rolls back** state if the Service call fails (with an error toast).
3.  **Service (API)**:
    *   Constructs the OData payload.
    *   Uses `dataverseService` to inject the Auth Token.
    *   Executes the HTTP request to Dynamics 365.

### Authentication Flow (MSAL)
Located in `src/providers/AuthProvider.tsx`.
1.  App initializes `MsalProvider`.
2.  Checks for active cached account.
3.  If no account, triggers `signIn()` (Popup or Redirect based on config).
4.  Acquires Access Tokens silently for API calls via `dataverseService.ts`.

---

## 4. Key Systems Deep Dive

### 4.1. The Data Schema (Dataverse)

The application maps frontend interfaces to specific Dataverse tables.

#### **Checklist (`pap_checklist`)**
| Field | Type | Description |
|-------|------|-------------|
| `pap_name` | String | Title of the checklist |
| `pap_jobid` | Lookup | Link to `pap_job` (Source of Truth) |
| `pap_status` | Choice | 1 (Draft), 2 (Review), 3 (Final) |
| `pap_clientlogourl` | URL | Link to SharePoint branding asset |
| `pap_chatdata` | Memo (JSON) | Chat comments persisted as JSON array |
| `pap_filedata` | Memo (JSON) | File metadata + SharePoint URLs as JSON array |

#### **Workgroup (`pap_workgroup`)**
*Parent: Checklist*
| Field | Type | Description |
|-------|------|-------------|
| `pap_number` | Number | e.g., 20, 40, 180 (CSI MasterFormat style) |
| `pap_name` | String | e.g., "Preliminaries", "Demolition" |

#### **Row (`pap_checklistrow`)**
*Parent: Workgroup*
| Field | Type | Description |
|-------|------|-------------|
| `pap_description_primary` | String | **Item Name** (Short text) |
| `pap_description` | Memo | **HTML Description** (Rich Text) |
| `pap_notes` | Memo | User Assumptions/Notes |
| `pap_answer` | Choice | 1=YES, 2=NO, 3=BLANK, 4=PS, 5=PC, 6=SUB, 7=OTS |

### 4.2. PDF Gen Protocol (Manual Layout)
**File:** `src/services/PdfGeneratorService.ts`

Unlike typical web apps that "print" the HTML, we implement a **manual rendering engine** using `jspdf`. This is complex but necessary for:
1.  **Strict Pagination:** We must know exactly where a page breaks to repeat headers.
2.  **Rich Text Support:** The `pdfRichTextRenderer.ts` utility parses the TipTap HTML (bold, lists, etc.) and issues raw vector draw commands.
3.  **Image Optimization:** We download images, resize/compress them in memory, and embed them to keep file size manageable.

### 4.3. Optimistic UI Updates
**File:** `src/stores/checklistStore.ts`

When a user clicks "YES", we do not wait for the server.
*   **State:** `checklist.workgroups[i].rows[j].answer` is set to 'YES'.
*   **Debounce:** Rapid changes (typing notes) are debounced (2s) to prevent API flooding.
*   **Sync:** The store maintains a `pendingChanges` queue to ensure order of operations.
*   **Activity Logging:** Key mutations (row add/update/delete, workgroup add/delete, revision create) fire `logActivity()` which records events to the `pap_activitylog` table via a fire-and-forget service call.

### 4.4. Image & File Pipeline
**File:** `src/components/Editor/InlineImageArea.tsx` & `ChecklistFiles.tsx`

1.  **Drop/Paste:** Event captures the `File` object.
2.  **Preview:** `FileReader` creates a local Data URL (Base64) for immediate display (images only).
3.  **Upload:** `SharePointService` uploads the binary to `PAP Attachments/{checklistId}/images/` or `/files/`.
4.  **Reference:** The returned SharePoint URL is saved to the Dataverse record (`pap_checklistrow` or `pap_filedata` JSON).
5.  **Smart Loading:** To prevent 404 errors for rows without images, the `SharePointService` pre-fetches the list of existing image folders (`listImageFolders`) when the checklist loads. The Store then only attempts to fetch detailed image metadata for rows that are known to have folders.

---

## 5. Performance Architecture

### 5.1. Code Splitting (Lazy Loading)
**File:** `src/App.tsx`
To minimize initial bundle size, the heavy `ChecklistEditor` (which includes TipTap, jsPDF, etc.) is lazy-loaded. The Dashboard loads instantly, and the Editor chunk is fetched only when a user opens a checklist.

### 5.2. Render Optimization
**Pattern:** React.memo + Granular Selectors
**Files:** `ChecklistRowItem.tsx`, `WorkgroupSection.tsx`

Since the `checklistStore` is a large global object, typical subscriptions would cause the entire tree to re-render on any change. We mitigate this by:
1.  **Immutability Strategy:** The Store reducers (`updateRow`) only clone the specific Workgroup and Row being modified. Unrelated sections preserve their object references.
2.  **React.memo:** Components are wrapped in `React.memo` to skip rendering if props (row/workgroup) haven't changed.
3.  **Granular Selectors:** Components select only the specific state they need (e.g., `state.addRow` vs `state.processingItems.includes(id)`) instead of the whole store object.

---

## 6. Deployment & Configuration

### Environment Variables
Managed in `src/config/environment.ts`. Do not hardcode URLs in components.
*   `dataverse.url`: The D365 Org URL.
*   `auth.clientId`: Azure App Registration ID.
*   `sharepoint.siteUrl`: The storage backend.

### Build Process
1.  `npm run build`: Runs `tsc` (Type Checking) -> `vite build` (Bundling).
2.  **Output:** `build/` directory containing static HTML/JS/CSS.
3.  **Deployment:** These static files are hosted (e.g., Azure Static Web Apps, IIS, or embedded as a Dataverse Web Resource).

---

## 7. Common Troubleshooting

*   **Auth Popup Blocked:** Ensure the browser allows popups for the dev URL.
*   **401 Unauthorized:** Check that the User is added to the Dataverse Security Role and the Azure App Registration has `user_impersonation` permission.
*   **CORS Errors:** The Dataverse environment must have the UI origin (e.g., `http://localhost:3000`) added to its CORS whitelist (or use a proxy in dev).

---

## 8. Development Guidelines

*   **Naming:** Use `PascalCase` for Components, `camelCase` for functions/variables.
*   **CSS:** Use Clean SCSS Modules. Avoid global CSS.
*   **Testing:** Run `npm test` before commits. Uses Vitest.
*   **Linting:** Follow the ESLint rules provided. No `any` type usage unless absolutely necessary.

This document should provide a complete mental map of the system. Refer to specific files for line-by-line implementation details.
