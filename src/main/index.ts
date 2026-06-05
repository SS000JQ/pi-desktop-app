import { app, BrowserWindow, ipcMain, shell, Tray, Menu, globalShortcut, nativeImage } from 'electron'
import { join, extname } from 'path'
import { readFileSync, readdirSync, statSync, writeFileSync, watch, existsSync, mkdirSync } from 'fs'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { openInExternalEditor } from './file-bridge'
import {
  IPC_CHANNELS,
  APP_NAME,
  DEFAULT_WINDOW_WIDTH,
  DEFAULT_WINDOW_HEIGHT,
  MIN_WINDOW_WIDTH,
  MIN_WINDOW_HEIGHT,
} from '../shared/constants'
import { initDatabase, closeDatabase } from './db'
import { ensureSessionsDir } from './session-store'
import {
  getProviderCatalog,
  loadProviders,
  addProvider,
  updateProvider,
  deleteProvider,
  testConnection,
  discoverModels,
} from './providers'
import { listProfiles, createProfile, deleteProfile, getActiveProfile, setActiveProfile } from './profiles'
import { getConfigValue, setConfigValue } from './config-store'
import { piBridge } from './pi-bridge'
import {
  createPiSession,
  listPiSessions,
  openPiSession,
  updatePiSessionRuntime,
} from './pi-sessions'
import {
  getActiveSessionId,
  getDesktopStateSummary,
  saveActiveSessionId,
} from './desktop-state'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
const fileWatchers = new Map<string, import('fs').FSWatcher>()

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
      nodeIntegration: false,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function createTray(): void {
  if (!mainWindow) return

  const icon = nativeImage.createEmpty()
  tray = new Tray(icon)
  tray.setToolTip('Pi Desktop')

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show Window', click: () => mainWindow?.show() },
    { label: 'New Session', click: () => mainWindow?.show() },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit()
      },
    },
  ])
  tray.setContextMenu(contextMenu)

  tray.on('click', () => {
    mainWindow?.show()
  })
}

function resolveWorkingDirectory(): string {
  const configured = getConfigValue('workingDirectory')
  return typeof configured === 'string' && configured ? configured : process.cwd()
}

// Provider IPC handlers
ipcMain.handle('providers:catalog', async () => {
  return { success: true, data: getProviderCatalog() }
})

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
  return { success: true, data: await testConnection(config) }
})

