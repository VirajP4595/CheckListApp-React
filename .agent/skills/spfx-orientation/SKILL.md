---
name: spfx-orientation
version: 1.0
category: spfx / orientation
description: >
  Bootstraps the agent's understanding of any SPFx (SharePoint Framework) repository
  built with Heft as the build toolchain.

use_when:
  - Starting a new session in an SPFx project
  - Orienting to a new SPFx repository or monorepo
  - Verifying the build toolchain and solution structure

do_not_use_when:
  - Projects not using SPFx
  - Quick edits without needing full repository context

---

# Skill: spfx-orientation

## Objective
Establish a deep understanding of the current SPFx repository's structure, toolchain, components, and documentation. This orientation ensures that all subsequent actions are performed with correct context and without assuming project-specific configurations.

---

## Step 1 — Establish the Working Folder
Confirm location before anything else. All paths are relative to this root.
- Run `pwd` and `ls -la`.
- Record the absolute path.
- Check if the repo is a **Rush monorepo** (look for `rush.json` at root).
  - If monorepo, identify SPFx projects within it.
  - If multiple SPFx projects exist, ask the user which to orient on first.

## Step 2 — Map the SPFx Solution Structure
Get a structural snapshot, ignoring build outputs and dependencies (`node_modules`, `lib`, `dist`, etc.).
- Identify component types:
  - `src/webparts/` → Web Parts
  - `src/extensions/` → Extensions
  - `src/adaptiveCardExtensions/` → ACEs
- **Confirm Heft (not Gulp)**:
  - Check `package.json` for `heft` or `@rushstack`.
  - Look for `config/heft.json` or `.heftrc.json`.
  - **⚠️ WARNING**: If `gulpfile.js` is present, the project has NOT been migrated to Heft. Flag this immediately.

## Step 3 — Read SPFx Config Files
Extract critical metadata from:
- `config/package-solution.json`: Solution name, ID, version, domain isolation, API permissions.
- `config/serve.json`: Workbench serve targets.
- `config/heft.json` or `.heftrc.json`: Heft rig/plugin configuration.
- `tsconfig.json`: TypeScript compiler options.

## Step 4 — Documentation Discovery & Systematic Reading
- Find folders like `docs`, `wiki`, `guides`.
- Find all markdown files (`.md`, `.mdx`).
- **Prioritized Reading Order**:
  1. `README.md` (root): Purpose, setup.
  2. `docs/`: Architecture, onboarding.
  3. `CONTRIBUTING.md`: PR process, build/deploy steps.
  4. `CHANGELOG.md`: Version history.
- **Extract and Record**:
  - SharePoint dependencies (lists, columns, content types).
  - Environment-specific config (dev/staging/prod URLs).
  - Webbench URLs and tenant setup.

## Step 5 — Map Components and Entry Points
- Read all component manifests (`*.manifest.json`) in `src/`.
- Record component IDs, aliases, types, and toolbox titles.
- Locate shared utilities and services (`common`, `shared`, `services`, `hooks`, `utils`, `models`).

## Step 6 — Check Build and CI Configuration
- Inspect `package.json` scripts.
- Check for CI/CD pipelines (`.github/workflows/`, `.azuredevops/`, `azure-pipelines.yml`).
- **Heft Command Reference**:
  - Dev serve: `npm run serve`
  - Build (debug): `npm run build`
  - Bundle (production): `npm run bundle -- --ship`
  - Package: `npm run package-solution -- --ship`
  - Test: `npm test`
  - Lint: `npm run lint`

---

## Guardrails
- **Never assume the working folder** — always verify.
- **Never run gulp** — Heft is the build tool. Flag any gulp references.
- **Never hallucinate component GUIDs** — read manifests directly.
- **Never bump solution.version** without explicit instruction.
- **If docs are absent**, propose a `docs/` scaffold.

---

## Step 7 — Produce Orientation Summary
Emit this summary before acting on any task:

### Antigravity Agent — SPFx Orientation Summary

**Working Folder:** `<absolute path>`
**Solution Name:** `<from package-solution.json>`
**Solution ID:** `<GUID>`
**SPFx Version:** `<e.g., 1.18.2>`
**Build Toolchain:** Heft ✓ (or ⚠️ Gulp detected)
**Monorepo (Rush):** YES / NO

**Components Found:**
- Web Parts: `<names and GUIDs>`
- Extensions: `<names, type, GUIDs>`
- ACEs: `<names and GUIDs>`

**Key Config:**
- Domain Isolated: YES / NO
- App Catalog Scope: Tenant-wide / Site-scoped
- API Permissions: `<list>`
- Hosted Workbench URL: `<from serve.json>`

**Documentation Read:** `<n> of <n found>`

**SharePoint Dependencies:**
- `<lists, libraries, content types>`

**Open Questions:**
- `<anything unclear>`

**Ready to proceed:** YES / NO
