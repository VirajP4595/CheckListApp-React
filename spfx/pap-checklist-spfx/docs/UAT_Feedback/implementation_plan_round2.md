# UAT Round 2 — Implementation Plan

**Last Updated**: 2026-04-10
**Status**: In Progress

---

## Overview

Nine change requests from UAT testing. Ordered by implementation priority (dependencies + effort).

| # | Feature | Effort | Dataverse Change? | Priority | Status |
|---|---------|--------|:-:|:-:|:-:|
| 7 | Spelling auto-correction on notes | Trivial | No | 1 | ✅ Done |
| 2 | Bolder workgroup collapse chevron | Trivial | No | 2 | ✅ Done |
| 6 | Dropdown label updates | Trivial | Yes (OptionSet) | 3 | ✅ Done |
| 4 | Remove inter-row "Add item" + restyle add button | Small | No | 4 | ✅ Done |
| 8 | Move filters above common notes | Small | No | 5 | ✅ Done |
| 1 | Multiple common notes sections | Large | No | 6 | ✅ Done |
| 5 | Voice input for notes | Medium | No | 7 | ✅ Done |
| 9 | Share activity log via Email | Medium | No | 8 | ✅ Done |
| 3 | Chat per workgroup (feasibility TBD) | Large | Yes | 9 | ✅ Done |

---

## Implementation Order & Dependencies

```
Item 7 (Spellcheck) ──────────────────────────────> Independent
Item 2 (Chevron) ─────────────────────────────────> Independent
Item 6 (Dropdown labels) ────────────────────────-> Needs Dataverse OptionSet first
Item 4 (Remove inter-row add) ───────────────────-> Independent
Item 8 (Move filters) ──────────────────────────--> Do BEFORE Item 1
Item 1 (Multiple common notes) ──────────────────-> Depends on Item 8 (layout)
Item 5 (Voice input) ───────────────────────────--> Depends on Item 1 (adds voice to common notes)
Item 9 (Share activity via Email) ───────────────-> Uses existing Mail.Send scope
Item 3 (Chat per workgroup) ─────────────────────-> Blocked on design decisions
```

---

## Dataverse Prerequisites (Pre-Deployment)

| # | Table | Column | Change | Notes |
|---|-------|--------|--------|-------|
| 6 | `pap_checklistrow` | `pap_answer` OptionSet | Add value `12` | "As Per Specs/Plans" |
| 3 | `pap_workgroup` | `pap_chatdata` | New Memo column | Only if Item 3 is approved |

No new Graph API permissions needed — Item 9 uses existing `Mail.Send` scope.

---

## Proposed Changes

### 1. Multiple Common Notes Sections — **Large**

**Goal**: Allow users to add, remove, and manage multiple named common notes sections instead of a single one.

#### Approach: JSON Array in existing `pap_commonnotes` column

Store a JSON array of note sections in the existing `pap_commonnotes` memo field. This avoids a Dataverse schema change. Existing plain-text/HTML content will be migrated to a single-item array on first load.

**Data structure:**
```ts
interface CommonNoteSection {
    id: string;       // UUID
    title: string;    // User-defined section title
    content: string;  // Rich text HTML (TipTap)
    order: number;
}
```

**Storage**: `pap_commonnotes` = `JSON.stringify(CommonNoteSection[])`.
On load: if the value is not valid JSON array, wrap it as `[{ id: generateId(), title: 'Common Notes', content: raw_value, order: 0 }]`.

#### [MODIFY] `src/models/index.ts`
- Add `CommonNoteSection` interface
- Change `Checklist.commonNotes` type from `string` to `CommonNoteSection[]`
- Update `createEmptyChecklist()` (line 192): change `commonNotes: ''` to `commonNotes: []` for type safety

#### [MODIFY] `src/services/dataverseChecklistService.ts`
- In `mapChecklist()` (line 226) and `getChecklist()` (line 366): parse `pap_commonnotes` as JSON array with migration fallback for legacy plain-text values
- In `saveChecklist()` (line 520): `JSON.stringify()` the array back to the memo field

#### [MODIFY] `src/components/Editor/Sidebar/CommonNotes.tsx`
- Rewrite to render a list of collapsible `CommonNoteSection` cards
- Each section: collapsible header with editable title + RichTextEditor body
- "Add Section" button at the bottom
- Delete section button with confirmation (prevent deleting last section)
- Reorder via **up/down arrow buttons** (no drag library needed — keeps bundle small)

