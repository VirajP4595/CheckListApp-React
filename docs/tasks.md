# PAP CheckList React - Phase 1 Tasks

## Phase 1.1: Project Foundation
- [ ] Initialize React 17 + TypeScript 5.8 project
- [ ] Configure Fluent UI 9 with FluentProvider
- [ ] Set up Vitest + React Testing Library
- [ ] Create responsive makeStyles utilities

## Phase 1.2: Data Models
- [ ] Define AnswerState type (YES/NO/BLANK/PS/PC/SUB/OTS)
- [ ] Define Checklist interface (id, jobReference, title, status, workgroups, revisions)
- [ ] Define Workgroup interface (id, number, name, rows, summaryNotes)
- [ ] Define ChecklistRow interface (id, description, answer, notes, images)
- [ ] Define ChecklistImage interface (id, rowId, caption, source)
- [ ] Define Revision interface (id, number, summary, snapshot)
- [ ] Define UserContext interface

## Phase 1.3: Service Interfaces & Mocks
- [ ] Create IChecklistService interface
- [ ] Create IRevisionService interface
- [ ] Create IImageService interface
- [ ] Implement MockChecklistService (in-memory, async)
- [ ] Implement MockRevisionService
- [ ] Implement MockImageService
- [ ] Create realistic mock data (4+ workgroups, mixed states, long notes)

## Phase 1.4: State Management
- [ ] Set up Zustand store with checklist CRUD
- [ ] Add active checklist selection
- [ ] Add inline edit tracking
- [ ] Add auto-save simulation

## Phase 1.5: Dashboard
- [ ] Build responsive checklist grid
- [ ] Create checklist card with status badge
- [ ] Implement create/open actions

## Phase 1.6: Checklist Editor
- [ ] Build document-style vertical layout
- [ ] Create WorkgroupSection with numeric header
- [ ] Build ChecklistRow with:
  - [ ] AnswerSelector (7-state inline toggle)
  - [ ] Auto-growing notes textarea
  - [ ] Inline image area
  - [ ] Mark for review flag
- [ ] Implement keyboard navigation
- [ ] Add auto-save indicator

## Phase 1.7: Revisions
- [ ] Build revision list (REV 1, REV 2...)
- [ ] Create revision summary input
- [ ] Implement read-only snapshot viewer

## Phase 1.8: PDF Export
- [ ] Build document-style preview
- [ ] Integrate jsPDF + html2canvas
- [ ] Export with workgroup structure
