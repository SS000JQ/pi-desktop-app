export interface ToolCall {
  id: string
  name: string
  args: string
  status: 'running' | 'done' | 'error'
  duration?: string
}

export type RuntimePhase =
  | 'idle'
  | 'preparing'
  | 'processing'
  | 'reading_file'
  | 'analyzing_web'
  | 'generating'
  | 'writing_file'
  | 'waiting'
  | 'completed'
  | 'failed'

export interface RuntimeStatus {
  status: RuntimePhase
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

export type AgentEvent =
  | {
      type: 'token'
      text: string
      sessionId?: string
      sessionPath?: string
    }
  | {
      type: 'tool_started'
      toolName?: string
      args?: unknown
      sessionId?: string
      sessionPath?: string
    }
  | {
      type: 'tool_finished' | 'tool_failed'
      toolName?: string
      sessionId?: string
      sessionPath?: string
    }
  | {
      type: 'done'
      session?: {
        sessionId: string
        sessionPath: string
        cwd: string
        title: string
        messages: unknown[]
        model: string | null
        thinkingLevel: string
        tokenCount: number
      }
      sessionId?: string
      sessionPath?: string
    }
  | {
      type: 'artifact_created'
      path?: string
      sessionId?: string
      sessionPath?: string
    }
  | {
      type: 'error'
      error?: string
      sessionId?: string
      sessionPath?: string
    }
  | ({
      type: 'status'
    } & RuntimeStatus)

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  toolCalls?: ToolCall[]
  attachments?: string[]
  isStreaming?: boolean
  artifacts?: string[]
  rawContent?: Array<Record<string, unknown>>
  kind?: 'standard' | 'toolResult' | 'custom' | 'branchSummary' | 'compactionSummary'
}

export interface Session {
  id: string
  path: string
  cwd: string
  source: 'pi'
  title: string
  cwdLabel?: string
  lastActiveLabel?: string
  status?: 'idle' | 'running' | 'waiting' | 'failed'
  createdAt: number
  updatedAt: number
  messages: Message[]
  model?: string
  tokenCount?: number
  messageCount?: number
  thinkingLevel?: string
}

export interface WorkspaceFileEntry {
  name: string
  path: string
  isDir: boolean
  size: number
  modifiedAt: string
}

export type ResultItemKind = 'created' | 'updated' | 'exported' | 'viewed' | 'failed'

export interface ResultItem {
  id: string
  sessionId: string
  path: string
  title: string
  kind: ResultItemKind
  action: string
  updatedAt: string
  isNew: boolean
  errorSummary?: string
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
  createdAt: number
  updatedAt: number
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

export interface ProviderModel {
  id: string
  name: string
  providerId: string
  runtimeKey: string
  input: string[]
  reasoning: boolean
  isDefault: boolean
}

export interface ProviderSummary {
  id: string
  providerId: string
  displayName: string
  kind: 'builtin' | 'custom'
  hasAuth: boolean
  authType: 'apiKey' | 'oauth' | 'none'
  apiType: 'openai-completions' | 'openai-responses' | 'anthropic-messages' | 'google-generative-ai'
  baseUrl: string
  models: ProviderModel[]
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export interface ProviderCatalogEntry {
  providerId: string
  displayName: string
  apiType: 'openai-completions' | 'openai-responses' | 'anthropic-messages' | 'google-generative-ai'
  authType: 'apiKey' | 'oauth' | 'none'
  baseUrl: string
  allowCustomBaseUrl: boolean
}

export interface ProviderConnectionResult {
  success: boolean
  message?: string
  error?: string
  detectedModels?: ProviderModel[]
}

export interface ModelOption {
  id: string
  name: string
  provider: string
  label: string
  providerId: string
}

export interface StateSummaryEntry {
  id: string
  label: string
  value: string
  source: string
}

export interface SkillSummaryEntry {
  id: string
  label: string
  value: string
  source: string
  status: 'active' | 'inactive'
}