#### [MODIFY] `src/components/Editor/Sidebar/CommonNotes.module.scss`
- Styles for multiple section cards, add/delete/reorder buttons

#### [MODIFY] `src/stores/checklistStore.ts`
- Update any `updateChecklist` calls where `commonNotes` is set to use the new array type

#### [ADD] `src/services/PdfGeneratorService.ts` — New "Common Notes" section
- **Note**: Common notes are NOT currently rendered in the PDF at all. This is a new addition.
- Add a "Common Notes" section to the PDF **before the workgroups** (after the header/metadata)
- Iterate over `CommonNoteSection[]` and render each with its title as a sub-heading and content as rich text body
- No changes to `BtcExportService.ts` — BTC export does not include common notes

---

### 2. Bolder Workgroup Collapse Chevron — **Trivial**

**Goal**: Make the expand/collapse chevron icon on workgroup headers more visually prominent.

#### [MODIFY] `src/components/Editor/WorkgroupSection.tsx`
- Replace `ChevronDown20Regular` / `ChevronRight20Regular` (line 172-177) with `ChevronDown24Filled` / `ChevronRight24Filled` (24px filled variants for more weight)

#### [MODIFY] `src/components/Editor/WorkgroupSection.module.scss`
- Update `.workgroup-expand-btn`:
  - Increase icon container size from 24px to 32px
  - Darken default color from `$color-gray-400` to `$color-gray-700`

---

### 3. Chat Per Workgroup — **Large**

**Goal**: Add per-workgroup chat **alongside** the existing global checklist-level chat (global chat stays as-is).

#### Decided Approach: New `pap_chatdata` Memo column on `pap_workgroup`

Add a new `pap_chatdata` column (Multiple Lines of Text / Memo) on the `pap_workgroup` table, storing a JSON array identical in shape to the existing checklist-level chat (`ChecklistComment[]`).

#### Decided UI: Popup dialog per workgroup

Each workgroup header gets a chat icon button. Clicking it opens a **popup dialog** (Fluent UI `Dialog`) showing the chat for that specific workgroup — similar in layout to the existing `ChecklistChat.tsx` but scoped to the workgroup.

#### Dataverse Prerequisites

| Table | Column | Type | Notes |
|-------|--------|------|-------|
| `pap_workgroup` | `pap_chatdata` | Multiple Lines of Text (Memo) | JSON array of `ChecklistComment[]` |

#### Files Affected

- [MODIFY] `src/models/index.ts` — Add `comments?: ChecklistComment[]` to `Workgroup` interface
- [MODIFY] `src/services/dataverseChecklistService.ts` — Map `pap_chatdata` on workgroup read/write (parse JSON on load, stringify on save)
- [NEW] `src/components/Editor/WorkgroupChatDialog.tsx` — Popup chat dialog scoped to a workgroup (reuses `ChecklistComment` structure and similar UI to `ChecklistChat.tsx`)
- [NEW] `src/components/Editor/WorkgroupChatDialog.module.scss` — Dialog styling
- [MODIFY] `src/components/Editor/WorkgroupSection.tsx` — Add chat icon button (`Chat24Regular`) in workgroup header; opens `WorkgroupChatDialog`
- [MODIFY] `src/stores/checklistStore.ts` — `addWorkgroupComment(workgroupId, comment)` action + save logic

---

### 4. Remove Inter-Row "Add Item" Dividers + Restyle Section Add Button — **Small**

**Goal**: Remove the `insert-row-divider` buttons that appear between every row. Keep only the section-level "Add Row" button at the top of each Client/Estimator section, and restyle it to match the visual style of the removed inter-row buttons (compact, dashed border, + icon).

#### [MODIFY] `src/components/Editor/WorkgroupSection.tsx`
- Remove the `<div className={styles['insert-row-divider']}>` blocks after each `<ChecklistRowItem>` in both Client (lines 337-349) and Estimator (lines 379-391) sections
- Keep `section-add-btn` in the section header (lines 318-324, 360-366)
- Update `section-add-btn` to use the dashed-border aesthetic of the old insert-row buttons

