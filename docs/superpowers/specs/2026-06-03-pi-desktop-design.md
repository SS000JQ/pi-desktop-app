---
name: pi-desktop-design
description: Pi Desktop - Electron GUI wrapper for Pi Agent Toolkit. Single-mode chat workspace with session management, file preview, and external editor integration.
---

# Pi Desktop Design Specification

## Overview

Pi Desktop is a native desktop GUI (Electron) for the Pi Agent Toolkit (`@earendil-works/pi`). It wraps Pi's AgentSession/AgentLoop/Pi-AI core into a visual workspace, inspired by Claude Desktop's UI paradigm but tailored for Pi's coding-agent use case.

**Target audience**: Users who build PPTs, do office tasks, write code, and research with Pi — needing a polished desktop GUI rather than a TUI.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Electron Main Process                 │
│  ┌─────────────────────────────────────────────────────┐│
│  │              AgentSession Manager                    ││
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   ││
│  │  │ pi-ai    │  │ pi-core  │  │ pi-coding-agent  │   ││
│  │  │ (stream) │  │ (loop)   │  │ (session/tools)  │   ││
│  │  └──────────┘  └──────────┘  └──────────────────┘   ││
│  └─────────────────────┬───────────────────────────────┘│
│                        │ IPC events                     │
│  ┌─────────────────────▼───────────────────────────────┐│
│  │              Session Persistence                     ││
│  │  (JSONL files / SQLite for history + search)         ││
│  └─────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────┐│
│  │  File System Bridge (open in VSCode/WPS/browser)    ││
│  └─────────────────────────────────────────────────────┘│
└──────────────────────────┬──────────────────────────────┘
                           │ IPC (contextBridge)
┌──────────────────────────▼──────────────────────────────┐
│                    Renderer Process                      │
│  ┌──────────┬──────────────────────┬───────────────────┐ │
│  │ Sessions │     Chat View        │  Preview Panel    │ │
│  │  List    │  - MessageList       │  - Markdown       │ │
│  │          │  - ToolCalls         │  - Code highlight │ │
│  │  Filter  │  - Code blocks       │  - File info card │ │
│  │  Search  │  - Token usage       │  - WebView (HTML) │ │
│  │          │  - Stream indicator  │  - Open in WPS/VSC│ │
│  └──────────┴──────────────────────┴───────────────────┘ │
│  ┌──────────────────────────────────────────────────────┐│
│  │                  Input Bar                           ││
│  │  [💬] [input / commands] [📎 🎤 ⌘⏎]                ││
│  └──────────────────────────────────────────────────────┘│
│  ┌──────────────────────────────────────────────────────┐│
│  │                  Top Bar                             ││
│  │  Pi Desktop | ~/path | [model ▼] | tokens: n/n | ⚙️ ││
│  └──────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology |
|-------|-----------|
| Desktop Shell | **Electron** 39+ |
| UI Framework | **React 19** + TypeScript |
| Build Tooling | **electron-vite** (Vite 7) |
| Styling | Tailwind CSS 4 |
| LLM Integration | **`@earendil-works/pi-ai`** (npm dep) |
| Agent Runtime | **`@earendil-works/pi-agent-core`** (npm dep) |
| CLI Integration | **`@earendil-works/pi-coding-agent`** (npm dep) |
| Session Storage | **better-sqlite3** (FTS5 full-text search) |
| Testing | Vitest |
| Packaging | electron-builder |

### NPM Dependency Approach

Pi Desktop installs `@earendil-works/pi-*` packages as npm dependencies (not a fork or subprocess). This means:
- Pi's core packages evolve independently — upgrade Pi Desktop to get newer Pi versions
- Agent loop runs **in-process** in Electron's main process — no HTTP bridge needed
- Access to Pi's event stream (`agent_loop` events → IPC → React state)

### Deps Isolation

Using `@earendil-works/pi-*` packages is a **first-class integration target** — Pi publishes these as stable npm packages. Pin to exact minor versions (`^x.y.z`) to receive patch fixes without unexpected breaking changes.

```json
{
  "dependencies": {
    "@earendil-works/pi-ai": "^0.0.3",
    "@earendil-works/pi-agent-core": "^0.0.3",
    "@earendil-works/pi-coding-agent": "^0.0.3",
    "better-sqlite3": "^12.8.0",
    "electron-updater": "^6.3.9",
    "pptxviewjs": "^1.1.0",
    "mammoth": "^1.8.0",
    "xlsx": "^0.18.0",
    "highlight.js": "^11.11.0"
  }
}
```

Pi Desktop consumes only the **public API surface** of these packages — primarily `AgentSession`, `AgentLoop` config types, `pi-ai` stream types, and the tool/extension registries.

**Browser-based preview libraries:**

| Library | Purpose | License |
|---------|---------|---------|
| `pptxviewjs` | Parse PPTX → render slides as Canvas (in-app slide viewer) | MIT |
| `mammoth` | Parse DOCX → HTML (in-app rendered document) | MIT |
| `xlsx` (SheetJS) | Parse XLSX → HTML table (in-app spreadsheet preview) | Apache 2.0 |
| `highlight.js` | Code syntax highlighting (chat + preview) | MIT |

## UI Layout

### Three-Panel Layout

