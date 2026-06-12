# Pi Desktop Release Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Pi Desktop reliable for GitHub Release users who download the packaged desktop app instead of running from source.

**Architecture:** Stabilize packaged asset loading, route external navigation through the main process, add release artifact verification, and expose diagnostics for support. Keep changes narrowly scoped and testable before later large refactors.

**Tech Stack:** Electron, electron-vite, electron-builder, React, TypeScript, Vitest, Node.js scripts.

---

## File Map

- Modify `package.json`: add explicit release file patterns and verification scripts.
- Create `scripts/verify-release.js`: validate packaged release artifacts and `app.asar` contents.
- Modify `src/shared/constants.ts`: add new IPC channel constants where appropriate.
- Modify `src/preload/api.ts`, `src/preload/index.ts`, `src/renderer/src/env.d.ts`: expose shell and diagnostics APIs to renderer.
- Modify `src/main/index.ts`: add safe external URL opening, navigation interception, release diagnostics, and safer file/path helpers.
- Modify `src/renderer/src/lib/pdf-preview.ts`: use stable packaged PDF asset base URL.
- Modify `src/renderer/src/components/PreviewPanel.tsx`: route Markdown/HTML preview links consistently and surface preview diagnostics where useful.
- Modify `src/renderer/src/components/EnvironmentStatusList.tsx`: stop using raw `window.open`; use shell IPC.
- Add/modify tests under `tests/main` and `tests/renderer` for release verification, external URL handling, and diagnostics.
- Later refactor targets after release hardening: split `App.tsx`, `PreviewPanel.tsx`, and `useChatIPC.ts` into smaller units.

---

## Task 1: Release Artifact Verification Script

**Files:**
- Create: `scripts/verify-release.js`
- Modify: `package.json`
- Test: `tests/main/release-verification.test.ts`

- [x] Write tests for a verifier that fails when required packaged assets are missing.
- [x] Implement a verifier that checks `release/win-unpacked/resources/app.asar`, required `out/renderer` entries, PDF.js entries, `pptx-viewer.html`, and `latest.yml`.
- [x] Add `verify:release` script to `package.json`.
- [x] Run `npm test -- tests/main/release-verification.test.ts`.
- [x] Run `node scripts/verify-release.js` against the current release directory and record any gaps.

## Task 2: Stable PDF.js Asset Resolution

**Files:**
- Modify: `src/shared/constants.ts`
- Modify: `src/preload/api.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/main/index.ts`
- Modify: `src/renderer/src/env.d.ts`
- Modify: `src/renderer/src/lib/pdf-preview.ts`
- Test: `tests/renderer/pdf-preview.test.ts`
- Test: `tests/main/environment.test.ts` or new `tests/main/diagnostics.test.ts`

- [x] Write failing renderer tests showing PDF asset URL can come from `window.piDesktop.diagnostics.getReleaseDiagnostics()` or a dedicated desktop API rather than `window.location.href`.
- [x] Implement main/preload API to return a packaged renderer asset base URL for PDF assets.
- [x] Update `pdf-preview.ts` to prefer the API-provided asset base and fallback to current behavior.
- [x] Verify `npm test -- tests/renderer/pdf-preview.test.ts`.

Verification:
- `npx vitest run tests/renderer/pdf-preview.test.ts --reporter=verbose` passed 5 tests on 2026-06-12.
- `npx vitest run tests/renderer/PreviewPanel.test.tsx --reporter=verbose` passed 27 tests on 2026-06-12.

## Task 3: Unified Safe External Link Opening

**Files:**
- Modify: `src/shared/constants.ts`
- Modify: `src/preload/api.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/main/index.ts`
- Modify: `src/renderer/src/env.d.ts`
- Modify: `src/renderer/src/components/EnvironmentStatusList.tsx`
- Modify: `src/renderer/src/components/PreviewPanel.tsx`
- Test: `tests/main/external-links.test.ts`
- Test: renderer component tests that click environment actions / Markdown links where feasible.

- [x] Write tests for URL protocol allowlist: allow `https:`, `http:`, `mailto:`, reject `file:`, `javascript:`, malformed values.
- [x] Implement a main-process safe URL opener that returns `IpcResponse`.
- [x] Add `shell.openExternal` to preload API.
- [x] Intercept `setWindowOpenHandler` and `will-navigate` using the same helper.
- [x] Replace raw `window.open` calls in renderer with `window.piDesktop.shell.openExternal`.
- [x] For Markdown preview links, use an onClick handler that prevents default and calls shell IPC.
- [x] Verify external link tests.

Verification:
- `npx vitest run tests/main/external-links.test.ts --reporter=verbose` passed 4 tests on 2026-06-12.
- `npx vitest run tests/renderer/MessageRow.test.tsx --reporter=verbose` passed 14 tests on 2026-06-12.

## Task 4: Release Diagnostics Export

