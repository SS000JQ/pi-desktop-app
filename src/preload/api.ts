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

export interface RuntimeStatusPayload {
  type: 'status'
  status: 'idle' | 'preparing' | 'processing' | 'reading_file' | 'analyzing_web' | 'generating' | 'writing_file' | 'waiting' | 'completed' | 'failed'
  statusLabel: string
  lastAction?: string
  startedAt?: number
  elapsedMs?: number
  isWaitingForUser: boolean
  isStalled?: boolean
  errorSummary?: string
  resultSummary?: string
  sessionId?: string
  sessionPath?: string
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

export type ArtifactStatus = 'draft' | 'ready' | 'failed' | 'refreshing'
export type ArtifactType = 'report' | 'summary' | 'table' | 'slides' | 'tracker' | 'brief' | 'file'
export type ArtifactSourceKind = 'local_file' | 'pi_generated' | 'manual'

export interface ArtifactVersion {
  id: string
  artifactId: string
  createdAt: string
  summary: string
  sourcePath?: string
  snapshot?: string
}

export interface ArtifactEntity {
  id: string
  sessionId: string
  title: string
  artifactType: ArtifactType
  sourceKind: ArtifactSourceKind
  status: ArtifactStatus
  createdAt: string
  updatedAt: string
  sourcePath?: string
  snapshot?: string
  metadata: {
    pinned?: boolean
    primary?: boolean
    actionLabel?: string
    errorSummary?: string
  }
  versions: ArtifactVersion[]
}

export type FilePreviewData =
  | { type: 'text'; content: string }
  | { type: 'image'; content: string }
  | { type: 'pdf'; content: string }
  | { type: 'docx'; content: string }
  | {
      type: 'pptx'
      slides: Array<{
        index: number
        title: string
        summary: string
      }>
    }
  | {
      type: 'xlsx'
      workbook: {
        sheetNames: string[]
        sheets: Array<{
          name: string
          rows: string[][]
        }>
      }
    }
  | { type: 'binary'; ext?: string; reason?: string }

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
    create: (payload?: { cwd?: string }) => Promise<IpcResponse<{
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
      connectors: Array<{
        id: string
        label: string
        value: string
        source: string
        status: 'active' | 'inactive'
      }>
    }>>
  }
  onAgentEvent: (callback: (event: unknown | RuntimeStatusPayload) => void) => () => void
  profiles: {
    list: () => Promise<IpcResponse>
    create: (name: string) => Promise<IpcResponse>
    delete: (id: string) => Promise<IpcResponse>
    getActive: () => Promise<IpcResponse>
    switch: (id: string) => Promise<IpcResponse>
  }
  files: {
    list: (dirPath: string) => Promise<IpcResponse>
    read: (filePath: string) => Promise<IpcResponse<FilePreviewData>>
    save: (filePath: string, content: string) => Promise<IpcResponse>
    open: (filePath: string) => Promise<IpcResponse>
  }
  artifacts: {
    list: (sessionId?: string) => Promise<IpcResponse<ArtifactEntity[]>>
    get: (artifactId: string) => Promise<IpcResponse<ArtifactEntity | null>>
    history: (artifactId: string) => Promise<IpcResponse<ArtifactVersion[]>>
    refresh: (artifactId: string) => Promise<IpcResponse<ArtifactEntity | null>>
    pin: (artifactId: string, pinned: boolean) => Promise<IpcResponse<ArtifactEntity | null>>
    markPrimary: (artifactId: string) => Promise<IpcResponse<ArtifactEntity | null>>
  }
}

export { IPC_CHANNELS }