#### [MODIFY] `src/components/Editor/WorkgroupSection.module.scss`
- Remove or deprecate `.insert-row-divider`, `.insert-row-btn`, `.insert-row-icon`, `.insert-row-label` styles
- Update `.section-add-btn` to match the old insert-row visual:
  - Dashed border, rounded pill shape
  - `+` icon with blue circle
  - "Add Row" label
  - Subtle appearance that becomes more prominent on hover
  - Uses `transition: all $transition-base;` per design system rules

---

### 5. Voice Input for Notes Section — **Medium**

**Goal**: Add a microphone button to the notes area in `ChecklistRowItem` and `CommonNotes` that uses browser speech-to-text to dictate notes.

#### Approach: Web Speech API (`SpeechRecognition`)

The Web Speech API is built into Chrome/Edge and requires no external dependencies. It provides real-time speech-to-text transcription.

#### [NEW] `src/components/Editor/VoiceInputButton.tsx`
- Reusable component: microphone icon button (Fluent UI `Mic24Regular` / `Mic24Filled`)
- States: idle, listening (pulsing red indicator), processing
- On start: `new SpeechRecognition()` / `new webkitSpeechRecognition()`
- `onresult`: append transcript to a callback `onTranscript(text: string)`
- `onerror`: show toast/tooltip with error
- `lang`: default to `'en-AU'` (Australian English — matches the construction domain)
- Props: `onTranscript: (text: string) => void`, `disabled?: boolean`
- Feature detection: hide button entirely if `SpeechRecognition` is not available

#### [NEW] `src/components/Editor/VoiceInputButton.module.scss`
- Mic button styles, pulsing animation for recording state

#### [MODIFY] `src/components/Editor/ChecklistRowItem.tsx`
- Add `<VoiceInputButton>` next to the notes `<RichTextEditor>`
- `onTranscript`: append dictated text to `row.notes`, then trigger save

#### [MODIFY] `src/components/Editor/Sidebar/CommonNotes.tsx`
- Add `<VoiceInputButton>` in each common notes section
- `onTranscript`: append dictated text to section content

#### Browser Compatibility
- Chrome 33+, Edge 79+ (primary targets) — full support
- Firefox: No support — button hidden via feature detection
- Safari: Partial support — button hidden if unsupported

---

### 6. Dropdown Label Updates — **Trivial**

**Goal**: Update three answer state labels in the dropdown and add a new answer state.

| Change | Before | After |
|--------|--------|-------|
| Add new | — | `As Per Specs/Plans` |
| Rename | `Subquote / Subcontractor Quote` | `Subcontractor Quote` |
| Rename | `Builder Spec / Standard` | `Builder Spec Item` |

#### [MODIFY] `src/models/index.ts`

