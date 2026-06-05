import { IPC_CHANNELS } from '../shared/constants'

export interface IpcResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

export interface SessionInfo {
  id: string
  path: string
  cwd: string
  title: string
  model: string | null
  tokenCount: number
  messageCount: number
  source: 'pi'
  createdAt: string
  updatedAt: string
}

export interface SessionSearchResult {
  id: string
  title: string
  updatedAt: string
}

export type ProviderAuthType = 'apiKey' | 'oauth' | 'none'
export type ProviderApiType =
  | 'openai-completions'
  | 'openai-responses'
  | 'anthropic-messages'
  | 'google-generative-ai'

export interface ProviderModelConfig {
  id: string
  name: string
  providerId: string
  runtimeKey: string
  input: string[]
  reasoning: boolean
  isDefault: boolean
}

export interface ProviderCatalogEntry {
  providerId: string
  displayName: string
  apiType: ProviderApiType
  authType: ProviderAuthType
  baseUrl: string
  allowCustomBaseUrl: boolean
}

export interface ProviderConfig {
  id: string
  providerId: string
  displayName: string
  kind: 'builtin' | 'custom'
  hasAuth: boolean
  authType: ProviderAuthType
  apiType: ProviderApiType
  baseUrl: string
  headers?: Record<string, string>
  authHeader?: string
  compat?: Record<string, unknown>
  models: ProviderModelConfig[]
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export interface ProviderConnectionResult {
  success: boolean
  message?: string
  error?: string
  detectedModels?: ProviderModelConfig[]
}

export interface ProviderUpsertInput {
  providerId: string
  displayName: string
  kind: 'builtin' | 'custom'
  authType: ProviderAuthType
  apiType: ProviderApiType
  baseUrl: string
  headers?: Record<string, string>
  authHeader?: string
  compat?: Record<string, unknown>
  models: ProviderModelConfig[]
  isDefault: boolean
}

export interface PiDesktopApi {
  chat: {
    send: (payload: {
      text: string
      modelId?: string
      sessionId?: string
      sessionPath?: string
      thinkingLevel?: string
    }) => Promise<IpcResponse<{
      sessionId: string
      sessionPath: string
      createdNewSession: boolean
    }>>
    abort: (sessionPath?: string) => Promise<IpcResponse>
  }
  config: {
    get: (key: string) => Promise<IpcResponse>
    set: (key: string, value: unknown) => Promise<IpcResponse>
  }
  session: {
    list: () => Promise<IpcResponse<SessionInfo[]>>
    create: () => Promise<IpcResponse<{
      id: string
      path: string
      cwd: string
      title: string
      source: 'pi'
      createdAt: string
      updatedAt: string
    }>>
    delete: (id: string) => Promise<IpcResponse>
    search: (query: string) => Promise<IpcResponse<SessionSearchResult[]>>
    switch: (sessionPath: string) => Promise<IpcResponse<{
      sessionId: string
      sessionPath: string
      cwd: string
      title: string
      messages: unknown[]
      model: string | null
      thinkingLevel: string
      tokenCount: number
    }>>
    updateRuntime: (payload: {
      sessionPath: string
      modelId?: string
      thinkingLevel?: string
    }) => Promise<IpcResponse<{
      sessionId: string
      sessionPath: string
      cwd: string
      title: string
      messages: unknown[]
      model: string | null
      thinkingLevel: string
      tokenCount: number
    }>>
    getActive: () => Promise<IpcResponse<string | null>>
  }
  providers: {
    catalog: () => Promise<IpcResponse<ProviderCatalogEntry[]>>
    list: () => Promise<IpcResponse<ProviderConfig[]>>
    add: (config: ProviderUpsertInput, apiKey?: string) => Promise<IpcResponse<ProviderConfig>>
    update: (id: string, updates: Partial<ProviderUpsertInput> & { apiKey?: string }) => Promise<IpcResponse<ProviderConfig | null>>
    delete: (id: string) => Promise<IpcResponse<boolean>>
    test: (config: {
      providerId?: string
      displayName?: string
      baseUrl: string
      apiKey?: string
      apiType?: ProviderApiType
    }) => Promise<IpcResponse<ProviderConnectionResult>>
    discoverModels: (config: {
      providerId?: string
      displayName?: string
      baseUrl: string
      apiType?: ProviderApiType
    }) => Promise<IpcResponse<ProviderModelConfig[]>>
  }
  desktop: {
    getStateSummary: () => Promise<IpcResponse<{
      memory: Array<{
        id: string
        label: string
        value: string
        source: string
      }>
      skills: Array<{
        id: string
        label: string
        value: string
        source: string
        status: 'active' | 'inactive'
      }>
    }>>
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

export { IPC_CHANNELS }
