export type { BinaryPreviewContent, FilePreviewData } from '../../../shared/preview-types'

export interface ToolCall {
  id: string
  toolCallId?: string
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
  updatedAt?: number
  lastEventAt?: number
  terminalAt?: number
  runId?: string
  messageId?: string
  isWaitingForUser: boolean
  isStalled?: boolean
  errorSummary?: string
  resultSummary?: string
  activeToolName?: string
  activeToolState?: 'running' | 'done' | 'failed'
  lastProgressMessage?: string
  sessionId?: string
  sessionPath?: string
  thinkingPreview?: string
  thinkingUpdatedAt?: number
  hasThinking?: boolean
}

export type RunActivityFileKind = 'read' | 'written' | 'generated' | 'referenced'

export interface RunActivityFile {
  path: string
  label: string
  kind: RunActivityFileKind
}

export interface RunActivityStep {
  id: string
  label: string
  detail?: string
  at: number
  state: 'active' | 'done' | 'error' | 'info'
}

export interface RunActivity {
  runId?: string
  sessionId?: string
  sessionPath?: string
  status: RuntimePhase
  statusLabel: string
  lastAction?: string
  startedAt: number
  lastEventAt: number
  activeToolName?: string
  activeToolState?: 'running' | 'done' | 'failed'
  recentSteps: RunActivityStep[]
  files: RunActivityFile[]
  resultPaths: string[]
}

export type AgentEvent =
  | {
      type: 'token'
      text: string
      runId?: string
      sessionId?: string
      sessionPath?: string
    }
  | {
      type: 'thinking_delta'
      text: string
      runId?: string
      sessionId?: string
      sessionPath?: string
    }
  | {
      type: 'tool_started'
      toolName?: string
      toolCallId?: string
      args?: unknown
      runId?: string
      sessionId?: string
      sessionPath?: string
    }
  | {
      type: 'tool_finished' | 'tool_failed'
      toolName?: string
      toolCallId?: string
      error?: string
      runId?: string
      sessionId?: string
      sessionPath?: string
    }
  | {
      type: 'done'
      runId?: string
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
      runId?: string
      sessionId?: string
      sessionPath?: string
    }
  | {
      type: 'error'
      error?: string
      runId?: string
      sessionId?: string
      sessionPath?: string
    }
  | ({
      type: 'status'
    } & RuntimeStatus)

export interface MessagePart {
  type: 'text' | 'thinking' | 'toolCall' | 'toolResult' | 'customSummary'
  text: string
  title?: string
  collapsed?: boolean
  state?: 'streaming' | 'complete'
  updatedAt?: number
  toolCall?: ToolCall
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  runId?: string
  sessionId?: string
  sessionPath?: string
  parts?: MessagePart[]
  anchors?: {
    answerStart?: string
    latestOutput?: string
    toolSummary?: string
    finalAnswer?: string
  }
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
  sessionPath?: string
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

export interface ConnectorSummaryEntry {
  id: string
  label: string
  value: string
  source: string
  status: 'active' | 'inactive'
}

export type SlashCommandKind = 'desktop' | 'pi_runtime' | 'skill' | 'prompt' | 'extension' | 'context' | 'unsupported'
export type SlashCommandExecution = 'desktop' | 'runtime' | 'prompt' | 'disabled'
export type SlashCommandGroup = 'Desktop' | 'Pi Runtime' | 'Skills' | 'Prompts' | 'Extensions' | 'Context' | 'Unsupported'

export interface SlashCommand {
  id: string
  command: string
  label: string
  description: string
  kind: SlashCommandKind
  source: string
  execution?: SlashCommandExecution
  group?: SlashCommandGroup
  argumentHint?: string
  requiresIdle?: boolean
  disabledReason?: string
}

export type PiSkillScope = 'pi_global' | 'shared_global' | 'project' | 'settings' | 'package' | 'other'

export interface PiSkillResource {
  name: string
  description: string
  source: string
  filePath?: string
  baseDir?: string
  scope?: PiSkillScope
  sourceLabel?: string
  disabled?: boolean
  disableModelInvocation?: boolean
  status: 'active' | 'inactive' | 'error'
  diagnostics?: string[]
}

export interface PiPromptResource {
  name: string
  description: string
  source: string
  argumentHint?: string
}

export interface PiExtensionResource {
  name: string
  source: string
  status: 'active' | 'inactive' | 'error'
  diagnostics?: string[]
}

export interface PiResourcesResult {
  skills: PiSkillResource[]
  prompts: PiPromptResource[]
  extensions: PiExtensionResource[]
  extensionCommands: Array<{
    name: string
    description: string
    source: string
  }>
  diagnostics: string[]
  summary?: {
    cwd: string | null
    agentDir: string | null
    totalSkills: number
    countsByScope: Record<PiSkillScope, number>
  }
  additionalSkillPaths?: string[]
  disabledSkillPaths?: string[]
}
