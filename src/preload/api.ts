import { IPC_CHANNELS } from '../shared/constants'
import type { FilePreviewData } from '../shared/preview-types'

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

export type EnvironmentStatus = 'ok' | 'warning' | 'missing' | 'error'
export type EnvironmentActionKind = 'open_url' | 'copy_command' | 'open_settings' | 'choose_directory' | 'none'

export interface EnvironmentCheckItem {
  id: 'pi-core' | 'ai-provider' | 'default-workspace' | 'git' | 'git-repository' | 'release-readiness'
  label: string
  status: EnvironmentStatus
  summary: string
  detail?: string
  actionLabel?: string
  actionKind?: EnvironmentActionKind
  actionValue?: string
}

export interface EnvironmentCheckResult {
  overallStatus: EnvironmentStatus
  generatedAt: string
  items: EnvironmentCheckItem[]
}

export interface RuntimeToolInfo {
  name: string
  description: string
  active: boolean
  source?: string
}

export interface ProjectTrustStatus {
  cwd: string
  hasProjectResources: boolean
  trusted: boolean
  reason?: string
  trustFile?: string
}

export interface SkillSearchResult {
  packageName: string
  name: string
  installs?: string
  url?: string
  description?: string
}

export type PiSkillScope = 'pi_global' | 'shared_global' | 'project' | 'settings' | 'package' | 'other'

export interface SkillSettingsResult {
  additionalSkillPaths: string[]
  disabledSkillPaths: string[]
  suggestedSkillPaths: string[]
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
  sessionPath?: string
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

export interface PiDesktopApi {
  chat: {
    send: (payload: {
      text: string
      cwd?: string
      modelId?: string
      sessionId?: string
      sessionPath?: string
      thinkingLevel?: string
    }) => Promise<IpcResponse<{
      sessionId: string
      sessionPath: string
      createdNewSession: boolean
      runId: string
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
      sessionId?: string
      sessionPath?: string
      cwd: string
      title: string
      messages?: unknown[]
      model?: string | null
      thinkingLevel?: string
      tokenCount?: number
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
    getEnvironmentStatus: () => Promise<IpcResponse<EnvironmentCheckResult>>
    getPdfAssetBaseUrl: () => Promise<IpcResponse<string | null>>
    getReleaseDiagnostics: () => Promise<IpcResponse<string>>
    getPiResources: (cwd?: string, sessionPath?: string) => Promise<IpcResponse<{
      skills: Array<{
        name: string
        description: string
        source: string
        filePath: string
        baseDir: string
        scope: PiSkillScope
        sourceLabel: string
        disabled: boolean
        disableModelInvocation: boolean
        status: 'active' | 'inactive' | 'error'
        diagnostics?: string[]
      }>
      prompts: Array<{
        name: string
        description: string
        source: string
        argumentHint?: string
      }>
      extensions: Array<{
        name: string
        source: string
        status: 'active' | 'inactive' | 'error'
        diagnostics?: string[]
      }>
      extensionCommands: Array<{
        name: string
        description: string
        source: string
      }>
      diagnostics: string[]
      summary: {
        cwd: string | null
        agentDir: string | null
        totalSkills: number
        countsByScope: Record<PiSkillScope, number>
      }
      additionalSkillPaths: string[]
      disabledSkillPaths: string[]
    }>>
    getSlashCommands: (cwd?: string, sessionPath?: string) => Promise<IpcResponse<Array<{
      id: string
      command: string
      label: string
      description: string
      kind: 'desktop' | 'pi_runtime' | 'skill' | 'prompt' | 'extension' | 'context' | 'unsupported'
      source: string
      execution: 'desktop' | 'runtime' | 'prompt' | 'disabled'
      group?: 'Desktop' | 'Pi Runtime' | 'Skills' | 'Prompts' | 'Extensions' | 'Context' | 'Unsupported'
      argumentHint?: string
      requiresIdle?: boolean
      disabledReason?: string
    }>>>
  }
  piRuntime: {
    getState: (sessionPath?: string) => Promise<IpcResponse<{ sessionPath: string | null; active: boolean }>>
    getTools: (sessionPath: string) => Promise<IpcResponse<RuntimeToolInfo[]>>
    setTools: (payload: { sessionPath: string; toolNames: string[] }) => Promise<IpcResponse>
    compact: (payload: { sessionPath: string; customInstructions?: string }) => Promise<IpcResponse>
    reloadResources: (payload: { sessionPath: string }) => Promise<IpcResponse>
    cloneSession: (payload: { sessionPath: string }) => Promise<IpcResponse>
    trustProject: (payload: { cwd: string; trust: boolean }) => Promise<IpcResponse>
    getProjectTrustStatus: (payload: { cwd: string }) => Promise<IpcResponse<ProjectTrustStatus>>
    steer: (payload: { sessionPath: string; message: string; images?: unknown[] }) => Promise<IpcResponse>
    followUp: (payload: { sessionPath: string; message: string; images?: unknown[] }) => Promise<IpcResponse>
  }
  skills: {
    getSettings: () => Promise<IpcResponse<SkillSettingsResult>>
    search: (payload: { query: string; limit?: number }) => Promise<IpcResponse<SkillSearchResult[]>>
    install: (payload: { packageName: string; scope: 'global' | 'project'; cwd?: string }) => Promise<IpcResponse>
    setAdditionalPaths: (payload: { paths: string[] }) => Promise<IpcResponse<string[]>>
    setDisabled: (payload: { filePath: string; disabled: boolean }) => Promise<IpcResponse<string[]>>
    setModelInvocation: (payload: { filePath: string; disabled: boolean }) => Promise<IpcResponse>
  }
  shell: {
    openExternal: (url: string) => Promise<IpcResponse>
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
    pickDirectory: (startPath?: string) => Promise<IpcResponse<string | null>>
  }
  artifacts: {
    list: (sessionKey?: string) => Promise<IpcResponse<ArtifactEntity[]>>
    get: (artifactId: string) => Promise<IpcResponse<ArtifactEntity | null>>
    history: (artifactId: string) => Promise<IpcResponse<ArtifactVersion[]>>
    refresh: (artifactId: string) => Promise<IpcResponse<ArtifactEntity | null>>
    pin: (artifactId: string, pinned: boolean) => Promise<IpcResponse<ArtifactEntity | null>>
    markPrimary: (artifactId: string) => Promise<IpcResponse<ArtifactEntity | null>>
    view: (payload: { sessionId: string; sessionPath?: string; path: string }) => Promise<IpcResponse<ArtifactEntity | null>>
  }
}

export { IPC_CHANNELS }
