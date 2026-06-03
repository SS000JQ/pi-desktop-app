import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
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

let mainWindow: BrowserWindow | null = null

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

app.on('web-contents-created', (_, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
})

app.whenReady().then(() => {
  electronApp.setAppUserModelId(APP_NAME)
  optimizer.watchWindowShortcuts(mainWindow!)

  ensureSessionsDir()
  initDatabase()

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

app.on('before-quit', () => {
  closeDatabase()
})
