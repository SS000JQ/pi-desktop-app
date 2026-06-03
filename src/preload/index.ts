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
