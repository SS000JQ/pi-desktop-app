import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/constants'
import type { PiDesktopApi } from './api'

const api: PiDesktopApi = {
  chat: {
    send: (text: string) => ipcRenderer.invoke(IPC_CHANNELS.CHAT_SEND, { text })
  },
  config: {
    get: (key: string) => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_GET, key),
    set: (key: string, value: unknown) => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_SET, key, value)
  },
  session: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.SESSION_LIST),
    create: () => ipcRenderer.invoke(IPC_CHANNELS.SESSION_CREATE),
    delete: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.SESSION_DELETE, id),
    search: (query: string) => ipcRenderer.invoke(IPC_CHANNELS.SESSION_SEARCH, query),
    switch: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.SESSION_SWITCH, id)
  },
  onAgentEvent: (callback) => {
    const handler = (_event: unknown, data: unknown) => callback(data)
    ipcRenderer.on(IPC_CHANNELS.AGENT_EVENT, handler)
    return () => ipcRenderer.removeListener(IPC_CHANNELS.AGENT_EVENT, handler)
  },
  providers: {
    list: () => ipcRenderer.invoke('providers:list'),
    add: (config, apiKey) => ipcRenderer.invoke('providers:add', config, apiKey),
    update: (id, updates) => ipcRenderer.invoke('providers:update', id, updates),
    delete: (id) => ipcRenderer.invoke('providers:delete', id),
    test: (config) => ipcRenderer.invoke('providers:test', config)
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
    open: (filePath) => ipcRenderer.invoke('files:open', filePath)
  }
}

contextBridge.exposeInMainWorld('piDesktop', api)
