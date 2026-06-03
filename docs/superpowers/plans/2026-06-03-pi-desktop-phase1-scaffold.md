# Pi Desktop Implementation Plan (Phase 1: Core Scaffold + Chat)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the foundational Electron app shell with three-panel layout and working Chat experience.

**Architecture:** Electron 39 main process + React 19 renderer, electron-vite build tooling. Main process hosts Pi's AgentSession, renderer communicates via IPC contextBridge. Phase 1 establishes the project scaffold, layout shell, and chat UI with mock data (no Pi integration yet).

**Tech Stack:** Electron 39, React 19, TypeScript 5.9, electron-vite, Tailwind CSS 4, Lucide React (icons)

**Phases overview:**
- **Phase 1** (this plan): Project scaffold, layout, chat UI, input bar, mock streaming
- **Phase 2**: Session persistence, Provider Manager, Settings, Profile manager
- **Phase 3**: Preview panel with file tabs, PPTX/DOCX/XLSX preview, file tree, external editor integration
- **Phase 4**: System tray, Tools/Skills/Memory modals, keyboard shortcuts panel, backup/restore, empty states, crash recovery, file auto-refresh, token limit warning

---

## File Structure (Phase 1)

```
pi-desktop/
├── package.json
├── tsconfig.json
├── electron.vite.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── resources/
│   └── icon.png                    # Placeholder app icon
├── src/
│   ├── main/
│   │   └── index.ts                # Electron main process: window creation, basic IPC
│   ├── preload/
│   │   ├── index.ts                # contextBridge exposing IPC API
│   │   └── api.ts                  # IPC channel type definitions
│   ├── renderer/
│   │   ├── index.html              # HTML entry point
│   │   ├── main.tsx                # React entry point
│   │   ├── App.tsx                 # Root layout: top bar + three-panel shell
│   │   ├── components/
│   │   │   ├── TopBar.tsx          # App title, working directory, model picker, token counter, settings/avatar icons
│   │   │   ├── LeftPanel.tsx       # Files/Tools/Skills/Memory entries + sessions list + filter
│   │   │   ├── ChatView.tsx        # Chat container: messages + input area
│   │   │   ├── MessageList.tsx     # Message list with auto-scroll
│   │   │   ├── MessageRow.tsx      # Single message bubble (user or assistant)
│   │   │   ├── ToolCallCard.tsx    # Collapsible tool call card with status states
│   │   │   ├── InputBar.tsx        # Text input with file attach, send button, keyboard shortcuts
│   │   │   ├── ContextChips.tsx    # Attachment chips below input bar
│   │   │   ├── PreviewPanel.tsx    # Placeholder right panel (content in Phase 2)
│   │   │   └── StatusBar.tsx       # Connection status, model, tool call count
│   │   ├── hooks/
│   │   │   └── useChatIPC.ts       # IPC hook for sending/receiving messages (mock in Phase 1)
│   │   ├── styles/
│   │   │   └── global.css          # Tailwind directives + custom scrollbars + design system tokens
│   │   └── types/
│   │       └── chat.ts             # Message, ToolCall, Session types
│   └── shared/
│       └── constants.ts            # IPC channel names, app constants
└── tests/
    └── renderer/
        ├── MessageRow.test.tsx
        ├── InputBar.test.tsx
        └── ToolCallCard.test.tsx
```

---

### Task 1: Scaffold Electron + React + Tailwind project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `tsconfig.web.json`
- Create: `electron.vite.config.ts`
- Create: `tailwind.config.ts`
- Create: `postcss.config.js`
- Create: `src/renderer/index.html`
- Create: `resources/icon.png` (placeholder)

- [ ] **Step 1: Create package.json**

```json
{
  "name": "pi-desktop",
  "version": "0.1.0",
  "description": "Desktop GUI for Pi Agent Toolkit",
  "main": "./out/main/index.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "typecheck:node": "tsc --noEmit -p tsconfig.node.json",
    "typecheck:web": "tsc --noEmit -p tsconfig.web.json",
    "typecheck": "npm run typecheck:node && npm run typecheck:web",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "lucide-react": "^0.400.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@electron-toolkit/preload": "^3.0.2",
    "@electron-toolkit/utils": "^4.0.0",
    "@tailwindcss/vite": "^4.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "electron": "^39.0.0",
    "electron-builder": "^25.0.0",
    "electron-vite": "^2.4.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.9.0",
    "vitest": "^3.0.0",
    "@testing-library/react": "^16.0.0",
    "jsdom": "^25.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.node.json" },
    { "path": "./tsconfig.web.json" }
  ]
}
```

- [ ] **Step 3: Create tsconfig.node.json**

```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "./out",
    "types": ["electron-vite/node"]
  },
  "include": [
    "src/main/**/*",
    "src/preload/**/*",
    "electron.vite.config.ts"
  ]
}
```

- [ ] **Step 4: Create tsconfig.web.json**

