# Session Stability, Attachments, and Interaction Polish Plan

**Goal:** Make Pi Desktop reliable during multi-session runs, turn file handling into a stable workspace-based workflow, improve attachment presentation, restore mouse paste, and add smoother interaction feedback.

**Priority order:** stability first, then file workflow, then presentation, then animation polish.

---

## Phase 1: Session Isolation and Input Unlock

**Status:** Implemented and checked with `npm test -- tests/renderer/App.test.tsx`.

**Problems to solve**

- When session A is running, opening session B sometimes still shows A's messages.
- The UI can jump back to the running session after the user opens another session.
- Runtime events from one session can overwrite the currently viewed session.
- After sending a message, the input can remain disabled even when the viewed session should be editable.

**Design rules**

- Separate the viewed session from the active runtime session.
- The message pane must follow the user's selected/viewed session.
- Background runtime events may update their own session cache/status but must not force session navigation.
- The input should only be disabled when the currently viewed session is running, not when any background session is running.
- Done/error/abort events must release the running state for the matching session.

**Implementation targets**

- Audit and update `src/renderer/src/App.tsx`.
- Audit and update `src/renderer/src/hooks/useChatIPC.ts`.
- Add per-session running/status guards where needed.
- Ensure session switching loads selected session messages and does not get overwritten by unrelated runtime events.

**Tests**

- [x] A running session does not overwrite B after switching to B.
- [x] A completion event does not navigate back to A.
- [x] Switching to idle B enables input even while A is running.
- [x] Failed/completed current session restores input.
- [x] Runtime status is shown only when relevant to the viewed session.

---

## Phase 2: Workspace Attachment Workflow

**Status:** Renderer workflow implemented and checked with `npm test -- tests/renderer/InputBar.test.tsx tests/renderer/PreviewPanel.test.tsx`; main-process copy IPC added and will be covered by typecheck/build.

**Rules**

- `Files` button:
  - Keep existing behavior.
  - Use selected original paths.
  - Do not copy selected files into workspace.

- External files dropped into chat input:
  - Copy files into `<workspace>/.pi-desktop/attachments/`.
  - Use copied workspace paths as attachments.
  - Refresh the Workspace panel after import.
  - If no workspace exists, show a user-facing notice.

- Files dragged from the right Workspace panel into chat:
  - Use the existing workspace path directly.
  - Do not copy.

- External files dropped into the right Workspace panel:
  - Copy regular files into the workspace root in the first version.
  - Reject directories in the first version with a clear notice.
  - Refresh Workspace after import.

- Name conflicts:
  - Keep original filename when possible.
  - Generate `name (1).ext`, `name (2).ext`, etc. on conflicts.

**Implementation targets**

- Main process:
  - Add `files:importAttachments`.
  - Add `files:importToWorkspace`.
  - Implement safe copy and conflict naming.
  - Reject directories for workspace import.

- Preload/types:
  - Expose new IPC methods in `src/preload/index.ts`, `src/preload/api.ts`, and `src/renderer/src/env.d.ts`.

- Renderer:
  - Update `InputBar` to call import IPC for external drops.
  - Keep `Files` picker as original-path attachment.
  - Update `PreviewPanel` Workspace area to accept external drops.
  - Add workspace refresh callback from `App`.

**Tests**

- [x] Files button returns original paths.
- [x] External drop into chat imports to workspace attachments.
- [x] Workspace drag into chat does not import again.
- [x] External drop into Workspace imports to workspace root.
- [x] Directory drop into Workspace shows unsupported notice.
- [x] Conflict names are numbered.

---

## Phase 3: Attachment UI Separation

**Status:** Implemented display metadata and lightweight user attachment/request cards; checked with `npm test -- tests/renderer/InputBar.test.tsx` and `npm test -- tests/renderer/App.test.tsx`.

**Problems to solve**

- Long paths inside the user bubble overflow in narrow windows.
- The user's real request is visually mixed with attachment plumbing text.

**Design**

- Preserve full attachment paths in the prompt sent to Pi.
- Store/display the user-facing message separately:
  - An attachment card showing count and filenames.
  - A separate user request card showing only the user's text.
- Long names truncate with tooltip/full path on hover.
- Attachment card should be visually lighter and narrower than the main user request.

**Implementation targets**

- Extend message representation if needed to carry display attachments separately from sent prompt.
- Update message creation in `App.tsx` or send flow.
- Update `MessageRow` rendering for user messages with attachments.

**Tests**

- [x] Attachment messages show an attachment card.
- [x] User request is displayed separately.
- [x] Long paths do not overflow.
- [x] The sent prompt still contains full paths.

---

## Phase 4: Mouse Paste Context Menu

**Status:** Implemented Electron editable-field context menu; will be verified by typecheck/build and manual app run.

**Problem**

- Users cannot reliably paste text using the mouse/right-click menu.

**Design**

- Add an Electron context menu for editable fields:
  - Cut
  - Copy
  - Paste
  - Select All
- Keep normal keyboard shortcuts working.
- Do not show edit menu for non-editable app chrome unless needed.

**Implementation targets**

- Main process `web-contents-created` / `context-menu` handler.
- Ensure input fields and textareas are covered.

**Tests**

- [x] Context menu handler is registered.
- [x] Editable context exposes paste/cut/copy/select all menu roles.
- [x] Non-editable context is not disrupted.

---

## Phase 5: Interaction Smoothness

**Status:** Implemented lightweight CSS transitions/keyframes and reduced-motion fallback; checked by full test/build verification.

**Reference**

- `agegr/pi-web` relies on lightweight CSS transitions, keyframes, and View Transition API ideas rather than heavy animation libraries.

**Targets**

- Sidebar open/close:
  - Width transition.
  - Chat area remains visually centered.

- Session switching:
  - Light fade/slide for message area.
  - No content flash or forced jump.

- Messages:
  - New messages fade/slide in.
  - Thinking/tool blocks rotate chevrons and transition softly.

- Attachments:
  - Drop-zone highlight.
  - Attachment chips appear smoothly.

- Modals:
  - Skills/Settings/Files use subtle fade + scale.

- Accessibility:
  - Respect `prefers-reduced-motion`.

**Tests/checks**

- [x] No layout shift or text overflow in narrow windows.
- [x] Reduced motion disables non-essential motion.
- [x] Existing renderer tests still pass.
- [ ] Manual visual pass after implementation.

---

## Final Verification

**Status:** Completed automated verification.

Run after all phases:

```bash
npm run typecheck
npm test
npm run build
```

Results:

- [x] `npm run typecheck`
- [x] `npm test` - 31 files, 235 tests passed.
- [x] `npm run build`

Then restart the app and manually check:

- Running session A while viewing B.
- Input enabled/disabled behavior.
- Files button original-path attachments.
- External drag into chat attachments directory.
- External drag into Workspace root.
- Workspace file drag into chat.
- Long attachment names in narrow windows.
- Right-click paste in input.
- Sidebar/session/message animation feel.
