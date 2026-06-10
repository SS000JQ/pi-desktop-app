import { app, BrowserWindow, ipcMain, shell, Tray, Menu, globalShortcut, nativeImage, dialog } from 'electron'
import { join, extname } from 'path'
import { readFileSync, readdirSync, statSync, writeFileSync, watch, existsSync, mkdirSync } from 'fs'
import { randomUUID } from 'crypto'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { homedir } from 'os'
import { openInExternalEditor } from './file-bridge'
import { readPreviewFile } from './file-preview'
import { resolveOptionalExistingDirectory, resolveRuntimeDirectory } from './path-utils'
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
  buildEnvironmentStatus,
  checkGitRepository,
  checkGitVersion,
  sourceReleaseReady,
} from './environment'
import { loadPiCodingAgentModule } from './pi-sdk'
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
import {
  artifactHistory,
  getArtifact,
  listArtifacts,
  markArtifactPrimary,
  pinArtifact,
  recordManualArtifactView,
  recordArtifactFailure,
  refreshArtifact,
  upsertArtifactFromPath,
} from './artifacts'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
const fileWatchers = new Map<string, import('fs').FSWatcher>()

type RuntimeStatusPayload = {
  type: 'status'
  status: 'idle' | 'preparing' | 'processing' | 'reading_file' | 'analyzing_web' | 'generating' | 'writing_file' | 'waiting' | 'completed' | 'failed'
  statusLabel: string
  lastAction?: string
  startedAt?: number
  elapsedMs?: number
  lastEventAt?: number
  terminalAt?: number
  isWaitingForUser: boolean
  isStalled?: boolean
  errorSummary?: string
  resultSummary?: string
  activeToolName?: string
  activeToolState?: 'running' | 'done' | 'failed'
  lastProgressMessage?: string
  runId?: string
  messageId?: string
  updatedAt?: number
  sessionId?: string
  sessionPath?: string
}

function emitRuntimeStatus(payload: Omit<RuntimeStatusPayload, 'type'>): void {
  mainWindow?.webContents.send(IPC_CHANNELS.AGENT_EVENT, {
    type: 'status',
    ...payload,
  })
}

function summarizeError(error: string): string {
  const normalized = error.toLowerCase()
  if (normalized.includes('api key') || normalized.includes('auth')) return 'Provider authentication failed'
  if (normalized.includes('model')) return 'Selected model is unavailable'
  if (normalized.includes('network') || normalized.includes('fetch')) return 'Network request failed'
  if (normalized.includes('session')) return 'Pi session could not be updated'
  return error
}

function buildToolStatus(
  toolName?: string,
  args?: unknown,
): Pick<RuntimeStatusPayload, 'status' | 'statusLabel' | 'lastAction' | 'isWaitingForUser'> {
  const name = (toolName || '').toLowerCase()
  const argText = typeof args === 'string' ? args : JSON.stringify(args || {}).toLowerCase()
  const combined = `${name} ${argText}`

  if (combined.includes('confirm') || combined.includes('approval') || combined.includes('consent')) {
    return {
      status: 'waiting',
      statusLabel: 'Waiting for confirmation',
      lastAction: toolName ? `Waiting for confirmation: ${toolName}` : 'Waiting for your confirmation',
      isWaitingForUser: true,
    }
  }
  if (combined.includes('write') || combined.includes('save') || combined.includes('edit') || combined.includes('create')) {
    return {
      status: 'writing_file',
      statusLabel: 'Writing files',
      lastAction: toolName ? `Updating with ${toolName}` : 'Writing files',
      isWaitingForUser: false,
    }
  }
  if (combined.includes('read') || combined.includes('file') || combined.includes('glob') || combined.includes('grep')) {
    return {
      status: 'reading_file',
      statusLabel: 'Reading files',
      lastAction: toolName ? `Reading with ${toolName}` : 'Reading files',
      isWaitingForUser: false,
    }
  }
  if (combined.includes('web') || combined.includes('browser') || combined.includes('fetch') || combined.includes('open') || combined.includes('search')) {
    return {
      status: 'analyzing_web',
      statusLabel: 'Analyzing web content',
      lastAction: toolName ? `Processing with ${toolName}` : 'Analyzing web content',
      isWaitingForUser: false,
    }
  }

  return {
    status: 'processing',
    statusLabel: 'Processing',
    lastAction: toolName ? `Running ${toolName}` : 'Pi is processing your request',
    isWaitingForUser: false,
  }
}

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