**Files:**
- Modify: `src/preload/api.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/main/index.ts`
- Modify: `src/renderer/src/env.d.ts`
- Modify: `src/renderer/src/screens/Settings.tsx`
- Test: `tests/main/diagnostics.test.ts`

- [x] Write tests for diagnostics redaction and asset existence reporting.
- [x] Implement diagnostics payload: app version, Electron version, platform, packaged flag, userData, current workspace/default directory, release asset checks, provider configured status without API keys.
- [x] Add settings button to copy/export diagnostics text.
- [x] Verify diagnostics tests and manual UI build.

Verification:
- `npx vitest run tests/main/diagnostics.test.ts --reporter=verbose` passed 1 test on 2026-06-12.
- `npx vitest run tests/renderer/TopBarSettings.test.tsx --reporter=verbose` passed 5 tests on 2026-06-12.

## Task 5: Safer File IPC Boundaries

**Files:**
- Modify: `src/main/index.ts`
- Modify: `src/main/path-utils.ts`
- Test: `tests/main/file-ipc-security.test.ts`

- [x] Write tests for allowed path checks against current workspace/default/session directories.
- [x] Implement path normalization and containment checks.
- [x] Apply checks to `files:list`, `files:read`, `files:save`, `files:open`, `files:watch`.
- [x] Keep explicit user-picked directories allowed after selection.
- [x] Verify file IPC tests and existing preview tests.

Verification:
- `npx vitest run tests/main/file-ipc-security.test.ts --reporter=verbose` passed 4 tests on 2026-06-12.
- `npx vitest run tests/renderer/Files.test.tsx --reporter=verbose` passed 1 test on 2026-06-12.
- `npx vitest run tests/renderer/PreviewPanel.test.tsx --reporter=verbose` passed 27 tests on 2026-06-12.

## Task 6: User-Facing Product Polish

**Files:**
- Modify: `src/renderer/src/screens/Welcome.tsx`
- Modify: `src/renderer/src/components/EnvironmentStatusList.tsx`
- Modify: `src/renderer/src/screens/Tools.tsx`
- Modify: `src/renderer/src/screens/Skills.tsx`
- Modify: `src/renderer/src/App.tsx`
- Test: relevant renderer tests.

- [x] Hide or clearly disable not-implemented flows: clone session, trust project, session delete, skill install.
- [x] Improve error messages for provider auth, network failure, missing model, file permission, preview failure.
- [x] Add first-run copy oriented around "work folder", "model service", and "start chatting".
- [x] Verify renderer tests and manual smoke through welcome/settings.

Verification:
- `npx vitest run tests/renderer/Skills.test.tsx --reporter=verbose` passed 6 tests on 2026-06-12.
- `npx vitest run tests/renderer/InputBar.test.tsx --reporter=verbose` passed 9 tests on 2026-06-12.

## Task 7: Large File and Large Workspace Guards

**Files:**
- Modify: `src/main/file-preview.ts`
- Modify: `src/main/pi-bridge.ts`
- Modify: `src/main/index.ts`
- Test: `tests/main/file-preview.test.ts`
- Test: `tests/main/pi-bridge-artifacts.test.ts`

- [x] Add preview render guard messaging for oversized Office/PDF files.
- [x] Add artifact scan skip list and clearer limits for large workspaces.
- [x] Make workspace listing defensively bounded for very large folders.
- [x] Verify main tests.

Verification:
- `npx vitest run tests/main/file-preview.test.ts --reporter=verbose` passed 6 tests on 2026-06-12.
- `npx vitest run tests/main/pi-bridge-artifacts.test.ts --reporter=verbose` passed 3 tests on 2026-06-12.
- `npx vitest run tests/main/file-ipc-security.test.ts --reporter=verbose` passed 4 tests on 2026-06-12.

## Task 8: Final Verification and Report

**Files:**
- Read: this plan file
- Commands:
  - `npm run typecheck`
  - `npm test`
  - `npm run build`
  - `npm run verify:release`
  - `npm run dist:win` when release-level changes need fresh artifact verification

- [x] Re-read this plan and check every task status.
- [x] Run full verification commands.
- [x] Inspect `git diff --stat` and key diffs.
- [x] Summarize completed work, remaining gaps, and exact verification evidence.

Verification:
- `npm run typecheck` passed on 2026-06-12.
- `npm test` passed 30 files / 206 tests on 2026-06-12.
- `npm run dist:win` passed on 2026-06-12 and generated `Pi-Desktop-Setup-0.2.0.exe` plus `Pi-Desktop-Portable-0.2.0.exe`.
- `npm run verify:release` passed on 2026-06-12 with no warnings after fresh packaging.
- `latest.yml` now points to `Pi-Desktop-Setup-0.2.0.exe`, matching the actual setup installer artifact.

---

## Execution Notes

- Work in small test-first increments.
- Do not claim completion until a fresh verification command supports it.
- If context is compacted, re-open this file before continuing.
- If a task proves too large, split it into a new plan section before implementation.
