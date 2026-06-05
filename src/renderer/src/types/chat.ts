export interface ToolCall {
  id: string
  name: string
  args: string
  status: 'running' | 'done' | 'error'
  duration?: string
}

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
  createdAt: number
  updatedAt: number
  messages: Message[]
  model?: string
  tokenCount?: number
  messageCount?: number
  thinkingLevel?: string
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
