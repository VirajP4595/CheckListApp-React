# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Working Directory

All `npm` commands and SPFx code live in `spfx/pap-checklist-spfx/`. Always run commands from there:

```bash
cd spfx/pap-checklist-spfx
npm run start    # Dev server (Heft + webpack HMR)
npm run build    # Full production build + package-solution
npm run clean    # Clean build artifacts
```

Build is managed by **Heft** (`@microsoft/spfx-web-build-rig`). TypeScript targets ES5 for SharePoint browser compatibility.

## Documentation

`spfx/pap-checklist-spfx/docs/` contains architecture, implementation plans, and business context. Key files:
- `docs/NewSessionPrompt.md` — role definition and coding directives for this project
- `docs/code-repository-understanding.md` — full technical reference
- `docs/UAT_Feedback/` — active UAT work: implementation plans, revision system changes, status/flag work

## Architecture

This is a **SharePoint Framework (SPFx) 1.22.1** web part. The entry point `src/webparts/papChecklist/PapChecklistWebPart.ts` bootstraps React and injects SPFx context (user identity, tokens) into the app.

**Purpose**: Construction estimation management — estimators create/edit checklists tied to Dataverse job records, fill workgroup rows with answer states, attach images, and export to PDF/BTC/RFQ formats.

### State Management (`src/stores/`)
- `checklistStore.ts` — all checklist data (checklists, workgroups, rows, images, revisions) + UI state
- `userStore.ts` — user identity, `isSuperAdmin` flag, `isAdminChecked` loading guard

Super admin status is determined by SharePoint group membership (`SP_Checklist_SuperAdmin`) and cached for 5 minutes.

### Service Layer (`src/services/`)
All external API calls are abstracted here, initialized via `serviceFactory.ts`:
- **Dataverse** (`dataverseChecklistService.ts`, `dataverseRevisionService.ts`, `dataverseJobService.ts`) — primary data store using OData v9.2; tables: `pap_checklist`, `pap_workgroup`, `pap_checklistrow`, `pap_revision`, `pap_job`
- **SharePoint** (`sharePointService.ts`, `sharePointGroupService.ts`) — document library "PAPAttachments" for images/files, group membership checks
- **Graph** (`graphEmailService.ts`) — email notifications (Mail.Send scope)
- **Export** (`PdfGeneratorService.ts`, `BtcExportService.ts`, `RfqExportService.ts`) — PDF via jsPDF, BTC and RFQ formats
- **Power Automate** (`powerAutomateService.ts`) — flow trigger for ad-hoc checklist creation

### Component Structure
- `App.tsx` — root; switches between Dashboard and Editor views; supports `?checklistId=` deep-link
- `src/components/Dashboard/` — checklist list (`ChecklistCard.tsx`), filter bar (`DashboardFilterBar.tsx`), ad-hoc create dialog
- `src/components/Editor/` — main editor (`ChecklistEditor.tsx`, lazy-loaded chunk `checklist-editor`), `WorkgroupSection.tsx` for grouped rows, `ChecklistRowItem.tsx` for individual items
- `src/components/Editor/Sidebar/` — tabbed sidebar: info panel, chat, files, activity log, revisions
- `src/components/Revision/` — revision viewer/panel

### Domain Models (`src/models/index.ts`)
- `ChecklistStatus`: `draft | in-review | in-revision | final`
- `AnswerState`: `YES | NO | BLANK | PS | PC | SUB | OTS | TBC | OPT_EXTRA | BUILDER_SPEC | RFQ`
- `RowSection`: `'client' | 'estimator'`
- `Checklist.jobDetails` — enriched job metadata (jobName, jobNumber, clientName, leadEstimator, reviewer, dueDate, jobType, meetingOccurred)

### Configuration
`src/config/environment.ts` holds all runtime config: Dataverse URL, SharePoint site, Power Automate flow URLs, admin group name.

## Design System

All UI follows a **Premium Aesthetic** enforced via `src/styles/`:
- `_variables.scss` — all design tokens (colors, spacing, shadows, transitions, border-radius)
- `_mixins.scss` — shared utilities including `@include input-filled;`

**Rules:**
- Always use SCSS modules (`.module.scss`). No inline styles.
- Use `$color-white`, `$color-border`, `$shadow-premium` from `_variables.scss`
- Interactive elements use `transition: all $transition-base;`
- Status indicators use pill design (`border-radius: $border-radius-full;`)
- Row action icons are `opacity: 0.4` at rest, `opacity: 1` on hover
- Input fields use `@include input-filled;` with focus ring `box-shadow: 0 0 0 2px $input-focus-ring`
- Spacing via `$spacing-3`, `$spacing-4` etc.

## Current UAT Work

Active branch: `feature/uat-feedback`. See `docs/UAT_Feedback/` for full plans. Key completed work:
- Job metadata enrichment on cards (due date urgency, job type badge, estimator/reviewer)
- Status dropdown redesign + Notify Admin flag + BTC flag with PDF export
- Insert row feature in WorkgroupSection

Outstanding:
- Super Admin archive/delete actions
- Ad-hoc checklist creation dialog
- Meeting-transcript row hiding (conditional on `jobDetails.meetingOccurred`)
- Visual verification and Dataverse column name confirmation
