> **Status: COMPLETED**
> This migration plan has been executed. The project is now an SPFx solution located in `spfx/pap-checklist-spfx`. This document is preserved for historical context.

---

## Goal
Migrate the existing PAP Checklist React application (Vite-based) to a SharePoint Framework (SPFx) Web Part solution to enable native deployment to SharePoint Online and Microsoft Teams.

## Strategy
Instead of converting the current project in-place (which is error-prone due to build tool differences), we will **scaffold a clean SPFx solution** and incrementally migrate the code. This ensures a stable foundation with the correct Microsoft build benchmarks.

> [!IMPORTANT]
> **New Project Location:** We will create a sibling directory `c:\Projects\PAP-CheckList-SPFx` for the new solution.

## Phase 1: Environment & Scaffolding
- [ ] Check/Install prerequisites (Node.js v18, Gulp, Yeoman, SPFx Generator).
- [ ] Scaffold new SPFx project:
    - **Solution Name:** `pap-checklist-spfx`
    - **Framework:** React
    - **Environment:** SharePoint Online only (latest)
- [ ] Install dependencies matching the valid SPFx React version (likely 17.x).
- [ ] Install project libraries: `zustand`, `tiptap`, `jspdf`, `@fluentui/react-components` (check compatibility with SPFx legacy Fluent UI).

## Phase 2: Architecture Refactoring (The Critical Part)
SPFx handles Authentication and Context differently. We must replace our standalone services.

### 1. Authentication (`authService.ts`)
- **Current:** Uses `@azure/msal-browser` with manual popup/redirect.
- **New:** Use `WebPartContext.aadHttpClientFactory`.
- **Action:** Create `SPFxDataverseService` that implements the same interface as our `DataverseService` but uses the SPFx context.

### 2. File Storage (`sharePointService.ts`)
- **Current:** Uses Graph API with manual token.
- **New:** Use `WebPartContext.msGraphClientFactory`.
- **Action:** Refactor `SharePointService` to use the SPFx Graph Client.

### 3. Styling
- **Current:** SCSS Modules with Vite.
- **New:** SCSS Modules with Gulp (SPFx default).
- **Migration:** Copy `.module.scss` files. Update imports if necessary (SPFx uses `require` or type-safe imports).
- **Fluent UI:** We are using `@fluentui/react-components` (v9). SPFx comes with v8 (`@fluentui/react`). We can use v9 side-by-side but need to ensure the `FluentProvider` is correctly wrapped.

## Phase 3: component Migration
- [ ] Copy `src/models` (Interfaces are identical).
- [ ] Copy `src/stores` (Zustand logic is environment-agnostic).
- [ ] Copy `src/components` folder.
- [ ] **App.tsx Refactor:** The main entry point will no longer be `index.tsx` but the `PapChecklistWebPart.ts` render method.
- [ ] Remove `AuthProvider.tsx` (SPFx provides the user context).

## Phase 4: Deployment
- [ ] Bundle (`gulp bundle --ship`).
- [ ] Package (`gulp package-solution --ship`).
- [ ] Deploy `.sppkg` to App Catalog.
- [ ] Add to a SharePoint Page and Test.

## Interactive Questions
1. Do you have the SPFx development environment set up (Node 16/18)?
2. Should we start scaffolding now?
