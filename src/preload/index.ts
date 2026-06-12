import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/constants'
import type { PiDesktopApi } from './api'

const api: PiDesktopApi = {
  chat: {
    send: (payload) => ipcRenderer.invoke(IPC_CHANNELS.CHAT_SEND, payload),
    abort: (sessionPath?: string) => ipcRenderer.invoke(IPC_CHANNELS.CHAT_ABORT, sessionPath),
  },
  config: {
    get: (key: string) => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_GET, key),
    set: (key: string, value: unknown) => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_SET, key, value)
  },
  session: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.SESSION_LIST),
    create: (payload) => ipcRenderer.invoke(IPC_CHANNELS.SESSION_CREATE, payload),
    delete: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.SESSION_DELETE, id),
    search: (query: string) => ipcRenderer.invoke(IPC_CHANNELS.SESSION_SEARCH, query),
    switch: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.SESSION_SWITCH, id),
    updateRuntime: (payload) => ipcRenderer.invoke('session:updateRuntime', payload),
    getActive: () => ipcRenderer.invoke('session:getActive'),
  },
  onAgentEvent: (callback) => {
    const handler = (_event: unknown, data: unknown) => callback(data)
    ipcRenderer.on(IPC_CHANNELS.AGENT_EVENT, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.AGENT_EVENT, handler)
  },
  providers: {
    catalog: () => ipcRenderer.invoke('providers:catalog'),
    list: () => ipcRenderer.invoke('providers:list'),
    add: (config, apiKey) => ipcRenderer.invoke('providers:add', config, apiKey),
    update: (id, updates) => ipcRenderer.invoke('providers:update', id, updates),
    delete: (id) => ipcRenderer.invoke('providers:delete', id),
    test: (config) => ipcRenderer.invoke('providers:test', config),
    discoverModels: (config) => ipcRenderer.invoke('providers:discoverModels', config),
  },
  desktop: {
    getStateSummary: () => ipcRenderer.invoke('desktop:getStateSummary'),
    getEnvironmentStatus: () => ipcRenderer.invoke(IPC_CHANNELS.DESKTOP_ENVIRONMENT),
    getPdfAssetBaseUrl: () => ipcRenderer.invoke(IPC_CHANNELS.DESKTOP_PDF_ASSET_BASE_URL),
    getReleaseDiagnostics: () => ipcRenderer.invoke(IPC_CHANNELS.DESKTOP_RELEASE_DIAGNOSTICS),
    getPiResources: (cwd, sessionPath) => ipcRenderer.invoke(IPC_CHANNELS.DESKTOP_PI_RESOURCES, { cwd, sessionPath }),
    getSlashCommands: (cwd, sessionPath) => ipcRenderer.invoke(IPC_CHANNELS.DESKTOP_SLASH_COMMANDS, { cwd, sessionPath }),
  },
  piRuntime: {
    getState: (sessionPath) => ipcRenderer.invoke(IPC_CHANNELS.PI_RUNTIME_GET_STATE, sessionPath),
    getTools: (sessionPath) => ipcRenderer.invoke(IPC_CHANNELS.PI_RUNTIME_GET_TOOLS, sessionPath),
    setTools: (payload) => ipcRenderer.invoke(IPC_CHANNELS.PI_RUNTIME_SET_TOOLS, payload),
    compact: (payload) => ipcRenderer.invoke(IPC_CHANNELS.PI_RUNTIME_COMPACT, payload),
    reloadResources: (payload) => ipcRenderer.invoke(IPC_CHANNELS.PI_RUNTIME_RELOAD_RESOURCES, payload),
    cloneSession: (payload) => ipcRenderer.invoke(IPC_CHANNELS.PI_RUNTIME_CLONE_SESSION, payload),
    trustProject: (payload) => ipcRenderer.invoke(IPC_CHANNELS.PI_RUNTIME_TRUST_PROJECT, payload),
    getProjectTrustStatus: (payload) => ipcRenderer.invoke(IPC_CHANNELS.PI_RUNTIME_GET_PROJECT_TRUST_STATUS, payload),
    steer: (payload) => ipcRenderer.invoke(IPC_CHANNELS.PI_RUNTIME_STEER, payload),
    followUp: (payload) => ipcRenderer.invoke(IPC_CHANNELS.PI_RUNTIME_FOLLOW_UP, payload),
  },
  skills: {
    getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.SKILLS_GET_SETTINGS),
    search: (payload) => ipcRenderer.invoke(IPC_CHANNELS.SKILLS_SEARCH, payload),
    install: (payload) => ipcRenderer.invoke(IPC_CHANNELS.SKILLS_INSTALL, payload),
    setAdditionalPaths: (payload) => ipcRenderer.invoke(IPC_CHANNELS.SKILLS_SET_ADDITIONAL_PATHS, payload),
    setDisabled: (payload) => ipcRenderer.invoke(IPC_CHANNELS.SKILLS_SET_DISABLED, payload),
    setModelInvocation: (payload) => ipcRenderer.invoke(IPC_CHANNELS.SKILLS_SET_MODEL_INVOCATION, payload),
  },
  shell: {
    openExternal: (url) => ipcRenderer.invoke(IPC_CHANNELS.SHELL_OPEN_EXTERNAL, url),
  },
  profiles: {
    list: () => ipcRenderer.invoke('profiles:list'),
    create: (name) => ipcRenderer.invoke('profiles:create', name),
    delete: (id) => ipcRenderer.invoke('profiles:delete', id),
    getActive: () => ipcRenderer.invoke('profiles:getActive'),
    switch: (id) => ipcRenderer.invoke('profiles:switch', id)
  },
  files: {
    list: (dirPath) => ipcRenderer.invoke('files:list', dirPath),
    read: (filePath) => ipcRenderer.invoke('files:read', filePath),
    save: (filePath, content) => ipcRenderer.invoke('files:save', filePath, content),
    open: (filePath) => ipcRenderer.invoke('files:open', filePath),
    pickDirectory: (startPath) => ipcRenderer.invoke('files:pickDirectory', startPath),
  },
  artifacts: {
    list: (sessionId) => ipcRenderer.invoke('artifacts:list', sessionId),
    get: (artifactId) => ipcRenderer.invoke('artifacts:get', artifactId),
    history: (artifactId) => ipcRenderer.invoke('artifacts:history', artifactId),
    refresh: (artifactId) => ipcRenderer.invoke('artifacts:refresh', artifactId),
    pin: (artifactId, pinned) => ipcRenderer.invoke('artifacts:pin', artifactId, pinned),
    markPrimary: (artifactId) => ipcRenderer.invoke('artifacts:markPrimary', artifactId),
    view: (payload) => ipcRenderer.invoke('artifacts:view', payload),
  }
}

contextBridge.exposeInMainWorld('piDesktop', api)
