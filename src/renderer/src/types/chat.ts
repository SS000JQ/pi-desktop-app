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
}

export interface Session {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messages: Message[]
  model?: string
  tokenCount?: number
}

export interface ModelOption {
  id: string
  name: string
  provider: string
}