**Add new AnswerState:**
- Add `'SPECS_PLANS'` to `AnswerState` type (line 2) and `ANSWER_STATES` array (line 4)
- Add config entry: `SPECS_PLANS: { label: 'As Per Specs/Plans', color: '#00695c', description: 'As per specifications/plans' }`
  - Color `#00695c` (teal-green) chosen to be visually distinct from `YES` (#107c10), `BUILDER_SPEC` (#498205), and `OTS` (#038387)

**Rename existing:**
- `SUB.label` (line 12): `'Subquote / Subcontractor Quote'` → `'Subcontractor Quote'`
- `BUILDER_SPEC.label` (line 16): `'Builder Spec / Standard'` → `'Builder Spec Item'`

#### [MODIFY] `src/services/dataverseChecklistService.ts`
- Add mapping in `ANSWER_MAP` (line 122-134): `12: 'SPECS_PLANS'`
- Add mapping in `ANSWER_VALUE_MAP` (line 136-148): `'SPECS_PLANS': 12`

#### Dataverse Prerequisite

| Table | Column | Change | Notes |
|-------|--------|--------|-------|
| `pap_checklistrow` | `pap_answer` OptionSet | Add new value | `12` = "As Per Specs/Plans" |

> [!IMPORTANT]
> The new "As Per Specs/Plans" answer state requires OptionSet value `12` to be provisioned in Dataverse before deployment. Label-only renames (SUB, BUILDER_SPEC) are frontend-only and require no Dataverse changes.

#### Auto-propagation (no changes needed):
- `AnswerSelector.tsx` — reads from `ANSWER_CONFIG`
- `FilterBar.tsx` — reads from `ANSWER_STATES`/`ANSWER_CONFIG`
- `PdfGeneratorService.ts` — reads from `ANSWER_CONFIG`
- `BtcExportService.ts` — does not use answer labels
- `RfqExportService.ts` — does not use answer labels

---

### 7. Spelling Auto-Correction on Notes — **Trivial**

**Goal**: Enable browser spellcheck on all text input areas (notes, descriptions, common notes).

#### [MODIFY] `src/components/Editor/RichTextEditor.tsx`
- Add `spellcheck: true` to the TipTap `useEditor` `editorProps.attributes` configuration:
  ```ts
  editorProps: {
      attributes: {
          spellcheck: 'true',
          autocorrect: 'on',
          autocapitalize: 'on',
      }
  }
  ```
- This enables the browser's native spell checker (red squiggly underlines) and auto-correction on all TipTap instances (notes, descriptions, common notes).

No other file changes needed — all text editing goes through `RichTextEditor`.

---

### 8. Move Filters Above Common Notes — **Small**

**Goal**: Reposition the FilterBar to appear **above** the CommonNotes section in the editor layout. The top ribbon (`editor-header`) already has `position: sticky` — verify it works correctly. Filters are NOT sticky, only repositioned.

#### [MODIFY] `src/components/Editor/ChecklistEditor.tsx`
- Swap the component order in `editor-main` (lines 300-318):
  ```
  Before: JobMetadataHeader → CommonNotes → FilterBar → Workgroups
  After:  JobMetadataHeader → FilterBar → CommonNotes → Workgroups
  ```

#### [MODIFY] `src/components/Editor/ChecklistEditor.module.scss`
- Verify sticky ribbon works: ensure no ancestor has `overflow: hidden` breaking `position: sticky`
- The `.editor` container currently has `overflow-x: hidden` which could interfere — may need `overflow-x: clip` instead (CSS `clip` respects sticky positioning)
- No sticky behavior for FilterBar — just ensure proper spacing/margins after reorder

---

### 9. Share Activity Log via Email — **Medium**

**Goal**: Add a "Share" button in the Activity Log panel that sends the activity summary via **email** to a user-specified recipient.

#### Approach: Email via existing Graph API (`graphEmailService.ts`)

Reuse the existing `GraphEmailService.sendEmail()` — no new Graph API scopes needed (`Mail.Send` is already approved).

#### [MODIFY] `src/components/Editor/Sidebar/ActivityLogPanel.tsx`
- Add a "Share" button (icon: `Share24Regular`) in the panel header area
- On click: open `ShareActivityDialog`

#### [NEW] `src/components/Editor/Sidebar/ShareActivityDialog.tsx`
- Dialog component with:
  - Email input field for the recipient
  - "Send" button
- On send: build HTML email body from activity log entries (reuse `DayGroup` rendering logic to build HTML table rows)
- Call `getEmailService().sendEmail()` with formatted payload
- Subject line: `"Activity Log — {checklist.title}"`
- Success/error toast feedback

#### [NEW] `src/components/Editor/Sidebar/ShareActivityDialog.module.scss`
- Dialog styling following premium design system

#### No Dataverse or API changes needed — uses existing `Mail.Send` Graph scope.

---

## Resolved Decisions

| # | Question | Decision |
|---|----------|----------|
| Q1 | Item 1 — Storage approach for multiple common notes | JSON array in existing `pap_commonnotes` column (no Dataverse schema change) |
| Q2 | Item 3 — Chat scope and UI | Keep global chat. Per-workgroup chat via popup dialog. New `pap_chatdata` Memo column on `pap_workgroup` |
| Q3 | Item 6 — OptionSet value for new answer state | Confirmed: `12` = "As Per Specs/Plans" |
| Q4 | Item 9 — Delivery mechanism | Email via existing `GraphEmailService` (no new Graph scopes needed) |

---

## Bug Fixes (Post-Implementation)

Bugs discovered and fixed during UAT testing of Round 2 features.

---

### BF-1 — Cursor Reset on Enter in Notes Section Checkboxes

**Reported**: 2026-04-10
**Status**: ✅ Fixed

**Symptom**: When typing in a TipTap rich-text notes field (CommonNotes or row notes) with a task list (checkbox) active, pressing Enter caused the cursor to jump to position 0 (top of the editor) instead of staying on the newly created checkbox item.

**Root Cause**: Tiptap v3 (`@tiptap/react ^3.18`) monitors the `content` option passed to `useEditor`. When the `content` prop changes between renders, Tiptap calls `editor.setOptions()` which resets the cursor to position 0. The feedback loop was:
1. User presses Enter → Tiptap creates new task item
2. `onUpdate` fires → `onChange(html)` → `handleContentChange` in `CommonNotes`
3. `handleContentChange` called `setSections(...)` → React re-render
4. `RichTextEditor` receives updated `content` prop
5. Tiptap detects content prop change → `setOptions()` → cursor reset

**Fix**:
- **`src/components/Editor/Sidebar/CommonNotes.tsx`** (primary): `handleContentChange` now stores interim content in `contentRefs.current` (a ref — no state update, no re-render). `handleContentBlur` flushes the ref into state and saves. The `content` prop to `RichTextEditor` no longer changes while the user is typing, breaking the feedback loop.
- **`src/components/Editor/RichTextEditor.tsx`** (defence-in-depth): Added `isFocused` ref + `useEffect` that only calls `editor.commands.setContent()` when the editor is NOT focused. Prevents any external `content` prop change from resetting cursor mid-edit, regardless of the call source.

---

### BF-2 — Email Field Loses Focus Immediately on Click (ShareActivityDialog)

**Reported**: 2026-04-10
**Status**: ✅ Fixed

**Symptom**: In the Share Activity Log dialog, clicking the email input field caused it to lose focus immediately, making it impossible to type.

**Root Cause**: The `Input` had `autoFocus` set. In Fluent UI v9, the `Dialog` component uses the `tabster` focus trap library. When the dialog opens, tabster claims focus management for the dialog surface. `autoFocus` ran at the same time, creating a race condition where tabster reclaimed focus from the input immediately after `autoFocus` gave it focus. Subsequently, clicking the input again triggered the same tabster reclaim cycle.

**Fix** — `src/components/Editor/Sidebar/ShareActivityDialog.tsx`:
- Removed `autoFocus` from the `Input` to eliminate the tabster conflict
- Added `useRef<HTMLInputElement>` pointing to the inner input via the Fluent UI v9 `input` slot (`input={{ ref: emailInputRef }}`)
- Added `useEffect` with `requestAnimationFrame` to focus the input after the dialog opens. The `rAF` defers the focus call to after Fluent UI's focus management has fully settled, ensuring the input receives and keeps focus

---

## Verification Plan

### Automated Checks
- Build verification: `npm run build` — ensure no TypeScript or SCSS compilation errors
- Lint: `npm run lint` — no new lint warnings

### Manual Verification Per Item
1. **Multiple Common Notes**: Add 3+ sections, edit titles, reorder (up/down arrows), delete, verify PDF export renders all sections before workgroups
2. **Bolder Chevrons**: Visual check — chevrons should be noticeably more prominent with filled 24px icons
3. **Chat per Workgroup**: Send messages in workgroup chat, verify persistence after reload
4. **Add Row UI**: Verify inter-row dividers are gone, section-level "Add Row" works with dashed-border styling
5. **Voice Input**: Click mic, speak, verify text appears in notes (Chrome/Edge only); verify button hidden in Firefox
6. **Dropdown Labels**: Verify "As Per Specs/Plans" appears in dropdown with teal-green color, "Subcontractor Quote" and "Builder Spec Item" labels are correct, filters work with new state
7. **Spellcheck**: Type misspelled word in notes — verify red squiggly underline appears
8. **Filter Position**: Verify FilterBar appears above CommonNotes section; verify sticky ribbon stays pinned on scroll
9. **Share Activity**: Click Share in Activity panel, enter recipient email, verify email arrives with formatted activity content

### Bug Fix Verification
- **BF-1 (Cursor Reset)**: Open notes section, add a checkbox list item, type text and press Enter multiple times — cursor must stay on the new item each time. Blur the editor and re-open — content must be saved correctly.
- **BF-2 (Email Focus)**: Open Share Activity dialog, click the email field — it must accept focus and allow typing without immediately losing focus.