```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "outDir": "./out",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/renderer/src/*"]
    }
  },
  "include": [
    "src/renderer/src/**/*",
    "src/renderer/src/**/*.tsx",
    "src/renderer/src/**/*.ts"
  ]
}
```

- [ ] **Step 5: Create electron.vite.config.ts**

```typescript
import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    build: {
      outDir: 'out/main',
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts')
        }
      }
    }
  },
  preload: {
    build: {
      outDir: 'out/preload',
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts')
        }
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    build: {
      outDir: 'out/renderer',
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html')
        }
      }
    },
    plugins: [react(), tailwindcss()]
  }
})
```

- [ ] **Step 6: Create tailwind.config.ts**

```typescript
import type { Config } from 'tailwindcss'

export default {
  content: ['./src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#1E293B',
        border: '#334155',
        muted: '#64748B',
        dim: '#475569',
        accent: '#3B82F6',
        'accent-hover': '#2563EB',
        success: '#22C55E',
        warning: '#F97316',
        error: '#EF4444',
      },
      fontFamily: {
        sans: ['IBM Plex Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        '2xs': '0.625rem',
      }
    }
  }
}
```

- [ ] **Step 7: Create postcss.config.js**

```js
module.exports = {
  plugins: {
    '@tailwindcss/postcss': {},
  }
}
```

- [ ] **Step 8: Create src/renderer/index.html**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Pi Desktop</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 9: Create placeholder icon**

```bash
# Create a minimal valid PNG (1x1 transparent pixel)
echo -ne '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\x0bIDAT\x08\xd7c\xf8\x0f\x00\x00\x00\x04\x00\x01\x91\x1b\xb0\xc1\x00\x00\x00\x00IEND\xae\x42\x60\x82' > resources/icon.png
```

- [ ] **Step 10: Install dependencies and verify build**

Run: `cd /d/PI/app && npm install`
Expected: packages install without errors.

Run: `npx electron-vite build`
Expected: Build succeeds, `out/` directory created with `main/`, `preload/`, `renderer/` subdirectories.

- [ ] **Step 11: Commit**

```bash
git add package.json tsconfig.json tsconfig.node.json tsconfig.web.json electron.vite.config.ts tailwind.config.ts postcss.config.js resources/icon.png src/renderer/index.html package-lock.json
git commit -m "feat: scaffold Electron + React + Tailwind project"
```

---

### Task 2: Create shared constants and types

**Files:**
- Create: `src/shared/constants.ts`
- Create: `src/renderer/src/types/chat.ts`

- [ ] **Step 1: Create IPC channel constants**

`src/shared/constants.ts`:
```typescript
export const IPC_CHANNELS = {
  CHAT_SEND: 'chat:send',
  CHAT_ABORT: 'chat:abort',
  AGENT_EVENT: 'agent:event',
  SESSIONS_LIST: 'sessions:list',
  SESSIONS_CREATE: 'sessions:create',
  SESSIONS_DELETE: 'sessions:delete',
  SESSIONS_SEARCH: 'sessions:search',
  SESSION_SWITCH: 'session:switch',
  CONFIG_GET: 'config:get',
  CONFIG_SET: 'config:set',
} as const

export const APP_NAME = 'Pi Desktop'
export const DEFAULT_WINDOW_WIDTH = 1200
export const DEFAULT_WINDOW_HEIGHT = 800
export const MIN_WINDOW_WIDTH = 900
export const MIN_WINDOW_HEIGHT = 600

export const COLORS = {
  bg: '#0F172A',
  surface: '#1E293B',
  border: '#334155',
  text: '#F1F5F9',
  muted: '#64748B',
  accent: '#3B82F6',
  success: '#22C55E',
  warning: '#F97316',
  error: '#EF4444',
}
```

- [ ] **Step 2: Create chat types**

`src/renderer/src/types/chat.ts`:
```typescript
export interface ToolCall {
  id: string
  name: string
  args: string
  status: 'running' | 'done' | 'error'
  duration?: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  toolCalls?: ToolCall[]
  attachments?: string[]
  isStreaming?: boolean
}

export interface Session {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messages: Message[]
  model?: string
  tokenCount?: number
}

export interface ModelOption {
  id: string
  name: string
  provider: string
}
```

- [ ] **Step 3: Commit**

```bash
git add src/shared/constants.ts src/renderer/src/types/chat.ts
git commit -m "feat: add shared constants and chat types"
```

---

### Task 3: Create Electron main process and preload

**Files:**
- Create: `src/main/index.ts`
- Create: `src/preload/index.ts`
- Create: `src/preload/api.ts`

- [ ] **Step 1: Create main process entry**