ipcMain.handle('providers:discoverModels', async (_event, config) => {
  return { success: true, data: await discoverModels(config) }
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

// Agent streaming IPC handlers
ipcMain.handle(
  IPC_CHANNELS.CHAT_SEND,
  async (
    _event,
    payload: {
      text: string
      sessionId?: string
      sessionPath?: string
      modelId?: string
      thinkingLevel?: string
    },
  ) => {
    const cwd = resolveWorkingDirectory()
    const sessionDetail = payload.sessionPath ? await openPiSession(payload.sessionPath) : await createPiSession(cwd)
    const sessionId = sessionDetail.sessionId
    const sessionPath = sessionDetail.sessionPath
    const createdNewSession = !payload.sessionPath

    saveActiveSessionId(sessionId)

    if (mainWindow) {
      ;(async () => {
        try {
          await piBridge.sendMessage(
            sessionId,
            sessionPath,
            payload.text,
            payload.modelId,
            payload.thinkingLevel,
            (event) => {
              if (event.type === 'assistant_token') {
                mainWindow?.webContents.send(IPC_CHANNELS.AGENT_EVENT, {
                  type: 'token',
                  text: event.text,
                  sessionId,
                  sessionPath,
                })
              } else if (event.type === 'assistant_message') {
                void openPiSession(sessionPath)
                  .then((detail) => {
                    mainWindow?.webContents.send(IPC_CHANNELS.AGENT_EVENT, {
                      type: 'done',
                      sessionId,
                      sessionPath,
                      session: detail,
                    })
                  })
                  .catch((error: unknown) => {
                    mainWindow?.webContents.send(IPC_CHANNELS.AGENT_EVENT, {
                      type: 'error',
                      error: error instanceof Error ? error.message : 'Failed to refresh Pi session',
                      sessionId,
                      sessionPath,
                    })
                  })
              } else if (event.type === 'tool_started') {
                mainWindow?.webContents.send(IPC_CHANNELS.AGENT_EVENT, {
                  type: 'tool_started',
                  toolName: event.toolName,
                  args: event.args,
                  sessionId,
                  sessionPath,
                })
              } else if (event.type === 'tool_finished') {
                mainWindow?.webContents.send(IPC_CHANNELS.AGENT_EVENT, {
                  type: 'tool_finished',
                  toolName: event.toolName,
                  sessionId,
                  sessionPath,
                })
              } else if (event.type === 'artifact_created') {
                mainWindow?.webContents.send(IPC_CHANNELS.AGENT_EVENT, {
                  type: 'artifact_created',
                  path: event.path,
                  sessionId,
                  sessionPath,
                })
              } else if (event.type === 'tool_failed' || event.type === 'run_failed') {
                mainWindow?.webContents.send(IPC_CHANNELS.AGENT_EVENT, {
                  type: 'error',
                  error: event.error || `${event.toolName || 'Pi'} failed`,
                  sessionId,
                  sessionPath,
                })
              } else if (event.type === 'run_aborted') {
                mainWindow?.webContents.send(IPC_CHANNELS.AGENT_EVENT, {
                  type: 'error',
                  error: 'Run aborted',
                  sessionId,
                  sessionPath,
                })
              }
            },
          )
        } catch (err) {
          mainWindow?.webContents.send(IPC_CHANNELS.AGENT_EVENT, {
            type: 'error',
            error: err instanceof Error ? err.message : 'Unknown error',
            sessionId,
            sessionPath,
          })
        }
      })()
    }

    return { success: true, data: { sessionId, sessionPath, createdNewSession } }
  },
)

ipcMain.handle(IPC_CHANNELS.CHAT_ABORT, async (_event, sessionPath?: string) => {
  await piBridge.abort(sessionPath || '', (event) => {
    if (event.type === 'run_aborted') {
      mainWindow?.webContents.send(IPC_CHANNELS.AGENT_EVENT, {
        type: 'error',
        error: 'Run aborted',
        sessionPath: sessionPath || '',
      })
    }
  })
  return { success: true }
})

ipcMain.handle(IPC_CHANNELS.CONFIG_GET, async (_event, key: string) => {
  return { success: true, data: getConfigValue(key) }
})

ipcMain.handle(IPC_CHANNELS.CONFIG_SET, async (_event, key: string, value: unknown) => {
  setConfigValue(key, value as string | number | boolean | null)
  return { success: true }
})

// Session IPC handlers
ipcMain.handle(IPC_CHANNELS.SESSION_LIST, async () => {
  return { success: true, data: await listPiSessions() }
})

ipcMain.handle(IPC_CHANNELS.SESSION_CREATE, async () => {
  const session = await createPiSession(resolveWorkingDirectory())
  saveActiveSessionId(session.sessionId)

  return {
    success: true,
    data: {
      id: session.sessionId,
      path: session.sessionPath,
      cwd: session.cwd,
      title: session.title,
      source: 'pi',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  }
})

ipcMain.handle(IPC_CHANNELS.SESSION_DELETE, async () => {
  return { success: true, data: false }
})

ipcMain.handle(IPC_CHANNELS.SESSION_SEARCH, async (_event, query: string) => {
  const sessions = await listPiSessions()
  return {
    success: true,
    data: sessions
      .filter((session) => session.title.toLowerCase().includes(query.toLowerCase()))
      .map((session) => ({
        id: session.id,
        title: session.title,
        updatedAt: session.updatedAt,
      })),
  }
})

ipcMain.handle(IPC_CHANNELS.SESSION_SWITCH, async (_event, sessionPath: string) => {
  const session = await openPiSession(sessionPath)
  saveActiveSessionId(session.sessionId)
  return { success: true, data: session }
})

ipcMain.handle(
  'session:updateRuntime',
  async (
    _event,
    payload: {
      sessionPath: string
      modelId?: string
      thinkingLevel?: string
    },
  ) => {
    try {
      const session = await updatePiSessionRuntime(payload.sessionPath, {
        modelKey: payload.modelId,
        thinkingLevel: payload.thinkingLevel,
      })
      return { success: true, data: session }
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update Pi session runtime',
      }
    }
  },
)

ipcMain.handle('session:getActive', async () => {
  return { success: true, data: getActiveSessionId() }
})

ipcMain.handle('desktop:getStateSummary', async () => {
  return { success: true, data: getDesktopStateSummary() }
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
            modifiedAt: st.mtime.toISOString(),
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
      '.md',
      '.txt',
      '.ts',
      '.tsx',
      '.js',
      '.py',
      '.go',
      '.rs',
      '.json',
      '.css',
      '.html',
      '.yaml',
      '.xml',
      '.sh',
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

ipcMain.handle('files:watch', async (_event, filePath: string) => {
  try {
    if (!existsSync(filePath)) return { success: false, error: 'File not found' }
    if (fileWatchers.has(filePath)) return { success: true }

    const watcher = watch(filePath, (eventType) => {
      if (eventType === 'change') {
        mainWindow?.webContents.send('files:changed', filePath)
      }
    })
    fileWatchers.set(filePath, watcher)
    return { success: true }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
})

ipcMain.handle('files:unwatch', async (_event, filePath: string) => {
  const watcher = fileWatchers.get(filePath)
  if (watcher) {
    watcher.close()
    fileWatchers.delete(filePath)
  }
  return { success: true }
})

app.on('web-contents-created', (_, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })
})

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

  globalShortcut.register('Alt+Shift+Space', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide()
    } else {
      mainWindow?.show()
    }
  })

  ensureSessionsDir()
  void initDatabase()

  createWindow()
  if (mainWindow) {
    optimizer.watchWindowShortcuts(mainWindow)
  }
  createTray()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (mainWindow) {
    mainWindow.hide()
  }
})

app.on('before-quit', () => {
  void piBridge.dispose()
  closeDatabase()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})
