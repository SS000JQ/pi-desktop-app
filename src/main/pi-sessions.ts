import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { basename, dirname } from 'path'
import type { AgentMessage } from '@earendil-works/pi-agent-core'
import { loadPiCodingAgentModule } from './pi-sdk'
import { getProviderByModelKey } from './providers'
import { repairUserHomePath } from './path-utils'

export interface PiSessionSummary {
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

export interface PiSessionDetail {
  sessionId: string
  sessionPath: string
  cwd: string
  title: string
  messages: SupportedSessionMessage[]
  model: string | null
  thinkingLevel: string
  tokenCount: number
}

type SupportedSessionMessage = AgentMessage & {
  role: 'user' | 'assistant' | 'toolResult' | 'custom' | 'branchSummary' | 'compactionSummary'
}

interface UsageLike {
  totalTokens?: number
}

function persistSessionHeaderIfNeeded(
  sessionPath: string,
  header: object | null,
): void {
  if (!header || existsSync(sessionPath)) return

  mkdirSync(dirname(sessionPath), { recursive: true })
  writeFileSync(sessionPath, `${JSON.stringify(header)}\n`, { flag: 'wx' })
}

function extractTextContent(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''

  return content
    .map((part) => {
      if (!part || typeof part !== 'object') return ''
      if ((part as { type?: string }).type === 'text') {
        return (part as { text?: string }).text || ''
      }
      return ''
    })
    .join('')
    .trim()
}

function buildSessionTitle(name: string | undefined, firstMessage: string | undefined, cwd: string): string {
  if (name?.trim()) return name.trim()
  if (firstMessage?.trim()) return firstMessage.trim().slice(0, 80)

  const folderName = basename(cwd.replace(/[\\/]+$/, ''))
  return folderName || 'Untitled Pi Session'
}

function getMessageTokenCount(messages: SupportedSessionMessage[]): number {
  return messages.reduce((total, message) => {
    const usage = 'usage' in message ? (message.usage as UsageLike | undefined) : undefined
    return total + (usage?.totalTokens || 0)
  }, 0)
}

function isSupportedSessionMessage(message: AgentMessage): message is SupportedSessionMessage {
  switch (message.role) {
    case 'user':
    case 'assistant':
    case 'toolResult':
    case 'custom':
    case 'branchSummary':
    case 'compactionSummary':
      return !('display' in message) || message.display !== false
    default:
      return false
  }
}

function getFirstMessagePreview(messages: SupportedSessionMessage[]): string | undefined {
  for (const message of messages) {
    if ('content' in message) {
      const text = extractTextContent(message.content)
      if (text) return text
      continue
    }

    if ('summary' in message && message.summary?.trim()) {
      return message.summary.trim()
    }
  }

  return undefined
}

export async function listPiSessions(): Promise<PiSessionSummary[]> {
  const { SessionManager } = await loadPiCodingAgentModule()
  const sessions = await SessionManager.listAll()
  const detailedSessions = await Promise.all(
    sessions.map(async (session) => {
      const detail = await openPiSession(session.path).catch(() => null)
      const cwd = repairUserHomePath(session.cwd)
      return {
        id: session.id,
        path: session.path,
        cwd,
        title: buildSessionTitle(session.name, session.firstMessage, cwd),
        model: detail?.model || null,
        tokenCount: detail?.tokenCount || 0,
        messageCount: session.messageCount,
        source: 'pi' as const,
        createdAt: session.created.toISOString(),
        updatedAt: session.modified.toISOString(),
      }
    }),
  )

  return detailedSessions
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

export async function openPiSession(sessionPath: string): Promise<PiSessionDetail> {
  const { SessionManager } = await loadPiCodingAgentModule()
  const sessionManager = SessionManager.open(sessionPath)
  const sessionContext = sessionManager.buildSessionContext()
  const header = sessionManager.getHeader()

  const messages = sessionContext.messages.filter(isSupportedSessionMessage)
  const cwd = repairUserHomePath(sessionManager.getCwd())
  const headerCwd = repairUserHomePath(header?.cwd || cwd)

  return {
    sessionId: sessionManager.getSessionId(),
    sessionPath,
    cwd,
    title: buildSessionTitle(sessionManager.getSessionName(), getFirstMessagePreview(messages), headerCwd),
    messages,
    model: sessionContext.model ? `${sessionContext.model.provider}/${sessionContext.model.modelId}` : null,
    thinkingLevel: sessionContext.thinkingLevel || 'medium',
    tokenCount: getMessageTokenCount(messages),
  }
}

export async function createPiSession(cwd: string): Promise<PiSessionDetail> {
  const { SessionManager } = await loadPiCodingAgentModule()
  const sessionManager = SessionManager.create(cwd)
  const sessionPath = sessionManager.getSessionFile()

  if (!sessionPath) {
    throw new Error('Failed to create Pi session file')
  }

  persistSessionHeaderIfNeeded(sessionPath, sessionManager.getHeader())

  return {
    sessionId: sessionManager.getSessionId(),
    sessionPath,
    cwd: sessionManager.getCwd(),
    title: buildSessionTitle(sessionManager.getSessionName(), undefined, sessionManager.getCwd()),
    messages: [],
    model: null,
    thinkingLevel: 'medium',
    tokenCount: 0,
  }
}

export async function updatePiSessionRuntime(
  sessionPath: string,
  runtime: {
    modelKey?: string
    thinkingLevel?: string
  },
): Promise<PiSessionDetail> {
  const { SessionManager } = await loadPiCodingAgentModule()
  const sessionManager = SessionManager.open(sessionPath)
  const context = sessionManager.buildSessionContext()

  if (runtime.modelKey) {
    const matched = getProviderByModelKey(runtime.modelKey)
    if (!matched) {
      throw new Error(`Configured Pi model is unavailable: ${runtime.modelKey}`)
    }

    const currentModelKey = context.model
      ? `${context.model.provider}/${context.model.modelId}`
      : null
    const nextModelKey = `${matched.provider.providerId}/${matched.model.id}`

    if (nextModelKey !== currentModelKey) {
      sessionManager.appendModelChange(matched.provider.providerId, matched.model.id)
    }
  }

  if (runtime.thinkingLevel && runtime.thinkingLevel !== context.thinkingLevel) {
    sessionManager.appendThinkingLevelChange(runtime.thinkingLevel as never)
  }

  return openPiSession(sessionPath)
}