```
┌───────────────────────────────────────────────────────────┐
│  Pi Desktop    ~/workspace/ppt   [Sonnet ▼]  1.2k/8k  👤⚙️ │
├────────┬──────────────────────────────┬────────────────────┤
│ Files  │       Chat View              │  Preview Panel     │
│ Tools  │                              │                    │
│ Skills │  ┌────────────────────────┐  │  ┌──────────────┐  │
│ Memory │  │ You: 帮我设计PPT结构     │  │  │ 📝 Preview  │  │
│────────│  │                        │  │  │ # AI 发展历程│  │
│Session │  │ Pi: 好的，先搜索数据...  │  │  │ ## 1. 起源  │  │
│  +     │  │ ▸ tool: web_search     │  │  │              │  │
│ PPT结..│  │ Found 15 results       │  │  │ 📂 Save      │  │
│ 数据.. │  │                        │  │  │ 🔗 Open VSC  │  │
│ 配色.. │  │ ## PPT 大纲             │  │  └──────────────┘  │
│ 周报.. │  │ 1. 起源 2. 寒冬...      │  │                    │
│ Bug fix│  └────────────────────────┘  │                    │
│ [All]  │  💬 继续...  [📎 🎤 ⌘⏎] │                    │
│ [Active│  [🗂 大纲.md  📊 数据.xlsx]│  ← context chips     │
├────────┴──────────────────────────────┴────────────────────┤
│  Status: Connected | Model: Sonnet 4.6 | 12 tool calls     │
└───────────────────────────────────────────────────────────┘
```

### Panels Description

#### 1. Top Bar
- **Left**: App name "Pi Desktop" + current working directory path
- **Center**: (empty — single mode, no tabs)
- **Right**: Model selector dropdown + token usage (current / max) + profile avatar (👤) + settings gear icon

#### 2. Left Panel — Navigation & Sessions

A narrow panel (~120px) with two sections separated by a divider:

**Top section — Feature entries (text-only):**
- **Files** — click opens project file tree browser (browse, read, attach files to context)
- **Tools** — click opens Tools management modal
- **Skills** — click opens Skills management modal
- **Memory** — click opens Memory editor modal

**Bottom section — Sessions list:**
- **Header**: "SESSIONS" label + new session button (+)
- **Session list**: Each row shows truncated session title. Active session highlighted. Click to switch.
- **Right-click menu**: Rename, Archive, Delete session

**Footer**: All / Active filter pills

#### 3. Center Panel — Chat View
- **Messages**: User messages vs Pi messages with distinct styling
- **User messages**: Right-aligned or left-indented bubble style
- **Pi responses**: Full-width with model label + response time
- **Tool calls**: Rendered as collapsible cards showing:
  - Tool name + arguments (monospace)
  - Status indicator (pending → running → done / error)
  - Duration
- **Code blocks**: Syntax highlighting (highlight.js or shiki), copy button, "Open in Editor" button
- **Stream indicator**: Animated cursor during Pi generation
- **Token footer**: Live prompt/completion token counts

#### 4. Right Panel — Preview

A content-adaptive preview panel with multi-file tab support:

**Multi-file tabs**: When Pi generates multiple artifacts in a conversation, each file gets a tab in the preview panel header. Click tabs to switch between previewed files. File type icon + filename displayed. Close button to dismiss a tab.

```
┌──────────────────────────────────────┐
│ Preview                          ↗   │
│ ┌──────────┐ ┌──────────┐ ┌──────┐  │
│ │大纲.md   │ │演讲稿.md │ │数据  │  │  ← File tabs
│ └──────────┘ └──────────┘ └──────┘  │
│ ┌──────────────────────────────────┐ │
│ │                                  │ │
│ │      (Rendered content)          │ │
│ │                                  │ │
│ └──────────────────────────────────┘ │
│ [📂 Save] [🔗 Open in WPS] [📋 Copy]│
└──────────────────────────────────────┘
```

- **Tabs**: Preview / Source (toggle between rendered view and raw source)
- **Preview types**:

| Content Type | Preview Panel | External Open Action |
|-------------|---------------|---------------------|
| Markdown | Rendered HTML (headings, lists, code blocks styled) | Open in system default editor |
| Code (.ts/.py/.js/.json etc.) | Syntax-highlighted read-only view (highlight.js or shiki) | `code -r <path>` — open in VS Code |
| PPTX | **In-app slide viewer** — page through slides via `pptxviewjs` (Canvas rendering). Left sidebar shows slide thumbnails for navigation. | `shell.openPath()` → WPS / Office |
| DOCX | **In-app rendered HTML** — full document text via `mammoth.js` (headings, lists, tables, images rendered). | `shell.openPath()` → WPS / Office |
| XLSX | **In-app table preview** — first N rows rendered as HTML table via `SheetJS`. | `shell.openPath()` → WPS / Office |
| Image | Scaled image preview | System image viewer |
| HTML | Embedded WebView render | Default browser |
| Plain text | Monospace view | System default editor |
| Unknown | File info card + hex preview (optional) | System default app |
| Directory | File tree browser | Open in VS Code |