function resolveWorkingDirectory(): string | null {
  const configured = getConfigValue('workingDirectory')
  return resolveOptionalExistingDirectory(typeof configured === 'string' ? configured : null)
}

function getBuiltinDefaultSessionDirectory(): string {
  return join(homedir(), 'Pi-Desktop-Session')
}

function resolveDefaultSessionDirectory(): string {
  const configured = getConfigValue('defaultSessionDirectory')
  const configuredPath = typeof configured === 'string' ? configured.trim() : ''
  return configuredPath || getBuiltinDefaultSessionDirectory()
}

function resolveRuntimeWorkingDirectory(path?: string): string {
  return resolveRuntimeDirectory(path, resolveWorkingDirectory() || resolveDefaultSessionDirectory())
}

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

ipcMain.handle(IPC_CHANNELS.DESKTOP_ENVIRONMENT, async () => {
  const workspacePath = resolveWorkingDirectory() || resolveDefaultSessionDirectory()
  return {
    success: true,
    data: await buildEnvironmentStatus({
      loadPiCore: loadPiCodingAgentModule,
      loadProviders,
      getConfigValue,
      getEffectiveDefaultSessionDirectory: resolveDefaultSessionDirectory,
      pathExists: existsSync,
      checkGitVersion,
      checkGitRepository,
      releaseReady: !is.dev || sourceReleaseReady(process.cwd()),
      workspacePath,
    }),
  }
})

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