`src/main/index.ts`:
```typescript
import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { IPC_CHANNELS, DEFAULT_WINDOW_WIDTH, DEFAULT_WINDOW_HEIGHT, MIN_WINDOW_WIDTH, MIN_WINDOW_HEIGHT } from '../shared/constants'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: DEFAULT_WINDOW_WIDTH,
    height: DEFAULT_WINDOW_HEIGHT,
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
    show: false,
    backgroundColor: '#0F172A',
    title: 'Pi Desktop',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Basic IPC handlers (mock — Phase 2 gets real session manager)
ipcMain.handle(IPC_CHANNELS.CHAT_SEND, async (_event, payload: { text: string }) => {
  // Phase 2: forward to Pi AgentSession
  return { success: true }
})

ipcMain.handle(IPC_CHANNELS.CONFIG_GET, async (_event, key: string) => {
  return { success: true, data: null }
})

ipcMain.handle(IPC_CHANNELS.CONFIG_SET, async (_event, key: string, value: unknown) => {
  return { success: true }
})

// Open external URLs
app.on('web-contents-created', (_, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
})

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
```

- [ ] **Step 2: Create preload API types**

`src/preload/api.ts`:
```typescript
import { IPC_CHANNELS } from '../shared/constants'

export interface IpcResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

export interface PiDesktopApi {
  chat: {
    send: (text: string) => Promise<IpcResponse>
  }
  config: {
    get: (key: string) => Promise<IpcResponse>
    set: (key: string, value: unknown) => Promise<IpcResponse>
  }
  onAgentEvent: (callback: (event: unknown) => void) => () => void
}
```

- [ ] **Step 3: Create contextBridge**

`src/preload/index.ts`:
```typescript
import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/constants'
import type { PiDesktopApi } from './api'

const api: PiDesktopApi = {
  chat: {
    send: (text: string) => ipcRenderer.invoke(IPC_CHANNELS.CHAT_SEND, { text }),
  },
  config: {
    get: (key: string) => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_GET, key),
    set: (key: string, value: unknown) => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_SET, key, value),
  },
  onAgentEvent: (callback) => {
    const handler = (_event: unknown, data: unknown) => callback(data)
    ipcRenderer.on(IPC_CHANNELS.AGENT_EVENT, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.AGENT_EVENT, handler)
  }
}

contextBridge.exposeInMainWorld('piDesktop', api)
```

- [ ] **Step 4: Commit**

```bash
git add src/main/index.ts src/preload/index.ts src/preload/api.ts
git commit -m "feat: add Electron main process and preload bridge"
```

---

### Task 4: Create global CSS with design system tokens

**Files:**
- Create: `src/renderer/src/styles/global.css`

- [ ] **Step 1: Create global CSS**

`src/renderer/src/styles/global.css`:
```css
@import "tailwindcss";

@theme {
  --color-surface: #1E293B;
  --color-border: #334155;
  --color-muted: #64748B;
  --color-dim: #475569;
  --color-accent: #3B82F6;
  --color-accent-hover: #2563EB;
  --color-success: #22C55E;
  --color-warning: #F97316;
  --color-error: #EF4444;
  --font-sans: 'IBM Plex Sans', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: var(--font-sans);
  font-size: 13px;
  line-height: 1.5;
  color: #F1F5F9;
  background: #0F172A;
  overflow: hidden;
  -webkit-font-smoothing: antialiased;
}

/* Custom scrollbars */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #334155;
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: #475569;
}

/* Drag region for window */
.drag-region {
  -webkit-app-region: drag;
}
.no-drag {
  -webkit-app-region: no-drag;
}

/* Transitions */
.transition-fade {
  transition: opacity 150ms ease, background-color 150ms ease, color 150ms ease, border-color 150ms ease;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/src/styles/global.css
git commit -m "feat: add global CSS with design system tokens and custom scrollbars"
```

---

### Task 5: Build the layout shell (App.tsx + all panel components)

**Files:**
- Create: `src/renderer/src/main.tsx`
- Create: `src/renderer/src/App.tsx`
- Create: `src/renderer/src/components/TopBar.tsx`
- Create: `src/renderer/src/components/LeftPanel.tsx`
- Create: `src/renderer/src/components/ChatView.tsx`
- Create: `src/renderer/src/components/StatusBar.tsx`
- Create: `src/renderer/src/components/PreviewPanel.tsx`

- [ ] **Step 1: Create React entry point**

`src/renderer/src/main.tsx`:
```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Stage A: Declare window.piDesktop type**

Create `src/renderer/src/env.d.ts`:
```typescript
/// <reference types="vite/client" />

import type { PiDesktopApi } from '../../preload/api'

declare global {
  interface Window {
    piDesktop: PiDesktopApi
  }
}
```

- [ ] **Stage B: Create App.tsx (three-panel layout shell)**

`src/renderer/src/App.tsx`:
```tsx
import { useState, useEffect, useCallback } from 'react'
import TopBar from './components/TopBar'
import LeftPanel from './components/LeftPanel'
import ChatView from './components/ChatView'
import PreviewPanel from './components/PreviewPanel'
import StatusBar from './components/StatusBar'

interface Session {
  id: string
  title: string
  updatedAt: number
}

