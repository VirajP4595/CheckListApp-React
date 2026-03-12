# PAP Checklist SPFx Security and Performance Review

## Executive Summary
This document summarizes a full static security and performance review of the SPFx codebase and provides a prioritized resolution plan. No repository code changes were made during the audit.

## Audit Scope and Method
- Scope: `C:\Projects\PAP-CheckList-React\spfx\pap-checklist-spfx` (including currently modified files in workspace).
- Method: static code review of services, stores, components, configuration, and data flow paths.
- Constraint: runtime checks such as `npm audit` and build profiling were not executable in this environment because `node/npm` were not available in PATH.

## Issues (By Severity)

### [Critical] Hard-coded signed Power Automate trigger URL in client source
**Impact**
- A signed trigger URL with `sig` is exposed in client-side code. Anyone with access to bundle/source can invoke the flow.

**Evidence**
- `C:\Projects\PAP-CheckList-React\spfx\pap-checklist-spfx\src\config\environment.ts:21`
- `C:\Projects\PAP-CheckList-React\spfx\pap-checklist-spfx\src\components\Dashboard\AdhocChecklistDialog.tsx:66`
- `C:\Projects\PAP-CheckList-React\spfx\pap-checklist-spfx\src\components\Dashboard\AdhocChecklistDialog.tsx:71`

**Recommended Fix**
- Remove signed trigger URL from client.
- Route invocation via secured backend/API (user-context validated).
- Revoke/rotate leaked flow signature immediately.

---

### [High] XSS risk from unsanitized HTML rendering path
**Impact**
- User/content fields are interpolated into HTML and rendered using `dangerouslySetInnerHTML` without sanitization.

**Evidence**
- `C:\Projects\PAP-CheckList-React\spfx\pap-checklist-spfx\src\components\Editor\NotifyAdminDialog.tsx:43`
- `C:\Projects\PAP-CheckList-React\spfx\pap-checklist-spfx\src\components\Editor\NotifyAdminDialog.tsx:145`

**Recommended Fix**
- Sanitize all HTML before rendering preview.
- Escape untrusted text fields before composing HTML bodies.
- Limit rich-text allowlist to required tags/attributes only.

---

### [High] Unvalidated deep-link/query IDs used in Dataverse request construction
**Impact**
- External URL parameters (e.g., checklist IDs) are used in request composition without strict GUID validation/encoding.

**Evidence**
- `C:\Projects\PAP-CheckList-React\spfx\pap-checklist-spfx\src\App.tsx:28`
- `C:\Projects\PAP-CheckList-React\spfx\pap-checklist-spfx\src\services\dataverseChecklistService.ts:266`
- `C:\Projects\PAP-CheckList-React\spfx\pap-checklist-spfx\src\services\dataverseRevisionService.ts:137`

**Recommended Fix**
- Centralize GUID validation helper and reject invalid IDs early.
- Encode all dynamic OData values and avoid ad-hoc filter string interpolation.

---

### [Medium] Privileged actions rely primarily on UI role gating
**Impact**
- Privileged operations are hidden in UI via role checks, but security should be enforced server-side regardless of UI.

**Evidence**
- `C:\Projects\PAP-CheckList-React\spfx\pap-checklist-spfx\src\components\Editor\ChecklistEditor.tsx:269`
- `C:\Projects\PAP-CheckList-React\spfx\pap-checklist-spfx\src\stores\userStore.ts:25`

**Recommended Fix**
- Enforce authorization in backend/Dataverse/Power Automate security model.
- Treat UI checks as UX-only, not authorization controls.

---

### [Medium] Duplicate save traffic and race potential in checklist metadata updates
**Impact**
- Multiple save triggers can fire for a single logical edit, increasing API load and risk of stale writes.

**Evidence**
- `C:\Projects\PAP-CheckList-React\spfx\pap-checklist-spfx\src\stores\checklistStore.ts:606`
- `C:\Projects\PAP-CheckList-React\spfx\pap-checklist-spfx\src\components\Editor\Sidebar\CommonNotes.tsx:43`
- `C:\Projects\PAP-CheckList-React\spfx\pap-checklist-spfx\src\components\Editor\ChecklistEditor.tsx:326`

**Recommended Fix**
- Define a single persistence model for metadata edits (debounced batch or explicit save).
- Remove overlapping save calls from component and store paths.

---