ipcMain.handle(
  IPC_CHANNELS.CHAT_SEND,
  async (
    _event,
    payload: {
      text: string
      sessionId?: string
      sessionPath?: string
      cwd?: string
      modelId?: string
      thinkingLevel?: string
    },
  ) => {
    const cwd = resolveRuntimeWorkingDirectory(payload.cwd)
    let sessionDetail
    try {
      sessionDetail = payload.sessionPath ? await openPiSession(payload.sessionPath) : await createPiSession(cwd)
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open or create Pi session',
      }
    }
    const sessionId = sessionDetail.sessionId
    const sessionPath = sessionDetail.sessionPath
    const createdNewSession = !payload.sessionPath
    const runId = randomUUID()
    const toolCallIdsByName = new Map<string, string[]>()
    let toolCallSequence = 0

    const resolveToolCallId = (toolName?: string, upstreamId?: string): string => {
      if (upstreamId) return upstreamId
      const key = toolName || 'tool'
      const queue = toolCallIdsByName.get(key) || []
      const generated = `${runId}-tool-${++toolCallSequence}`
      queue.push(generated)
      toolCallIdsByName.set(key, queue)
      return generated
    }

    const finishToolCallId = (toolName?: string, upstreamId?: string): string => {
      if (upstreamId) return upstreamId
      const key = toolName || 'tool'
      const queue = toolCallIdsByName.get(key) || []
      const next = queue.shift()
      toolCallIdsByName.set(key, queue)
      return next || `${runId}-tool-${++toolCallSequence}`
    }

    saveActiveSessionId(sessionId, sessionPath)

    if (mainWindow) {
      ;(async () => {
        try {
          let hasFinished = false
          const completeRun = (resultSummary: string): void => {
            if (hasFinished) return
            hasFinished = true
            const completedAt = Date.now()
            emitRuntimeStatus({
              status: 'completed',
              statusLabel: 'Completed',
              lastAction: 'Response finished',
              isWaitingForUser: false,
              resultSummary,
              updatedAt: completedAt,
              lastEventAt: completedAt,
              terminalAt: completedAt,
              runId,
              sessionId,
              sessionPath,
            })
            void openPiSession(sessionPath)
              .then((detail) => {
                mainWindow?.webContents.send(IPC_CHANNELS.AGENT_EVENT, {
                  type: 'done',
                  runId,
                  sessionId,
                  sessionPath,
                  session: detail,
                })
              })
              .catch((error: unknown) => {
                mainWindow?.webContents.send(IPC_CHANNELS.AGENT_EVENT, {
                  type: 'error',
                  error: error instanceof Error ? error.message : 'Failed to refresh Pi session',
                  runId,
                  sessionId,
                  sessionPath,
                })
              })
          }

          emitRuntimeStatus({
            status: 'preparing',
            statusLabel: 'Preparing',
            lastAction: createdNewSession ? 'Creating a new Pi session' : 'Connecting to the current Pi session',
            isWaitingForUser: false,
            startedAt: Date.now(),
            updatedAt: Date.now(),
            lastEventAt: Date.now(),
            runId,
            sessionId,
            sessionPath,
          })

          await piBridge.sendMessage(
            sessionId,
            sessionPath,
            payload.text,
            payload.modelId,
            payload.thinkingLevel,
            (event) => {
              if (event.type === 'run_started') {
                const updatedAt = Date.now()
                emitRuntimeStatus({
                  status: 'processing',
                  statusLabel: 'Processing',
                  lastAction: 'Pi has started working on your request',
                  isWaitingForUser: false,
                  updatedAt,
                  lastEventAt: updatedAt,
                  runId,
                  sessionId,
                  sessionPath,
                })
              } else if (event.type === 'assistant_token') {
                const updatedAt = Date.now()
                emitRuntimeStatus({
                  status: 'generating',
                  statusLabel: 'Generating content',
                  lastAction: 'Drafting the response',
                  isWaitingForUser: false,
                  updatedAt,
                  lastEventAt: updatedAt,
                  runId,
                  sessionId,
                  sessionPath,
                })
                mainWindow?.webContents.send(IPC_CHANNELS.AGENT_EVENT, {
                  type: 'token',
                  text: event.text,
                  runId,
                  sessionId,
                  sessionPath,
                })
              } else if (event.type === 'assistant_thinking') {
                const updatedAt = Date.now()
                emitRuntimeStatus({
                  status: 'processing',
                  statusLabel: 'Thinking',
                  lastAction: 'Pi is reasoning through the request',
                  isWaitingForUser: false,
                  updatedAt,
                  lastEventAt: updatedAt,
                  runId,
                  sessionId,
                  sessionPath,
                })
                mainWindow?.webContents.send(IPC_CHANNELS.AGENT_EVENT, {
                  type: 'thinking_delta',
                  text: event.text,
                  runId,
                  sessionId,
                  sessionPath,
                })
              } else if (event.type === 'assistant_message') {
                const updatedAt = Date.now()
                emitRuntimeStatus({
                  status: 'generating',
                  statusLabel: 'Generating content',
                  lastAction: 'Final response ready, syncing session',
                  isWaitingForUser: false,
                  updatedAt,
                  lastEventAt: updatedAt,
                  runId,
                  sessionId,
                  sessionPath,
                })
              } else if (event.type === 'tool_started') {
                const toolCallId = resolveToolCallId(event.toolName, 'toolCallId' in event ? String(event.toolCallId || '') : undefined)
                const updatedAt = Date.now()
                emitRuntimeStatus({
                  ...buildToolStatus(event.toolName, event.args),
                  updatedAt,
                  lastEventAt: updatedAt,
                  activeToolName: event.toolName,
                  activeToolState: 'running',
                  runId,
                  sessionId,
                  sessionPath,
                })
                mainWindow?.webContents.send(IPC_CHANNELS.AGENT_EVENT, {
                  type: 'tool_started',
                  toolName: event.toolName,
                  toolCallId,
                  args: event.args,
                  runId,
                  sessionId,
                  sessionPath,
                })
              } else if (event.type === 'tool_finished') {
                const toolCallId = finishToolCallId(event.toolName, 'toolCallId' in event ? String(event.toolCallId || '') : undefined)
                const updatedAt = Date.now()
                emitRuntimeStatus({
                  status: 'processing',
                  statusLabel: 'Processing',
                  lastAction: event.toolName ? `${event.toolName} finished, continuing` : 'Tool finished, continuing',
                  isWaitingForUser: false,
                  updatedAt,
                  lastEventAt: updatedAt,
                  activeToolName: event.toolName,
                  activeToolState: 'done',
                  runId,
                  sessionId,
                  sessionPath,
                })
                mainWindow?.webContents.send(IPC_CHANNELS.AGENT_EVENT, {
                  type: 'tool_finished',
                  toolName: event.toolName,
                  toolCallId,
                  runId,
                  sessionId,
                  sessionPath,
                })
              } else if (event.type === 'artifact_created') {
                if (event.path) {
                  upsertArtifactFromPath({
                    sessionId,
                    sessionPath,
                    path: event.path,
                    status: 'ready',
                  })
                }
                const updatedAt = Date.now()
                emitRuntimeStatus({
                  status: 'writing_file',
                  statusLabel: 'Writing file',
                  lastAction: 'Created a new result file',
                  isWaitingForUser: false,
                  resultSummary: event.path ? `Created ${event.path.split(/[\\/]/).pop()}` : 'Created a new result',
                  updatedAt,
                  lastEventAt: updatedAt,
                  lastProgressMessage: event.path ? `Created ${event.path.split(/[\\/]/).pop()}` : 'Created a new result',
                  runId,
                  sessionId,
                  sessionPath,
                })
                mainWindow?.webContents.send(IPC_CHANNELS.AGENT_EVENT, {
                  type: 'artifact_created',
                  path: event.path,
                  runId,
                  sessionId,
                  sessionPath,
                })
              } else if (event.type === 'session_state_changed') {
                completeRun('Pi session synced')
              } else if (event.type === 'tool_failed') {
                const toolCallId = finishToolCallId(event.toolName, 'toolCallId' in event ? String(event.toolCallId || '') : undefined)
                const updatedAt = Date.now()
                emitRuntimeStatus({
                  status: 'processing',
                  statusLabel: 'Processing',
                  lastAction: event.toolName ? `${event.toolName} failed, continuing` : 'Tool failed, continuing',
                  isWaitingForUser: false,
                  errorSummary: summarizeError(event.error || `${event.toolName || 'Tool'} failed`),
                  updatedAt,
                  lastEventAt: updatedAt,
                  activeToolName: event.toolName,
                  activeToolState: 'failed',
                  runId,
                  sessionId,
                  sessionPath,
                })
                mainWindow?.webContents.send(IPC_CHANNELS.AGENT_EVENT, {
                  type: 'tool_failed',
                  toolName: event.toolName,
                  toolCallId,
                  error: event.error,
                  runId,
                  sessionId,
                  sessionPath,
                })
              } else if (event.type === 'run_failed') {
                const updatedAt = Date.now()
                emitRuntimeStatus({
                  status: 'failed',
                  statusLabel: 'Failed',
                  lastAction: 'Pi failed to complete the request',
                  isWaitingForUser: false,
                  errorSummary: summarizeError(event.error || 'Pi failed'),
                  updatedAt,
                  lastEventAt: updatedAt,
                  terminalAt: updatedAt,
                  runId,
                  sessionId,
                  sessionPath,
                })
                recordArtifactFailure({
                  sessionId,
                  sessionPath,
                  title: 'Failed run',
                  errorSummary: summarizeError(event.error || 'Pi failed'),
                })
                mainWindow?.webContents.send(IPC_CHANNELS.AGENT_EVENT, {
                  type: 'error',
                  error: event.error || 'Pi failed',
                  runId,
                  sessionId,
                  sessionPath,
                })
              } else if (event.type === 'run_aborted') {
                const updatedAt = Date.now()
                emitRuntimeStatus({
                  status: 'failed',
                  statusLabel: 'Stopped',
                  lastAction: 'Run was aborted',
                  isWaitingForUser: false,
                  errorSummary: 'Run aborted',
                  updatedAt,
                  lastEventAt: updatedAt,
                  terminalAt: updatedAt,
                  runId,
                  sessionId,
                  sessionPath,
                })
                mainWindow?.webContents.send(IPC_CHANNELS.AGENT_EVENT, {
                  type: 'error',
                  error: 'Run aborted',
                  runId,
                  sessionId,
                  sessionPath,
                })
              }
            },
          )
        } catch (err) {
          const updatedAt = Date.now()
          emitRuntimeStatus({
            status: 'failed',
            statusLabel: 'Failed',
            lastAction: 'Pi could not start this request',
            isWaitingForUser: false,
            errorSummary: summarizeError(err instanceof Error ? err.message : 'Unknown error'),
            updatedAt,
            lastEventAt: updatedAt,
            terminalAt: updatedAt,
            runId,
            sessionId,
            sessionPath,
          })
          mainWindow?.webContents.send(IPC_CHANNELS.AGENT_EVENT, {
            type: 'error',
            error: err instanceof Error ? err.message : 'Unknown error',
            runId,
            sessionId,
            sessionPath,
          })
        }
      })()
    }

    return { success: true, data: { sessionId, sessionPath, createdNewSession, runId } }
  },
)