function App() {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [sessions, setSessions] = useState<Session[]>(mockSessions)
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false)
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false)
  const [currentDir, setCurrentDir] = useState('~/projects/ppt-demo')

  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)

  const handleSendMessage = useCallback((text: string) => {
    if (!text.trim() || isStreaming) return

    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }

    setMessages(prev => [...prev, userMsg])
    setIsStreaming(true)

    // Mock streaming response (Phase 2 will use real IPC)
    setTimeout(() => {
      const assistantMsg: Message = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: 'This is a mock response. Phase 2 will connect to Pi AgentSession.',
        timestamp: Date.now() + 200,
        toolCalls: [
          { id: 'tc-1', name: 'web_search', args: '("query")', status: 'done', duration: '0.8s' }
        ]
      }
      setMessages(prev => [...prev, assistantMsg])
      setIsStreaming(false)
    }, 1500)
  }, [isStreaming])

  return (
    <div className="flex flex-col h-screen bg-[#0F172A] text-[#F1F5F9]">
      <TopBar currentDir={currentDir} />
      <div className="flex flex-1 min-h-0">
        <LeftPanel
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSessionSelect={(id) => setActiveSessionId(id)}
          collapsed={leftPanelCollapsed}
          onToggleCollapse={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
        />
        <ChatView
          messages={messages}
          onSendMessage={handleSendMessage}
          isStreaming={isStreaming}
        />
        <PreviewPanel
          collapsed={rightPanelCollapsed}
          onToggleCollapse={() => setRightPanelCollapsed(!rightPanelCollapsed)}
        />
      </div>
      <StatusBar />
    </div>
  )
}

const mockSessions: Session[] = [
  { id: 's1', title: 'PPT 结构设计', updatedAt: Date.now() - 180000 },
  { id: 's2', title: '数据分析脚本', updatedAt: Date.now() - 3600000 },
  { id: 's3', title: '配色方案生成', updatedAt: Date.now() - 7200000 },
  { id: 's4', title: '周报草稿', updatedAt: Date.now() - 86400000 },
]

export default App
```

- [ ] **Stage C: Create TopBar**

`src/renderer/src/components/TopBar.tsx`:
```tsx
interface TopBarProps {
  currentDir: string
}

export default function TopBar({ currentDir }: TopBarProps) {
  return (
    <div className="drag-region flex items-center px-3 h-10 border-b border-[#1E293B] bg-[#0F172A] flex-shrink-0">
      <span className="font-semibold text-sm tracking-tight">Pi Desktop</span>
      <span className="ml-4 text-xs text-muted">{currentDir}</span>

      <div className="ml-auto flex items-center gap-2.5 no-drag">
        <div className="flex items-center gap-1 px-2 py-0.5 border border-border rounded-md text-xs text-[#94A3B8] font-medium cursor-pointer hover:border-accent transition-colors">
          Sonnet 4.6 <span className="text-[8px] text-muted ml-0.5">▾</span>
        </div>
        <span className="text-[10px] text-muted font-mono">
          <span className="text-[#94A3B8]">1,247</span> / 8,000
        </span>
        <button className="w-6 h-6 rounded-md flex items-center justify-center text-dim hover:text-[#F1F5F9] hover:bg-surface transition-all text-xs" title="Search">⌕</button>
        <button className="w-6 h-6 rounded-md flex items-center justify-center text-dim hover:text-[#F1F5F9] hover:bg-surface transition-all text-xs" title="Profile">P</button>
        <button className="w-6 h-6 rounded-md flex items-center justify-center text-dim hover:text-[#F1F5F9] hover:bg-surface transition-all text-xs" title="Settings">⚙</button>
      </div>
    </div>
  )
}
```

- [ ] **Stage D: Create LeftPanel with resizable support**

`src/renderer/src/components/LeftPanel.tsx`:
```tsx
import { useState } from 'react'

interface Session {
  id: string
  title: string
  updatedAt: number
}

interface LeftPanelProps {
  sessions: Session[]
  activeSessionId: string | null
  onSessionSelect: (id: string) => void
  collapsed: boolean
  onToggleCollapse: () => void
}