### [Medium] Image association logic has poor scalability (N x M)
**Impact**
- Repeated filtering of all images per row is expensive for large checklists.

**Evidence**
- `C:\Projects\PAP-CheckList-React\spfx\pap-checklist-spfx\src\services\dataverseChecklistService.ts:321`

**Recommended Fix**
- Pre-index images by `rowId` once, then assign with O(1) lookups.

---

### [Medium] Preview generation path is computationally heavy
**Impact**
- Deep cloning via JSON plus repeated nested `find()` calls increases CPU and GC pressure for larger datasets.

**Evidence**
- `C:\Projects\PAP-CheckList-React\spfx\pap-checklist-spfx\src\components\Editor\ChecklistEditor.tsx:116`
- `C:\Projects\PAP-CheckList-React\spfx\pap-checklist-spfx\src\components\Editor\ChecklistEditor.tsx:130`

**Recommended Fix**
- Replace JSON deep-clone with targeted structural copy.
- Build map indexes for workgroups/rows before merge operations.

---

### [Medium] Unbounded file/image intake in client
**Impact**
- No strict size/type/count limits before base64 conversion and upload; can cause memory spikes and degraded UX.

**Evidence**
- `C:\Projects\PAP-CheckList-React\spfx\pap-checklist-spfx\src\components\Editor\InlineImageArea.tsx:130`
- `C:\Projects\PAP-CheckList-React\spfx\pap-checklist-spfx\src\components\Editor\ChecklistEditor.tsx:185`
- `C:\Projects\PAP-CheckList-React\spfx\pap-checklist-spfx\src\services\sharePointService.ts:186`

**Recommended Fix**
- Enforce max file size, MIME allowlist, image count limits, and compression policy.

---

### [Low] Verbose production logging may leak operational details
**Impact**
- Extensive logs can expose implementation context and increase noise/overhead in production.

**Evidence**
- `C:\Projects\PAP-CheckList-React\spfx\pap-checklist-spfx\src\webparts\papChecklist\PapChecklistWebPart.ts:60`
- `C:\Projects\PAP-CheckList-React\spfx\pap-checklist-spfx\src\services\sharePointGroupService.ts:53`
- `C:\Projects\PAP-CheckList-React\spfx\pap-checklist-spfx\src\components\Editor\Sidebar\ChecklistChat.tsx:29`

**Recommended Fix**
- Gate debug logs by environment flag and remove sensitive/verbose logs from production paths.

## Resolution Plan

### Phase 0: Immediate Containment (Priority 0)
- Remove client-exposed signed flow URL usage.
- Revoke and rotate the currently exposed flow signature.
- Disable direct client flow trigger until secured proxy path is active.

### Phase 1: Security Hardening (Priority 1)
- Add strict ID validation for all deep-link/query IDs before service calls.
- Introduce centralized safe OData query builder/encoder.
- Sanitize and escape untrusted HTML/text in notification preview and outbound HTML email.
- Ensure privileged actions are authorized by backend/security boundary, not UI checks alone.

### Phase 2: Performance Optimization (Priority 1)
- Eliminate duplicate metadata saves and converge on one save strategy.
- Optimize checklist image mapping using pre-built row image index.
- Refactor preview merge path to map-based lookups and selective cloning.
- Introduce upload guardrails for files/images (size/type/count and compression).

### Phase 3: Operational Guardrails (Priority 2)
- Add lint/security rules to block:
  - committed secrets/signed URLs,
  - unsafe HTML rendering paths,
  - unvalidated dynamic ID usage in service requests.
- Introduce telemetry/error handling standards without exposing sensitive details.

## Validation Checklist (Post-Implementation)
- XSS payloads in notes/description/preview do not execute.
- Invalid/non-GUID deep-link values are rejected safely.
- Unauthorized users cannot trigger privileged actions via direct calls.
- Single metadata edit produces one expected save request path.
- Large checklist load and preview remain within acceptable latency targets.
- Oversized/invalid uploads are blocked with clear user feedback.

## Validation Gaps During This Audit
- `npm audit`, build profiling, and runtime benchmark checks could not be run here because `node/npm` were unavailable in the execution environment.
- Dependency and bundle-level validation should be executed in CI or a developer environment with Node installed.

## Assumptions
- Rich-text and checklist content are treated as untrusted input.
- Current backend/data-layer permissions may be permissive unless explicitly hardened.
- This report is documentation-only and does not apply code or configuration changes.