- **Action buttons**: The primary action button dynamically changes label based on the active file's extension:
  - `.pptx` / `.docx` / `.xlsx` → "🔗 Open in WPS" (blue primary)
  - `.ts` / `.py` / `.js` / `.rs` / `.go` / `.tsx` / `.jsx` / `.css` / `.json` / `.yaml` / `.toml` → "🔗 Open in VS Code" (blue primary)
  - `.html` → "🔗 Open in Browser" (blue primary)
  - `.md` / `.txt` → "🔗 Open in VS Code" (or system default if VS Code not detected)
  - `.png` / `.jpg` / `.gif` / `.svg` → "🔗 Open in Viewer" (system default)
  - Generic fallback → "🔗 Open" (system default)
  - Secondary buttons always visible: "📂 Save" | "📋 Copy"
  - The open action calls Electron's `shell.openPath()` or `exec('code -r <path>')` via `file-bridge.ts`.
- **Persistent files**: Artifacts are saved to the current working directory. The preview panel tracks file paths and persists across session switches when files exist on disk.

#### 5. Input Bar
- **Layout**: Icon + text input field + utility icons
- **Placeholder**: "Ask Pi anything... ( / for commands )"
- **Commands**: `/` triggers slash command autocomplete (reuses Pi's slash-commands.ts)
- **Attachments**: 📎 file picker — opens native file dialog, attaches selected files to message context
- **Drag-and-drop files**: Files can be dragged from system file manager directly onto the input bar or the entire chat area. Visual drop zone indicator appears during drag (highlighted border + "Drop files here"). Supported drop targets: input bar (attach to message), Preview panel (open in preview).
- **Screenshot paste**: `Ctrl+V` / `Cmd+V` pastes clipboard images directly as message attachments. Captures screenshots (Snipping Tool, etc.) without needing to save to a file first.
- **File path input**: User can type or paste a file path directly into the input field. The input bar auto-detects file paths (e.g., `C:\path\to\file.pptx`, `~/documents/report.md`). Clicking a file path in chat messages opens it in the Preview panel.
- **Context folder chips**: When files are attached, show compact chips below the input bar showing attached file names with remove button. Visual count indicator when many files attached.
- **Voice**: 🎤 microphone input (optional, future)
- **Send**: ⌘⏎ shortcut displayed
- **Multiline**: Shift+⏎ for newline, ⌘⏎ to send

### Visual Design System

Derived from `ui-ux-pro-max` search for "Developer Tool / IDE" product category.

**Color Palette:**

| Token | Hex | Usage |
|-------|-----|-------|
| Background (deepest) | `#0F172A` | App background, message code blocks, tool call cards |
| Surface | `#1E293B` | Panels, bubbles, inputs, buttons, filter pills |
| Border | `#334155` | Dividers, panel borders, input borders |
| Text Primary | `#F1F5F9` | Body text, headings |
| Text Muted | `#64748B` | Labels, timestamps, placeholders, secondary info |
| Text Dim | `#475569` | Section labels, filter text, icon color |
| Primary (Blue) | `#3B82F6` | Accent buttons, focus rings, hover states, running tool indicator |
| Primary Hover | `#2563EB` | Button hover state |
| Success (Green) | `#22C55E` | Pi message label, completed tool call indicator |
| Warning (Orange) | `#F97316` | Tool call names, warnings |
| Error (Red) | `#EF4444` | Error states |
| Text Soft | `#94A3B8` | Model picker text, interaction text |
| Text Subtle | `#CBD5E1` | Code block content |

**Typography:**

| Role | Font | Weights |
|------|------|---------|
| UI (headings, body, labels) | `IBM Plex Sans` | 300 / 400 / 500 / 600 / 700 |
| Code blocks, tool calls, tokens, key hints | `JetBrains Mono` | 400 / 500 / 600 / 700 |
| Body line-height | 1.5 | — |
| Code line-height | 1.7 | — |
| Body font-size | 13px | Base UI size |
| Small text | 10-12px | Labels, timestamps, status bar |
| Monospace size | 11-12px | Code blocks |

**Z-Index Scale:**

| Layer | Value | Elements |
|-------|-------|----------|
| Base | 0 | Main content area |
| Panel | 10 | Session panel, preview panel |
| Overlay | 20 | Drag-overlay, tooltips |
| Modal | 30 | Settings, Tools, Skills, Memory, Profile modals |
| Toast | 40 | Global notifications |

**Interaction & Animation:**

| Element | Behavior | Duration |
|---------|----------|----------|
| Hover (links, buttons, entries) | `transition-colors` + background/text color change | 150ms |
| Hover (borders) | Border color shift to primary blue | 150ms |
| Focus (input fields) | `ring-2 ring-blue-500` border highlight | 150ms |
| Modal open | Fade in (opacity) + scale(0.95→1) | 200ms |
| Tool call status | Left border color change: blue(running) → green(done) → red(error) | 300ms |
| Streaming text | Token-by-token append (typewriter effect) | Real-time |
| Pulse indicator | Animated dot for running tool calls | 1.5s infinite |

**Tool Call Card States:**

| State | Left Border | Indicator |
|-------|-------------|-----------|
| Pending | `#334155` | — |
| Running | `#3B82F6` | Blue pulsing dot |
| Done | `#22C55E` | Green dot |
| Error | `#EF4444` | Red dot |

**Status Bar Indicators:**

- Green dot = connected
- Yellow dot = connecting
- Red dot = disconnected / error

**Anti-patterns to avoid:**
- Emoji used as UI icons (use SVG: Lucide or Heroicons)
- Flat design without depth — use color and border layering instead
- Text-heavy pages without visual hierarchy
- Missing hover/transition states on interactive elements
- Blank screen during loading (use skeleton or streaming instead)

## Data Flow

```
User types in Input Bar
       │
       ▼
IPC: 'chat:send' → Main Process
       │
       ▼
AgentSession.processUserMessage(text, attachments)
       │
       ▼
AgentLoop starts (pi-agent-core)
       │
       ▼
┌────────────── Loop ──────────────────────────┐
│  emit: turn_start                             │
│  emit: message_start → update (streaming)      │
│  emit: message_end (full assistant message)    │
│  if tool_calls:                               │
│    emit: tool_execution_start (per tool)       │
│    emit: tool_execution_update (per tool)      │
│    emit: tool_execution_end (per tool)         │
│  emit: turn_end                               │
│  check: steering messages → follow-up → loop  │
└──────────────────────────────────────────────┘
       │
       ▼ (every event forwarded via IPC)
Renderer state updates (useReducer / zustand)
       │
       ▼
React components re-render
  - MessageList appends new message
  - ToolCallCard shows progress
  - TokenCounter updates
  - PreviewPanel shows final artifacts
```

### IPC Channel Map

| Channel | Direction | Payload | Purpose |
|---------|-----------|---------|---------|
| `chat:send` | Renderer → Main | `{ text, files, sessionId }` | Send user message |
| `chat:abort` | Renderer → Main | `{ sessionId }` | Abort current generation |
| `agent:event` | Main → Renderer | `AgentEvent` | Stream agent events to UI |
| `sessions:list` | Renderer → Main | — | Get all sessions |
| `sessions:create` | Renderer → Main | `{ title }` | Create new session |
| `sessions:delete` | Renderer → Main | `{ sessionId }` | Delete session |
| `sessions:search` | Renderer → Main | `{ query }` | Full-text search |
| `session:switch` | Renderer → Main | `{ sessionId }` | Load different session |
| `session:export` | Renderer → Main | `{ sessionId, format }` | Export session (HTML) |
| `preview:open` | Renderer → Main | `{ filePath }` | Open file in external app |
| `preview:read` | Renderer → Main | `{ filePath }` | Read file for preview |
| `config:get` | Renderer → Main | `{ key }` | Get config value |
| `config:set` | Renderer → Main | `{ key, value }` | Set config value |
| `providers:list` | Renderer → Main | — | List configured providers |
| `providers:test` | Renderer → Main | `{ provider }` | Test provider connection |
| `tools:list` | Renderer → Main | — | List all available tools from Pi registry |
| `tools:toggle` | Renderer → Main | `{ toolId, enabled }` | Enable/disable a tool |
| `skills:list` | Renderer → Main | — | List installed skills |
| `skills:toggle` | Renderer → Main | `{ skillId, enabled }` | Enable/disable a skill |
| `memory:list` | Renderer → Main | — | List memory entries |
| `memory:update` | Renderer → Main | `{ id, value }` | Update a memory entry |
| `memory:delete` | Renderer → Main | `{ id }` | Delete a memory entry |
| `profiles:list` | Renderer → Main | — | List profiles |
| `profiles:create` | Renderer → Main | `{ name }` | Create new profile |
| `profiles:switch` | Renderer → Main | `{ profileId }` | Switch active profile |
| `profiles:delete` | Renderer → Main | `{ profileId }` | Delete a profile |
| `backup:create` | Renderer → Main | `{ path }` | Create backup archive |
| `backup:restore` | Renderer → Main | `{ path }` | Restore from backup archive |
| `files:list` | Renderer → Main | `{ dirPath }` | List files in directory |
| `files:read` | Renderer → Main | `{ filePath }` | Read file content for preview |
| `files:attach` | Renderer → Main | `{ filePaths }` | Attach files to current message |
| `files:clipboard-image` | Renderer → Main | — | Get clipboard image as file |
| `app:minimize-to-tray` | Renderer → Main | — | Minimize window to system tray |
| `app:show-window` | Renderer → Main | — | Restore window from tray |

### Session Identity

Session IDs are generated by Electron main process using `crypto.randomUUID()`. Each session gets:
- `id`: UUID v4 (primary key)
- `title`: Auto-generated from first message, editable by user
- `createdAt`, `updatedAt`: ISO timestamps
- `model`: Model used for the session
- `tokenCount`: Cumulative token usage
- `filePath`: Path to JSONL file in `~/.pi-desktop/sessions/`

- **Storage format**: JSONL files (one file per session) under `~/.pi-desktop/sessions/`
- **Index**: SQLite database with FTS5 for full-text search across all sessions
- **Session data**: Messages array + metadata (model, tokens, timestamps)
- **Auto-save**: After each `turn_end` event
- **Compaction**: Reuse Pi's compaction logic (`packages/coding-agent/src/core/compaction/`) for long sessions

## Screens (Pages)

The app has these primary surfaces:

| Surface | Type | Trigger | v1 Status |
|---------|------|---------|-----------|
| Chat workspace | Main screen | App startup | ✅ |
| Welcome / First-run wizard | Full screen | First launch | ✅ |
| Settings | Modal | Click ⚙️ in top bar | ✅ |
| Provider manager | Standalone modal | Click model name in top bar or `⌘P` | ✅ |
| All providers | Full-screen wizard | First launch (steps 2-3) | ✅ |
| Keyboard shortcuts panel | Modal | Press `⌘/` anywhere | ✅ |
| Working directory switcher | Dropdown | Click path in top bar | ✅ |
| Model selector | Dropdown | Click model name in top bar | ✅ |
| Session search | Modal | `⌘⇧F` or search icon | ✅ |
| Preview panel | Right panel | Click artifact in chat | ✅ |
| Tools management | Modal | Click "Tools" in left panel | ✅ |
| Skills management | Modal | Click "Skills" in left panel | ✅ |
| Memory editor | Modal | Click "Memory" in left panel | ✅ |
| Profile manager | Modal | Click profile avatar in top bar | ✅ |
| Project Files | Modal / Side panel | Click "Files" in left panel | ✅ |
| System tray | OS-level | Close window → minimize to tray | ✅ |
| Backup & Restore | Modal | Within Settings | ✅ |

### 1. Welcome / First-Run Wizard

On first launch (no existing config), the wizard guides the user through setup:

| Step | Screen | Action |
|------|--------|--------|
| 1 | Welcome | "Welcome to Pi Desktop" — brief intro, "Get Started" button |
| 2 | Provider selection | Choose LLM provider: OpenRouter (recommended), Anthropic, OpenAI, Google, or Custom OpenAI-compatible endpoint |
| 3 | API key input | Input API key for selected provider. "Test Connection" button validates the key. |
| 4 | Model selection | Pick default model from provider's available models. Set thinking level. |
| 5 | Working directory | Choose default project folder (optional, can be changed later) |
| 6 | Complete | "All set!" summary screen → launches Chat workspace |

The wizard is skippable — user can click "Skip setup" at any step to enter the workspace with minimal config.

### 2. Tools Management

Opens as a modal from the left panel. Displays all available tools from Pi's tool registry.

- **List view**: Each tool shows name, description, enabled/disabled toggle
  - Search/filter by category: web, file, terminal, code, vision, image, memory, etc.
- **Group by category**: Collapsible sections with category headers
- **Search**: Filter tools by name or description
- **Default state**: All tools enabled (user explicitly disables)

### 3. Skills Management

Opens as a modal. Displays Pi's installed and available skills.

- **Installed tab**: Shows currently installed skills with name, version, description. Enable/disable toggle per skill.
- **Browse tab**: Not available in v1 (Pi skills are file-based, not from a registry). Future: connect to a skills registry.
- **Detail view**: Click a skill to see full description, commands it provides, configuration options.

### 4. Memory Editor

Opens as a modal. Allows viewing and editing Pi's long-term memory entries.

- **Memory list**: Each entry shows key, value, source, timestamp. Sortable by date.
- **User profile memory**: Dedicated section for user profile data (name, preferences, context) that Pi consistently remembers.
- **Edit**: Inline editing of memory values. Delete individual entries.
- **Capacity indicator**: Shows memory usage / limit (reuses Pi's memory system).

### 5. Profile Manager

Opens as a modal from top bar avatar area. Manages multiple Pi configurations.

- **Profile list**: Show existing profiles. Each has name, model, provider summary.
- **Create**: Name a new profile with isolated config (providers, tools, memory).
- **Switch**: Click to switch active profile (Pi Desktop reloads session list for that profile).
- **Delete**: Remove a profile after confirmation.
- **Storage**: Each profile stored in `~/.pi-desktop/profiles/<name>/` with isolated config and sessions.

### 6. Project Files

Opens as a modal from the left panel ("Files"). Provides a file tree browser for the current working directory.

- **File tree**: Directory tree with folder expand/collapse. Shows file name, size, modified date. Icons for common file types (folder, image, document, code, office).
- **Preview on click**: Click a file → opens in Preview panel (same rendering logic as Preview Panel: Markdown → rendered, code → highlighted, PPTX → slide viewer, DOCX → HTML, XLSX → table).
- **Attach to chat**: Right-click or hover button → "Attach to message" adds file to the current input as context for Pi.
- **Open in external editor**: Right-click → "Open in [VSCode/WPS]" or click the external open button.
- **Reveal in file manager**: Right-click → "Show in folder" opens the system file manager at the file's location.
- **Search**: Filter files by name within current directory.
- **Refresh**: Manual refresh button; auto-refreshes on window focus.

### 7. System Tray

When the user closes the window, Pi Desktop minimizes to the system tray instead of quitting.

- **Tray icon**: Pi Desktop icon in the system tray.
- **Tray menu**: Right-click tray icon → "Show Window" / "New Session" / "Quit".
- **Global shortcut**: `Alt+Shift+Space` (Windows) / `Option+Shift+Space` (macOS) — toggles Pi Desktop window from any application.
- **Single instance**: Locks to single instance — second launch focuses existing window.
- **Notification**: When Pi finishes a background task while window is hidden, show a system notification.

### 13. Provider Manager (Standalone Modal)

A dedicated provider management interface, accessible from the top bar (separate from Settings). Provides full CRUD for Pi-AI providers.

- **Provider list**: Cards or rows showing each configured provider. Each card shows: provider name (OpenAI, Anthropic, OpenRouter, etc.), base URL, configured model list, status indicator (connected/unconfigured/error).
- **Add provider**: Button → pick from Pi-ai's built-in provider registry (OpenAI, Anthropic, OpenRouter, Google, Groq, Mistral, DeepSeek, GitHub Copilot, etc.) or "Custom OpenAI-compatible endpoint".
- **Configure provider**: Inline expand or modal shows:
  - API key input (masked, with show/hide toggle)
  - Base URL (for custom/compatible endpoints)
  - Available models list (fetched from provider)
  - "Test Connection" button
- **API key encryption**: API keys stored encrypted at rest using `safeStorage` API (Electron's OS-level keychain). Never stored in plaintext in config files.
- **Edit / Delete**: Update or remove a provider.
- **Default provider**: Star/mark one provider as default.

### 14. Keyboard Shortcuts Panel

Press `⌘/` (`Ctrl+/` on Windows) anywhere in the app to open a shortcuts reference modal.

| Shortcut | Action |
|----------|--------|
| `⌘⏎` / `Ctrl+⏎` | Send message |
| `Shift+⏎` | New line in input |
| `⌘K` / `Ctrl+K` | Clear current chat |
| `⌘N` / `Ctrl+N` | New session |
| `⌘⇧F` / `Ctrl+Shift+F` | Search sessions |
| `⌘/` / `Ctrl+/` | Show shortcuts |
| `⌘,` / `Ctrl+,` | Open Settings |
| `⌘P` / `Ctrl+P` | Open Provider manager |
| `⌘W` / `Ctrl+W` | Close panel / modal |
| `Esc` | Close modal / cancel |
| `Alt+Shift+Space` | Toggle Pi Desktop window |

The shortcuts modal shows the full table grouped by category (Chat, Navigation, Panels, Global).

### 15. Working Directory Switcher

The working directory shown in the top bar is clickable.

- **Display**: Truncated path showing current working directory (e.g., `~/projects/ppt-demo`).
- **Click action**: Opens a dropdown with:
  - **Recent directories**: Last 5 used working directories with timestamps.
  - **Browse...**: Opens native folder picker dialog.
  - **Current session path**: Full path shown at bottom.
- **On switch**: Pi Desktop reloads session context for the new directory. Existing sessions are not lost — they remain associated with their original directory.
- **Default**: Last used directory on startup, or user's home directory on first launch.
- **Session affinity**: Each session remembers which working directory it was created in.

### 16. AI Integration Verification

Before Pi Desktop v1 ships, verify:

- `@earendil-works/pi-ai` AgentLoop can run inside Electron's main process (Node.js 22, Chromium V8). Pi uses `node:fs`, `node:child_process`, `node:path` — all available in Electron main process.
- `@earendil-works/pi-coding-agent`'s AgentSession constructor and event stream work without a terminal/TTY attachment.
- The `streamSimple` function from pi-ai can emit events that are serializable via Electron IPC (`contextBridge`).
- Pi's slash command parser (`slash-commands.ts`) can be extracted and reused in the renderer process for `/` autocomplete.
- Pi's session compaction logic works correctly when called from the main process (not CLI context).
- Pi's extension/tool registry can be introspected for the Tools and Skills management UI.

### 17. Empty State

When no API key or provider is configured, the Chat workspace shows an empty state instead of a blank chat area:

- **First launch / no provider**: A centered card with:
  - "Welcome to Pi Desktop" heading
  - "Configure an AI provider to get started" body text
  - Two buttons: "Set Up Provider" → opens Provider Manager, "Skip" → opens chat with guided notice
- **Provider configured but empty chat**: Soft prompt showing recent sessions or "Start a new conversation" call-to-action.
- **No sessions yet**: The Sessions panel shows a subtle "No sessions yet — start your first conversation" placeholder.

### 18. Backup & Restore

Within Settings modal.

- **Backup**: Click "Create Backup" — file dialog to save a `.pi-desktop-backup` archive containing all profiles, sessions, config.
- **Restore**: Click "Restore from Backup" — file picker, then confirmation dialog. Overwrites current data.
- **Auto-backup**: Optional, configurable interval (daily/weekly). Default: off.

## Settings Modal Includes:
- **Provider shortcuts**: Links to Provider Manager (standalone modal, not nested)
- **Theme**: Dark mode (default) / Light mode toggle
- **Model defaults**: Default model, thinking level
- **Keyboard shortcuts**: View full shortcut reference. Customize keybindings.
- **Working directory**: Default project path
- **Appearance**: Font size, zoom level
- **Auto-refresh**: Toggle file auto-refresh on/off globally. Debounce interval config.
- **Backup & Restore**: Full data backup/restore with file dialog
- **About**: Version, update check

## Preview Panel — External Editor Integration

The preview panel bridges Pi-generated content to external editors:

### Detection Logic

```typescript
async function openInExternalEditor(filePath: string): Promise<void> {
  const ext = path.extname(filePath).toLowerCase();

  // Office documents → system default (WPS / MS Office)
  if (['.pptx', '.docx', '.xlsx', '.ppt', '.doc', '.xls'].includes(ext)) {
    await shell.openPath(filePath);
    return;
  }

  // Source code prefer VS Code if installed
  if (['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.json', '.md', '.yaml', '.toml', '.css', '.html'].includes(ext)) {
    try {
      await execPromise(`code -r "${filePath}"`);
    } catch {
      await shell.openPath(filePath); // fallback to system default
    }
    return;
  }

  // HTML → browser
  if (ext === '.html') {
    await shell.openExternal(`file://${filePath}`);
    return;
  }

  // Fallback
  await shell.openPath(filePath);
}
```

### Copy-to-Project Flow

When Pi generates a file, the preview panel offers:
1. **Save to project** — saves the artifact to the current working directory
2. **Open in external editor** — opens the saved file in VSCode/WPS/browser
3. **Copy content** — copies to clipboard
4. **Download** — triggers file save dialog

## Chat Features

### Edit & Regenerate
- **Edit message**: User can edit their own sent message (click pencil icon or press `↑` on the last message). Editing re-sends the message to Pi, creating a new branch in the conversation.
- **Regenerate**: Each Pi response has a "⟳ Regenerate" button. Clicking aborts the current response and re-runs the same user message through the agent loop.
- **Branching**: Edited/regenerated messages create visible branch points in the chat history. User can navigate between branches.

### Token Limit Warning
- When context usage exceeds 80% of the model's token limit, a non-intrusive warning bar appears above the input area: "Context nearly full (82%). Consider starting a new session or running /compact."
- At 95%, the warning becomes more prominent with a yellow background.
- `/compact` slash command triggers Pi's compaction logic to summarize and prune context.

### Slash Commands GUI Integration
- `/` in input triggers an autocomplete popover (similar to VS Code command palette): lists available commands with descriptions and keyboard shortcuts.
- Results filtered as user types. Press `Tab` or `Enter` to select a command.
- Commands are sourced from Pi's `slash-commands.ts` registry via IPC.
- Custom icons for common commands: `/new` | `/clear` | `/compact` | `/model` | `/tools`

## Window Management

### Minimum Window Size
- Minimum window dimensions: 900×600 pixels.
- Below 700px width: left panel auto-collapses to icon-only.
- Below 500px width: right panel auto-collapses.

### Crash Recovery
- Messages saved to JSONL after every `turn_end` event (auto-save).
- Active session tracked in separate `active-session.json` pointer file.
- On restart, checks for unsaved messages → shows "Recover unsaved messages?" dialog.
- Crash during mid-LLM-call: partial stream lost, previously completed turns safe.

### File Auto-Refresh
- Pi Desktop watches the current working directory for changes using `fs.watch()`.
- When a file in Preview panel is modified externally (e.g., saved in WPS), preview auto-re-renders updated content.
- Debounced at 500ms to avoid flickering.
- PPTX files: re-parses and updates all slides on change.
- User can toggle auto-refresh off per-file via lock icon in file tab.

## Error Handling

### UI Layer
- **Network errors**: Toast notification "Provider connection failed. Check settings."
- **Stream errors**: Inline error message in chat where the response would render
- **Tool failures**: Red status badge on the tool call card with error message
- **Session corruption**: Graceful fallback — show error, offer to create new session
- **Config corruption**: Reset to defaults after confirmation dialog

### Main Process
- **Agent loop errors**: piped through `agent:event` with `type: "error"` — never silent
- **Unhandled rejections**: caught by Electron's `process.on('unhandledRejection')`, logged, displayed as toast
- **Provider API errors**: `pi-ai` already encodes these as `stopReason: "error"` with `errorMessage` — forward to renderer
- **File system errors**: caught per-operation, returned as IPC error response with user-friendly message

### Boundary
- All I/O operations (file read/write, shell calls, DB) are wrapped in try-catch
- IPC handlers return `{ success: boolean, data?: T, error?: string }`
- Agent loop never crashes the main process — errors are events, not exceptions

## Project Structure

```
pi-desktop/
├── package.json
├── electron.vite.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── resources/
│   └── icon.png
├── src/
│   ├── main/
│   │   ├── index.ts        # App entry, window creation, menu, system tray
│   │   ├── session.ts      # AgentSession wrapper, IPC handlers
│   │   ├── config.ts       # Desktop config persistence
│   │   ├── providers.ts    # Pi-AI provider management
│   │   ├── file-bridge.ts  # Open external editors + file system ops
│   │   ├── db.ts           # SQLite session index
│   │   └── tray.ts         # System tray + global shortcut
│   ├── preload/
│   │   ├── index.ts            # contextBridge
│   │   └── api.ts              # Exposed IPC API types
│   ├── renderer/
│   │   ├── main.tsx            # React entry
│   │   ├── App.tsx             # Root component (layout shell)
│   │   ├── components/
│   │   │   ├── TopBar.tsx
│   │   │   ├── SessionPanel.tsx
│   │   │   ├── ChatView.tsx
│   │   │   ├── MessageList.tsx
│   │   │   ├── MessageRow.tsx
│   │   │   ├── ToolCallCard.tsx
│   │   │   ├── InputBar.tsx
│   │   │   ├── PreviewPanel.tsx
│   │   │   ├── TokenCounter.tsx
│   │   │   └── ModelPicker.tsx
│   │   ├── screens/
│   │   │   ├── Welcome.tsx     # First-run wizard
│   │   │   ├── Settings.tsx    # Settings modal (provider, theme, keybindings, backup)
│   │   │   ├── Files.tsx       # Project file tree browser modal
│   │   │   ├── Tools.tsx       # Tools management modal
│   │   │   ├── Skills.tsx      # Skills management modal
│   │   │   ├── Memory.tsx      # Memory editor modal
│   │   │   └── Profile.tsx     # Profile manager modal
│   │   ├── hooks/
│   │   │   ├── useChatIPC.ts
│   │   │   ├── useSessions.ts
│   │   │   └── useConfig.ts
│   │   └── styles/
│   │       └── global.css
│   └── shared/
│       ├── types.ts            # IPC payload types
│       └── constants.ts
├── tests/
│   ├── main/
│   └── renderer/
└── .claude/
    └── settings.json
```

### Component Responsibility

| Component | Responsibility |
|-----------|---------------|
| `App.tsx` | Root layout: top bar + three-panel shell. Global keyboard shortcuts. |
| `TopBar.tsx` | App title, working directory, model picker, token counter, profile avatar, settings button |
| `SessionPanel.tsx` | Session list, search, filter, create/delete/rename. Footer: Tools/Skills/Memory buttons. |
| `ChatView.tsx` | Message list container + input bar. Scroll management, auto-scroll. |
| `MessageList.tsx` | Render messages, handle streaming updates, syntax highlight |
| `MessageRow.tsx` | Single message: user vs agent styling, copy button |
| `ToolCallCard.tsx` | Collapsible tool call card with status, arguments, duration |
| `InputBar.tsx` | Text input, slash commands, file attach, drag-drop zone, screenshot paste, context folder chips, voice button, send shortcut |
| `PreviewPanel.tsx` | Content-adaptive preview: multi-file tabs, Markdown render, code highlight, PPTX slide viewer (pptxviewjs), DOCX HTML render (mammoth), XLSX table preview. External open actions. |
| `ContextChips.tsx` | Compact attachment chips below input bar — file name, file type icon, remove button |
| `DropZone.tsx` | Visible drag-and-drop overlay indicator when files dragged over chat area |
| `TokenCounter.tsx` | Live token usage display |
| `TokenCounter.tsx` | Live token usage display |
| `ModelPicker.tsx` | Dropdown: select model + thinking level |
| `StatusBar.tsx` | Bottom bar: connection status, model, tool call count |
| `Files.tsx` | Modal: project file tree browser with preview, attach, open in editor actions |
| `Welcome.tsx` | First-run wizard: step-by-step setup (6 steps) |
| `Settings.tsx` | Modal: providers, theme, keybindings, working directory, backup, about |
| `Tools.tsx` | Modal: tool registry browser with enable/disable toggles |
| `Skills.tsx` | Modal: installed skills list with enable/disable |
| `Memory.tsx` | Modal: memory entries list with inline edit/delete |
| `Profile.tsx` | Modal: profile CRUD, switch, isolated config |

## Testing Strategy

| Test Type | Scope | Tooling |
|-----------|-------|---------|
| Unit: IPC handlers | Main process message handling | Vitest |
| Unit: File bridge | External editor detection logic | Vitest |
| Unit: Session manager | CRUD, search, persistence | Vitest |
| Component: React | Individual component rendering | Vitest + @testing-library/react |
| E2E | App launch, chat flow, session switch | Playwright |

## Out of Scope (v1)

- Voice input / TTS
- Computer Use / desktop automation
- Multi-session parallel view (side-by-side sessions)
- Plugin/extension management UI
- Linux build
- Mobile companion app
- Cloud sync of sessions
- Artifact version history
- i18n / multi-language
- Scheduled / cron tasks
- Messaging gateway integrations
- Session grouping / project categorization (post-v1 improvement)
- Inline artifact editing (select → modify selected region)
- AI-powered artifacts (Claude-style micro-apps)

## Design Decisions Record

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Layout** | Three-panel (nav+sessions \| chat \| preview) | Supports office-work multitasking: quick access to Tools/Skills/Memory, browse sessions, view outputs, open in WPS/VSCode |
| **Left panel** | Top: Tools/Skills/Memory entries. Bottom: Sessions list. Text-only, no icons. | Keeps feature entries always visible, sessions below with screen real estate priority |
| **Modes** | Single mode (no Chat/Code/Agent tabs) | Pi's agent loop handles all these naturally — artificial separation adds UX complexity without benefit |
| **Integration** | npm dependency (not fork, not subprocess) | Lowest coupling, clean upgrade path, Pi evolves independently |
| **Sessions** | JSONL per-file + SQLite index | Compatible with Pi's existing session format, FTS5 for fast search |
| **Preview** | Content-type-adaptive panel + multi-file tabs + in-app Office preview | Uses pptxviewjs/mammoth/SheetJS for in-app rendering (not file-info cards). "Open in Editor" still available as primary action. Multi-file tabs enable switching between artifacts generated in the same conversation. |
| **Theme** | Dark-first with light option | Matches Claude Desktop and Pi TUI aesthetics; dark is default for developer/office tools |
| **Model picker** | Top bar dropdown | Most-frequent action (switching models) kept accessible, not buried in Settings |