export default function LeftPanel({ sessions, activeSessionId, onSessionSelect, collapsed, onToggleCollapse }: LeftPanelProps) {
  const [filter, setFilter] = useState<'all' | 'active'>('all')

  if (collapsed) {
    return (
      <div className="w-12 flex-shrink-0 bg-[#0F172A] border-r border-[#1E293B] flex flex-col items-center pt-2">
        <button onClick={onToggleCollapse} className="text-[10px] text-dim hover:text-muted mb-4" style={{ writingMode: 'vertical-lr', letterSpacing: '2px' }}>
          EXPAND
        </button>
      </div>
    )
  }

  return (
    <div className="w-[140px] flex-shrink-0 bg-[#0F172A] border-r border-[#1E293B] flex flex-col relative">
      {/* Resize handle visual — actual resize requires native Electron or mouse events */}
      <div className="absolute right-0 top-0 bottom-0 w-[3px] cursor-col-resize z-10 hover:bg-accent/50" />

      <div className="px-1.5 pt-2 pb-1">
        <NavItem active>Files</NavItem>
        <NavItem>Tools</NavItem>
        <NavItem>Skills</NavItem>
        <NavItem>Memory</NavItem>
      </div>

      <div className="h-px bg-[#1E293B] mx-2.5 my-1" />

      <div className="flex items-center justify-between px-2 py-1">
        <span className="text-[9px] uppercase tracking-wider text-dim font-semibold">Sessions</span>
        <button className="text-dim hover:text-muted text-sm leading-none transition-colors">+</button>
      </div>

      <div className="flex-1 overflow-y-auto px-1.5 pb-1">
        {sessions.map(s => (
          <div
            key={s.id}
            onClick={() => onSessionSelect(s.id)}
            className={`px-2 py-1 mb-px rounded text-xs cursor-pointer transition-all truncate ${
              s.id === activeSessionId
                ? 'bg-surface text-[#F1F5F9] font-medium'
                : 'text-muted hover:bg-surface hover:text-[#CBD5E1]'
            }`}
          >
            {s.title}
          </div>
        ))}
      </div>

      <div className="flex gap-1 px-2 py-1 border-t border-[#1E293B] mt-auto">
        <button
          onClick={() => setFilter('all')}
          className={`px-1.5 py-0.5 rounded-full text-[9px] ${filter === 'all' ? 'bg-surface text-[#94A3B8]' : 'text-dim hover:text-muted'}`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('active')}
          className={`px-1.5 py-0.5 rounded-full text-[9px] ${filter === 'active' ? 'bg-surface text-[#94A3B8]' : 'text-dim hover:text-muted'}`}
        >
          Active
        </button>
        <button onClick={onToggleCollapse} className="ml-auto text-[9px] text-dim hover:text-muted">◀</button>
      </div>
    </div>
  )
}

function NavItem({ children, active }: { children: string; active?: boolean }) {
  return (
    <div className={`px-2 py-1 rounded text-xs font-medium cursor-pointer transition-all ${
      active ? 'bg-surface text-[#F1F5F9]' : 'text-muted hover:bg-surface hover:text-[#F1F5F9]'
    }`}>
      {children}
    </div>
  )
}
```

- [ ] **Stage E: Create ChatView (container)**

`src/renderer/src/components/ChatView.tsx`:
```tsx
import { useRef, useEffect } from 'react'
import MessageList from './MessageList'
import InputBar from './InputBar'
import type { Message } from '../types/chat'

interface ChatViewProps {
  messages: Message[]
  onSendMessage: (text: string) => void
  isStreaming: boolean
}

export default function ChatView({ messages, onSendMessage, isStreaming }: ChatViewProps) {
  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#0F172A]">
      <MessageList messages={messages} isStreaming={isStreaming} />
      <InputBar onSendMessage={onSendMessage} isStreaming={isStreaming} />
    </div>
  )
}
```

- [ ] **Stage F: Create MessageList and MessageRow**

`src/renderer/src/components/MessageList.tsx`:
```tsx
import { useRef, useEffect } from 'react'
import MessageRow from './MessageRow'
import type { Message } from '../types/chat'

interface MessageListProps {
  messages: Message[]
  isStreaming: boolean
}

