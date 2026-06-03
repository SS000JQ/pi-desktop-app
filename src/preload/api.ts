import { IPC_CHANNELS } from '../shared/constants'

export interface IpcResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

export interface SessionInfo {
  id: string
  title: string
  model: string | null
  tokenCount: number
  createdAt: string
  updatedAt: string
}

export interface SessionSearchResult {
  id: string
  title: string
  updatedAt: string
}

export interface PiDesktopApi {
  chat: {
    send: (text: string, modelId?: string) => Promise<IpcResponse>
    abort: (sessionId?: string) => Promise<IpcResponse>
  }
  config: {
    get: (key: string) => Promise<IpcResponse>
    set: (key: string, value: unknown) => Promise<IpcResponse>
  }
  session: {
    list: () => Promise<IpcResponse<SessionInfo[]>>
    create: () => Promise<IpcResponse<{ id: string }>>
    delete: (id: string) => Promise<IpcResponse>
    search: (query: string) => Promise<IpcResponse<SessionSearchResult[]>>
    switch: (id: string) => Promise<IpcResponse<{ messages: unknown[] }>>
  }
  providers: {
    list: () => Promise<IpcResponse>
    add: (
      config: {
        name: string
        baseUrl: string
        models: string[]
        isDefault: boolean
      },
      apiKey?: string
    ) => Promise<IpcResponse>
    update: (id: string, updates: Record<string, unknown>) => Promise<IpcResponse>
    delete: (id: string) => Promise<IpcResponse>
    test: (config: { baseUrl: string; apiKey: string }) => Promise<IpcResponse>
  }
  onAgentEvent: (callback: (event: unknown) => void) => () => void
  profiles: {
    list: () => Promise<IpcResponse>
    create: (name: string) => Promise<IpcResponse>
    delete: (id: string) => Promise<IpcResponse>
    getActive: () => Promise<IpcResponse>
    switch: (id: string) => Promise<IpcResponse>
  }
  files: {
    list: (dirPath: string) => Promise<IpcResponse>
    read: (filePath: string) => Promise<IpcResponse>
    save: (filePath: string, content: string) => Promise<IpcResponse>
    open: (filePath: string) => Promise<IpcResponse>
  }
}
