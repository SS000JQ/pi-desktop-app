/// <reference types="vite/client" />

import type {
  AgentEvent,
  ProviderCatalogEntry,
  ProviderConnectionResult,
  ProviderModel,
  ProviderSummary,
} from './types/chat'

interface IpcResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

interface SessionInfo {
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

interface SessionSearchResult {
  id: string
  title: string
  updatedAt: string
}

interface ProviderUpsertInput {
  providerId: string
  displayName: string
  kind: 'builtin' | 'custom'
  authType: 'apiKey' | 'oauth' | 'none'
  apiType: 'openai-completions' | 'openai-responses' | 'anthropic-messages' | 'google-generative-ai'
  baseUrl: string
  headers?: Record<string, string>
  authHeader?: string
  compat?: Record<string, unknown>
  models: ProviderModel[]
  isDefault: boolean
}

type ArtifactStatus = 'draft' | 'ready' | 'failed' | 'refreshing'
type ArtifactType = 'report' | 'summary' | 'table' | 'slides' | 'tracker' | 'brief' | 'file'
type ArtifactSourceKind = 'local_file' | 'pi_generated' | 'manual'

interface ArtifactVersion {
  id: string
  artifactId: string
  createdAt: string
  summary: string
  sourcePath?: string
  snapshot?: string
}

interface ArtifactEntity {
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

interface PiDesktopApi {
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
    list: () => Promise<IpcResponse<ProviderSummary[]>>
    add: (config: ProviderUpsertInput, apiKey?: string) => Promise<IpcResponse<ProviderSummary>>
    update: (id: string, updates: Partial<ProviderUpsertInput> & { apiKey?: string }) => Promise<IpcResponse<ProviderSummary | null>>
    delete: (id: string) => Promise<IpcResponse<boolean>>
    test: (config: {
      providerId?: string
      displayName?: string
      baseUrl: string
      apiKey?: string
      apiType?: 'openai-completions' | 'openai-responses' | 'anthropic-messages' | 'google-generative-ai'
    }) => Promise<IpcResponse<ProviderConnectionResult>>
    discoverModels: (config: {
      providerId?: string
      displayName?: string
      baseUrl: string
      apiType?: 'openai-completions' | 'openai-responses' | 'anthropic-messages' | 'google-generative-ai'
    }) => Promise<IpcResponse<ProviderModel[]>>
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
  onAgentEvent: (callback: (event: AgentEvent) => void) => () => void
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
  artifacts: {
    list: (sessionId?: string) => Promise<IpcResponse<ArtifactEntity[]>>
    get: (artifactId: string) => Promise<IpcResponse<ArtifactEntity | null>>
    history: (artifactId: string) => Promise<IpcResponse<ArtifactVersion[]>>
    refresh: (artifactId: string) => Promise<IpcResponse<ArtifactEntity | null>>
    pin: (artifactId: string, pinned: boolean) => Promise<IpcResponse<ArtifactEntity | null>>
    markPrimary: (artifactId: string) => Promise<IpcResponse<ArtifactEntity | null>>
  }
}

declare global {
  interface Window {
    piDesktop: PiDesktopApi
  }
}