export default function MessageList({ messages, isStreaming }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted text-sm">
        <div className="text-center">
          <div className="text-2xl mb-2">💬</div>
          <div>Ask Pi anything to get started</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
      {messages.map(msg => (
        <MessageRow key={msg.id} message={msg} />
      ))}
      {isStreaming && (
        <div className="flex items-center gap-1.5 text-muted text-xs font-mono ml-2">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          Pi is thinking...
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  )
}
```

`src/renderer/src/components/MessageRow.tsx`:
```tsx
import { useState } from 'react'
import ToolCallCard from './ToolCallCard'
import type { Message } from '../types/chat'

interface MessageRowProps {
  message: Message
}

export default function MessageRow({ message }: MessageRowProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[85%] ${isUser ? 'self-end' : ''}`}>
      <div className={`text-[10px] mb-0.5 ${isUser ? 'text-muted' : 'text-success'}`}>
        {isUser ? 'You' : 'Pi'}
      </div>
      <div className={`px-3 py-2 rounded-lg leading-relaxed text-sm ${
        isUser
          ? 'bg-surface text-[#F1F5F9] rounded-br-sm'
          : 'bg-surface text-[#E2E8F0] rounded-bl-sm'
      }`}>
        <div className="whitespace-pre-wrap">{message.content}</div>

        {message.toolCalls?.map(tc => (
          <ToolCallCard key={tc.id} toolCall={tc} />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Stage G: Create ToolCallCard**

`src/renderer/src/components/ToolCallCard.tsx`:
```tsx
import type { ToolCall } from '../types/chat'

interface ToolCallCardProps {
  toolCall: ToolCall
}

export default function ToolCallCard({ toolCall }: ToolCallCardProps) {
  const borderColor = {
    running: 'border-l-accent',
    done: 'border-l-success',
    error: 'border-l-error',
  }[toolCall.status]

  const indicator = toolCall.status === 'done' ? (
    <><span className="w-1 h-1 rounded-full bg-success inline-block mr-1" /> Done</>
  ) : toolCall.status === 'running' ? (
    <><span className="w-1 h-1 rounded-full bg-accent inline-block mr-1 animate-pulse" /> Running...</>
  ) : (
    <><span className="w-1 h-1 rounded-full bg-error inline-block mr-1" /> Error</>
  )

  return (
    <div className={`mt-1.5 bg-[#0F172A] border border-border border-l-3 ${borderColor} rounded px-2.5 py-1.5 font-mono text-[10px] leading-relaxed`}>
      <div><span className="text-warning">{toolCall.name}</span> <span className="text-muted">({toolCall.args})</span></div>
      <div className="text-muted text-[10px] mt-0.5">
        {indicator} {toolCall.duration && `· ${toolCall.duration}`}
      </div>
    </div>
  )
}
```

- [ ] **Stage H: Create InputBar**

`src/renderer/src/components/InputBar.tsx`:
```tsx
import { useState, useRef, KeyboardEvent } from 'react'
import ContextChips from './ContextChips'

interface InputBarProps {
  onSendMessage: (text: string) => void
  isStreaming: boolean
}

export default function InputBar({ onSendMessage, isStreaming }: InputBarProps) {
  const [text, setText] = useState('')
  const [attachments, setAttachments] = useState<{ name: string }[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSend = () => {
    if (!text.trim() || isStreaming) return
    onSendMessage(text)
    setText('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSend()
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.metaKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="border-t border-[#1E293B] bg-[#0F172A] px-3 py-2 flex-shrink-0">
      {attachments.length > 0 && (
        <ContextChips attachments={attachments} onRemove={removeAttachment} />
      )}
      <div className="flex items-center gap-1.5 bg-surface border border-border rounded-md px-2 py-1.5 transition-colors focus-within:border-accent">
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Pi... ( / commands · drop files · paste images )"
          className="flex-1 bg-transparent border-none outline-none text-sm text-[#F1F5F9] placeholder-muted"
          disabled={isStreaming}
        />
        <div className="flex items-center gap-1 flex-shrink-0">
          <button title="Attach files" className="text-dim hover:text-muted text-sm px-0.5 rounded transition-colors hover:bg-[#334155]">📎</button>
          <button title="Paste screenshot" className="text-dim hover:text-muted text-sm px-0.5 rounded transition-colors hover:bg-[#334155]">🖼</button>
          <span className="text-[#334155] text-[9px] font-mono">⌘⏎</span>
          <button
            onClick={handleSend}
            disabled={isStreaming || !text.trim()}
            className="bg-accent text-white border-none rounded px-2 py-0.5 text-[10px] font-medium cursor-pointer hover:bg-accent-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Stage I: Create ContextChips**

`src/renderer/src/components/ContextChips.tsx`:
```tsx
interface ContextChipsProps {
  attachments: { name: string }[]
  onRemove: (index: number) => void
}

export default function ContextChips({ attachments, onRemove }: ContextChipsProps) {
  return (
    <div className="flex gap-1 flex-wrap pb-1">
      {attachments.map((file, i) => (
        <div key={i} className="flex items-center gap-1 bg-surface border border-border rounded px-1.5 py-0.5 text-[10px] text-[#94A3B8]">
          <span className="text-xs">📄</span>
          {file.name}
          <button onClick={() => onRemove(i)} className="text-dim hover:text-error text-xs leading-none ml-0.5">✕</button>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Stage J: Create PreviewPanel**

`src/renderer/src/components/PreviewPanel.tsx`:
```tsx
interface PreviewPanelProps {
  collapsed: boolean
  onToggleCollapse: () => void
}

export default function PreviewPanel({ collapsed, onToggleCollapse }: PreviewPanelProps) {
  if (collapsed) {
    return (
      <div className="w-12 flex-shrink-0 bg-[#0F172A] border-l border-[#1E293B] flex items-start justify-center pt-4 relative group">
        <button onClick={onToggleCollapse} className="text-[10px] text-dim hover:text-muted hidden group-hover:block" style={{ writingMode: 'vertical-lr', letterSpacing: '2px' }}>
          PREVIEW
        </button>
      </div>
    )
  }

  return (
    <div className="w-[260px] flex-shrink-0 bg-[#0F172A] border-l border-[#1E293B] flex flex-col relative group">
      <div className="absolute left-0 top-0 bottom-0 w-[3px] cursor-col-resize z-10 hover:bg-accent/50" />
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-10 bg-surface rounded-r flex items-center justify-center cursor-pointer text-muted text-[10px] opacity-0 group-hover:opacity-100 transition-opacity z-5"
           onClick={onToggleCollapse}>›</div>

      <div className="px-2.5 pt-1.5">
        <div className="flex gap-1 overflow-x-auto">
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-t text-[10px] cursor-pointer text-muted bg-surface">
            <span>📄</span> 大纲.md
            <span className="text-dim hover:text-error text-xs ml-0.5 cursor-pointer">✕</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between px-2.5 py-1">
        <span className="text-[9px] uppercase tracking-wider text-dim font-semibold">Preview</span>
        <span className="text-dim cursor-pointer text-xs">↗</span>
      </div>

      {/* Preview content area - Phase 2 will render real content */}
      <div className="flex-1 mx-2 mb-2 bg-surface rounded p-3 font-mono text-[11px] leading-relaxed overflow-y-auto text-muted">
        <div className="text-center text-dim text-[10px] mt-8">
          Files will preview here
        </div>
      </div>

      <div className="flex gap-1 px-2 py-1.5 border-t border-[#1E293B]">
        <button className="px-1.5 py-0.5 rounded text-[10px] cursor-pointer bg-surface text-[#94A3B8] hover:bg-[#334155] transition-all">📂 Save</button>
        <button className="px-1.5 py-0.5 rounded text-[10px] cursor-pointer bg-accent text-white hover:bg-accent-hover transition-all">🔗 Open in WPS</button>
        <button className="px-1.5 py-0.5 rounded text-[10px] cursor-pointer bg-surface text-[#94A3B8] hover:bg-[#334155] transition-all">📋 Copy</button>
      </div>
    </div>
  )
}
```

- [ ] **Stage K: Create StatusBar**

`src/renderer/src/components/StatusBar.tsx`:
```tsx
export default function StatusBar() {
  return (
    <div className="flex items-center gap-2.5 px-3 py-0.5 bg-[#0F172A] border-t border-[#1E293B] text-[10px] text-dim font-mono flex-shrink-0">
      <span className="w-1 h-1 rounded-full bg-success" />
      <span>Connected</span>
      <span className="text-[#1E293B]">|</span>
      <span>Sonnet 4.6</span>
      <span className="text-[#1E293B]">|</span>
      <span>0 calls</span>
      <span className="ml-auto">0 files in context</span>
    </div>
  )
}
```

- [ ] **Step 3: Verify build compiles**

Run: `npx tsc --noEmit -p tsconfig.web.json && npx tsc --noEmit -p tsconfig.node.json`
Expected: No type errors.

Run: `npx electron-vite build`
Expected: Build succeeds, all components compiled.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/main.tsx src/renderer/src/App.tsx src/renderer/src/env.d.ts src/renderer/src/components/TopBar.tsx src/renderer/src/components/LeftPanel.tsx src/renderer/src/components/ChatView.tsx src/renderer/src/components/MessageList.tsx src/renderer/src/components/MessageRow.tsx src/renderer/src/components/ToolCallCard.tsx src/renderer/src/components/InputBar.tsx src/renderer/src/components/ContextChips.tsx src/renderer/src/components/PreviewPanel.tsx src/renderer/src/components/StatusBar.tsx
git commit -m "feat: add layout shell with three-panel UI and chat components"
```

---

### Task 6: Write unit tests for core components

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/renderer/MessageRow.test.tsx`
- Create: `tests/renderer/InputBar.test.tsx`
- Create: `tests/renderer/ToolCallCard.test.tsx`

- [ ] **Step 1: Create vitest.config.ts**

`vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: [],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer/src'),
    },
  },
})
```

- [ ] **Step 2: Write MessageRow test**

`tests/renderer/MessageRow.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import MessageRow from '../../src/renderer/src/components/MessageRow'

describe('MessageRow', () => {
  it('renders user message correctly', () => {
    render(<MessageRow message={{ id: '1', role: 'user', content: 'Hello', timestamp: 0 }} />)
    expect(screen.getByText('You')).toBeTruthy()
    expect(screen.getByText('Hello')).toBeTruthy()
  })

  it('renders assistant message with Pi label', () => {
    render(<MessageRow message={{ id: '2', role: 'assistant', content: 'Hi there', timestamp: 0, toolCalls: [] }} />)
    expect(screen.getByText('Pi')).toBeTruthy()
    expect(screen.getByText('Hi there')).toBeTruthy()
  })

  it('renders tool calls when present', () => {
    const message = {
      id: '3',
      role: 'assistant' as const,
      content: 'Searching...',
      timestamp: 0,
      toolCalls: [{ id: 'tc1', name: 'web_search', args: '("query")', status: 'done' as const }],
    }
    const { container } = render(<MessageRow message={message} />)
    expect(container.textContent).toContain('web_search')
  })
})
```

- [ ] **Step 3: Write InputBar test**

`tests/renderer/InputBar.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import InputBar from '../../src/renderer/src/components/InputBar'

describe('InputBar', () => {
  it('calls onSendMessage when Enter is pressed', () => {
    const onSend = vi.fn()
    render(<InputBar onSendMessage={onSend} isStreaming={false} />)
    const input = screen.getByPlaceholderText(/Ask Pi/)
    fireEvent.change(input, { target: { value: 'hello' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSend).toHaveBeenCalledWith('hello')
  })

  it('does not call onSendMessage when empty', () => {
    const onSend = vi.fn()
    render(<InputBar onSendMessage={onSend} isStreaming={false} />)
    const input = screen.getByPlaceholderText(/Ask Pi/)
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSend).not.toHaveBeenCalled()
  })

  it('disables input while streaming', () => {
    render(<InputBar onSendMessage={() => {}} isStreaming={true} />)
    const input = screen.getByPlaceholderText(/Ask Pi/)
    expect(input).toBeDisabled()
  })
})
```

- [ ] **Step 4: Write ToolCallCard test**

`tests/renderer/ToolCallCard.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import ToolCallCard from '../../src/renderer/src/components/ToolCallCard'

describe('ToolCallCard', () => {
  it('shows done status with green indicator', () => {
    const { container } = render(<ToolCallCard toolCall={{ id: '1', name: 'search', args: '("x")', status: 'done', duration: '0.5s' }} />)
    expect(container.textContent).toContain('search')
    expect(container.textContent).toContain('Done')
    expect(container.textContent).toContain('0.5s')
  })

  it('shows running status', () => {
    const { container } = render(<ToolCallCard toolCall={{ id: '2', name: 'bash', args: '("ls")', status: 'running' }} />)
    expect(container.textContent).toContain('Running')
  })

  it('shows error status', () => {
    const { container } = render(<ToolCallCard toolCall={{ id: '3', name: 'read_file', args: '("/x")', status: 'error' }} />)
    expect(container.textContent).toContain('Error')
  })
})
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run`
Expected: All 8 tests pass.

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts tests/renderer/MessageRow.test.tsx tests/renderer/InputBar.test.tsx tests/renderer/ToolCallCard.test.tsx
git commit -m "test: add MessageRow, InputBar, and ToolCallCard unit tests"
```

---

## Phase 1 Self-Review

**Spec coverage check:**
- ✅ Three-panel layout (App.tsx)
- ✅ Top bar with model picker + token count (TopBar.tsx)
- ✅ Left panel: nav entries + sessions list + filter (LeftPanel.tsx)
- ✅ Chat: messages + tool calls + empty state (MessageList, MessageRow, ToolCallCard)
- ✅ Input bar with file attach, placeholder text, ⌘⏎ hint (InputBar)
- ✅ Context chips (ContextChips)
- ✅ Preview panel with file tabs (PreviewPanel.tsx)
- ✅ Status bar with connection indicator (StatusBar.tsx)
- ✅ Dark theme design system (global.css with Tailwind v4 theme)
- ✅ Custom scrollbars (::webkit-scrollbar styling)
- ✅ Font loading (IBM Plex Sans + JetBrains Mono via Google Fonts)
- ✅ Electron main process + preload bridge scaffolding
- ✅ Shared constants and types
- ✅ 8 passing unit tests

**What Phase 1 does NOT cover (moved to Phase 2-4):**
- ❌ Real Pi AgentSession integration (uses mock setTimeout)
- ❌ Session persistence (SQLite + JSONL)
- ❌ Provider management UI
- ❌ Settings modal
- ❌ File tree browser
- ❌ PPTX/DOCX/XLSX preview libraries
- ❌ External editor detection
- ❌ System tray
- ❌ Slash commands autocomplete
- ❌ Keyboard shortcuts panel

---

## Phase 2-4 Outlines (brief)

### Phase 2: Sessions + Providers + Settings

Key tasks:
1. SQLite session persistence (FTS5 search)
2. Provider Manager UI (standalone modal)
3. Welcome/First-run wizard
4. Settings modal (theme, model defaults, appearance)
5. Profile manager
6. Real Pi AgentSession integration (IPC)
7. Slash commands autocomplete
8. Message edit/regenerate
9. Empty states for no-provider dashboard

### Phase 3: Preview + Files

Key tasks:
1. pptxviewjs integration (PPT slide viewer)
2. mammoth.js integration (DOCX → HTML)
3. SheetJS integration (XLSX → table)
4. highlight.js integration (code syntax highlighting)
5. Project Files tree browser modal
6. External editor detection (file-bridge.ts)
7. Dynamic preview action buttons
8. File auto-refresh (fs.watch)
9. Drag-drop + screenshot paste + file path detection in InputBar
10. Multi-file tabs with close/open

### Phase 4: System Features

Key tasks:
1. System tray + global shortcut (`Alt+Shift+Space`)
2. Tools management modal
3. Skills management modal
4. Memory editor modal
5. Keyboard shortcuts panel (`⌘/`)
6. Working directory switcher (top bar dropdown)
7. Backup & restore
8. Token limit warning bar
9. Crash recovery (active-session.json)
10. Minimum window size + auto-collapse
11. Side panel resize handles (native mouse drag)