ipcMain.handle(IPC_CHANNELS.CHAT_ABORT, async (_event, sessionPath?: string) => {
  await piBridge.abort(sessionPath || '', (event) => {
    if (event.type === 'run_aborted') {
      emitRuntimeStatus({
        status: 'failed',
        statusLabel: 'Stopped',
        lastAction: 'Run was aborted',
        isWaitingForUser: false,
        errorSummary: 'Run aborted',
        sessionPath: sessionPath || '',
      })
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
  if (key === 'defaultSessionDirectory') {
    return { success: true, data: resolveDefaultSessionDirectory() }
  }
  if (key === 'workingDirectory') {
    const value = getConfigValue(key)
    const resolved = resolveOptionalExistingDirectory(typeof value === 'string' ? value : null)
    if (resolved) {
      return { success: true, data: resolved }
    }
    if (typeof value === 'string' && value) {
      setConfigValue(key, null)
    }
    return { success: true, data: null }
  }
  return { success: true, data: getConfigValue(key) }
})

ipcMain.handle(IPC_CHANNELS.CONFIG_SET, async (_event, key: string, value: unknown) => {
  setConfigValue(key, value as string | number | boolean | null)
  return { success: true }
})

ipcMain.handle(IPC_CHANNELS.SESSION_LIST, async () => {
  return { success: true, data: await listPiSessions() }
})

ipcMain.handle(IPC_CHANNELS.SESSION_CREATE, async (_event, payload?: { cwd?: string }) => {
  try {
    const targetDir = payload?.cwd?.trim() || resolveDefaultSessionDirectory()
    if (!targetDir) {
      return { success: false, error: 'Session directory is required.' }
    }

    mkdirSync(targetDir, { recursive: true })
    const session = await createPiSession(targetDir)
    saveActiveSessionId(session.sessionId, session.sessionPath)

    return {
      success: true,
      data: {
        id: session.sessionId,
        path: session.sessionPath,
        sessionId: session.sessionId,
        sessionPath: session.sessionPath,
        cwd: session.cwd,
        title: session.title,
        messages: session.messages,
        model: session.model,
        thinkingLevel: session.thinkingLevel,
        tokenCount: session.tokenCount,
        source: 'pi',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create a new session.',
    }
  }
})

ipcMain.handle(IPC_CHANNELS.SESSION_DELETE, async () => {
  return { success: false, error: 'Deleting Pi native sessions is not implemented yet' }
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
  saveActiveSessionId(session.sessionId, session.sessionPath)
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

ipcMain.handle('artifacts:list', async (_event, sessionKey?: string) => {
  return { success: true, data: listArtifacts(sessionKey) }
})

ipcMain.handle('artifacts:get', async (_event, artifactId: string) => {
  return { success: true, data: getArtifact(artifactId) }
})

ipcMain.handle('artifacts:history', async (_event, artifactId: string) => {
  return { success: true, data: artifactHistory(artifactId) }
})

ipcMain.handle('artifacts:refresh', async (_event, artifactId: string) => {
  return { success: true, data: refreshArtifact(artifactId) }
})

ipcMain.handle('artifacts:pin', async (_event, artifactId: string, pinned: boolean) => {
  return { success: true, data: pinArtifact(artifactId, pinned) }
})

ipcMain.handle('artifacts:markPrimary', async (_event, artifactId: string) => {
  return { success: true, data: markArtifactPrimary(artifactId) }
})

ipcMain.handle('artifacts:view', async (_event, payload: { sessionId: string; sessionPath?: string; path: string }) => {
  return { success: true, data: recordManualArtifactView(payload) }
})

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
    return { success: true, data: await readPreviewFile(filePath) }
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
  try {
    await openInExternalEditor(filePath)
    return { success: true }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
})

ipcMain.handle('files:pickDirectory', async (_event, startPath?: string) => {
  const dialogOptions = {
    title: 'Choose a folder',
    defaultPath: startPath && existsSync(startPath) ? startPath : undefined,
    properties: ['openDirectory', 'createDirectory'] as Array<'openDirectory' | 'createDirectory'>,
  }

  const result = mainWindow
    ? await dialog.showOpenDialog(mainWindow, dialogOptions)
    : await dialog.showOpenDialog(dialogOptions)

  if (result.canceled || result.filePaths.length === 0) {
    return { success: true, data: null }
  }

  return { success: true, data: result.filePaths[0] }
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
