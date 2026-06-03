import { app, BrowserWindow, ipcMain, shell, Tray, Menu, globalShortcut, nativeImage } from 'electron'
import { join, extname } from 'path'
import { readFileSync, readdirSync, statSync, writeFileSync } from 'fs'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { openInExternalEditor } from './file-bridge'
import { IPC_CHANNELS, APP_NAME, DEFAULT_WINDOW_WIDTH, DEFAULT_WINDOW_HEIGHT, MIN_WINDOW_WIDTH, MIN_WINDOW_HEIGHT } from '../shared/constants'
import {
  initDatabase,
  createSession,
  listSessions,
  searchSessions,
  deleteSession,
  updateSessionTitle,
  closeDatabase
} from './db'
import { ensureSessionsDir, appendMessage, readMessages } from './session-store'
import {
  loadProviders,
  addProvider,
  updateProvider,
  deleteProvider,
  testConnection
} from './providers'
import type { ProviderConfig } from './providers'
import { listProfiles, createProfile, deleteProfile, getActiveProfile, setActiveProfile } from './profiles'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: DEFAULT_WINDOW_WIDTH,
    height: DEFAULT_WINDOW_HEIGHT,
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
    show: false,
    backgroundColor: '#0F172A',
    title: APP_NAME,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
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

function createTray(): void {
  if (!mainWindow) return
  // Create a simple 16x16 tray icon
  const icon = nativeImage.createEmpty()
  tray = new Tray(icon)
  tray.setToolTip('Pi Desktop')

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show Window', click: () => mainWindow?.show() },
    { label: 'New Session', click: () => mainWindow?.show() },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.quit() } },
  ])
  tray.setContextMenu(contextMenu)

  tray.on('click', () => {
    mainWindow?.show()
  })
}

// Provider IPC handlers
ipcMain.handle('providers:list', async () => {
  return { success: true, data: loadProviders() }
})

ipcMain.handle('providers:add', async (_event, config, apiKey?: string) => {
  return { success: true, data: addProvider(config, apiKey) }
})

ipcMain.handle('providers:update', async (_event, id: string, updates) => {
  return { success: true, data: updateProvider(id, updates) }
})

ipcMain.handle('providers:delete', async (_event, id: string) => {
  return { success: true, data: deleteProvider(id) }
})

ipcMain.handle('providers:test', async (_event, config) => {
  return testConnection(config)
})

// Profile IPC handlers
ipcMain.handle('profiles:list', async () => {
  return { success: true, data: listProfiles() }
})

ipcMain.handle('profiles:create', async (_event, name: string) => {
  return { success: true, data: createProfile(name) }
})

ipcMain.handle('profiles:delete', async (_event, id: string) => {
  return { success: true, data: deleteProfile(id) }
})

ipcMain.handle('profiles:getActive', async () => {
  return { success: true, data: getActiveProfile() }
})

ipcMain.handle('profiles:switch', async (_event, id: string) => {
  setActiveProfile(id)
  return { success: true }
})

// Basic IPC handlers (mock for Phase 1 — Phase 2 gets real session manager)
ipcMain.handle(IPC_CHANNELS.CHAT_SEND, async (_event, payload: { text: string }) => {
  return { success: true }
})

ipcMain.handle(IPC_CHANNELS.CONFIG_GET, async (_event, key: string) => {
  return { success: true, data: null }
})

ipcMain.handle(IPC_CHANNELS.CONFIG_SET, async (_event, key: string, value: unknown) => {
  return { success: true }
})

// Session IPC handlers
ipcMain.handle(IPC_CHANNELS.SESSION_LIST, async () => {
  return { success: true, data: listSessions() }
})

ipcMain.handle(IPC_CHANNELS.SESSION_CREATE, async () => {
  const id = crypto.randomUUID()
  createSession(id)
  return { success: true, data: { id } }
})

ipcMain.handle(IPC_CHANNELS.SESSION_DELETE, async (_event, id: string) => {
  deleteSession(id)
  return { success: true }
})

ipcMain.handle(IPC_CHANNELS.SESSION_SEARCH, async (_event, query: string) => {
  return { success: true, data: searchSessions(query) }
})

ipcMain.handle(IPC_CHANNELS.SESSION_SWITCH, async (_event, id: string) => {
  const messages = readMessages(id)
  return { success: true, data: { messages } }
})

// File system IPC handlers
ipcMain.handle('files:list', async (_event, dirPath: string) => {
  try {
    const entries = readdirSync(dirPath)
    const files = entries
      .map((name) => {
        const fullPath = join(dirPath, name)
        try {
          const st = statSync(fullPath)
          return {
            name,
            path: fullPath,
            isDir: st.isDirectory(),
            size: st.size,
            modifiedAt: st.mtime.toISOString()
          }
        } catch {
          return null
        }
      })
      .filter(Boolean)
    return { success: true, data: files }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
})

ipcMain.handle('files:read', async (_event, filePath: string) => {
  try {
    const ext = extname(filePath)
    const isText = [
      '.md', '.txt', '.ts', '.tsx', '.js', '.py', '.go', '.rs', '.json',
      '.css', '.html', '.yaml', '.xml', '.sh'
    ].includes(ext.toLowerCase())
    if (isText) {
      return { success: true, data: { type: 'text', content: readFileSync(filePath, 'utf-8') } }
    }
    if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'].includes(ext.toLowerCase())) {
      const base64 = readFileSync(filePath).toString('base64')
      const mime = ext === '.svg' ? 'image/svg+xml' : `image/${ext.slice(1)}`
      return { success: true, data: { type: 'image', content: `data:${mime};base64,${base64}` } }
    }
    return { success: true, data: { type: 'binary', ext } }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
})

ipcMain.handle('files:save', async (_event, filePath: string, content: string) => {
  try {
    writeFileSync(filePath, content, 'utf-8')
    return { success: true }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
})

ipcMain.handle('files:open', async (_event, filePath: string) => {
  await openInExternalEditor(filePath)
  return { success: true }
})

app.on('web-contents-created', (_, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
})

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId(APP_NAME)
  optimizer.watchWindowShortcuts(mainWindow!)

  // Register global shortcut
  globalShortcut.register('Alt+Shift+Space', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide()
    } else {
      mainWindow?.show()
    }
  })

  ensureSessionsDir()
  initDatabase()

  createWindow()
  createTray()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  // Don't quit on close — minimize to tray
  if (mainWindow) {
    mainWindow.hide()
  }
})

app.on('before-quit', () => {
  closeDatabase()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})
