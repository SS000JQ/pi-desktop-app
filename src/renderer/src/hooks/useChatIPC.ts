import { useCallback, useEffect, useRef } from 'react'
import type { AgentEvent, Message, MessagePart, RunActivity, RunActivityFile, RuntimeStatus, ToolCall } from '../types/chat'

const MAX_THINKING_PREVIEW_LENGTH = 1400
const MAX_RUN_ACTIVITY_STEPS = 8
const MAX_RUN_ACTIVITY_FILES = 8

function normalizeSessionPath(path?: string): string {
  return (path || '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
}

function normalizeCandidatePath(path: string): string {
  return path.replace(/^['"]|['"]$/g, '').replace(/\\/g, '/').trim()
}

function isLikelyPath(value: string): boolean {
  const candidate = normalizeCandidatePath(value)
  if (!candidate) return false
  if (/^(https?:|data:|blob:)/i.test(candidate)) return false
  return /^[a-zA-Z]:[\\/]/.test(candidate) || candidate.startsWith('/') || /\.(md|txt|pdf|docx?|pptx?|xlsx|csv|json|ya?ml|ts|tsx|js|jsx|py|html?)$/i.test(candidate)
}

function extractFilePathsFromArgs(args: unknown): string[] {
  const paths = new Set<string>()

  const visit = (value: unknown): void => {
    if (typeof value === 'string') {
      const candidate = normalizeCandidatePath(value)
      if (isLikelyPath(candidate)) {
        paths.add(candidate)
      }
      return
    }
    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }
    if (value && typeof value === 'object') {
      Object.values(value as Record<string, unknown>).forEach(visit)
    }
  }

  visit(args)
  return Array.from(paths)
}

function getEventSessionPath(event: AgentEvent): string | undefined {
  if ('sessionPath' in event && event.sessionPath) return event.sessionPath
  if (event.type === 'done') return event.session?.sessionPath
  return undefined
}

function getEventSessionId(event: AgentEvent): string | undefined {
  if ('sessionId' in event && event.sessionId) return event.sessionId
  if (event.type === 'done') return event.session?.sessionId
  return undefined
}

function hasVisibleAssistantText(messages?: unknown[]): boolean {
  if (!Array.isArray(messages) || messages.length === 0) return true
  let sawAssistantActivity = false

  const hasVisibleText = messages.some((message) => {
    if (!message || typeof message !== 'object') return false
    const candidate = message as { role?: unknown; content?: unknown }
    if (candidate.role === 'toolResult') {
      sawAssistantActivity = true
      return false
    }
    if (candidate.role !== 'assistant') return false
    sawAssistantActivity = true
    if (typeof candidate.content === 'string') return candidate.content.trim().length > 0
    if (!Array.isArray(candidate.content)) return false
    return candidate.content.some((part) => {
      if (!part || typeof part !== 'object') return false
      const contentPart = part as { type?: unknown; text?: unknown }
      return contentPart.type === 'text'
        && typeof contentPart.text === 'string'
        && contentPart.text.trim().length > 0
    })
  })

  return hasVisibleText || !sawAssistantActivity
}

interface UseChatIPCOptions {
  onAssistantMessage: (message: Message) => void
  onStreamStart: () => void
  onStreamEnd: () => void
  onRuntimeStatus?: (status: RuntimeStatus | ((previous: RuntimeStatus | null) => RuntimeStatus | null)) => void
  onRunActivity?: (activity: RunActivity | null | ((previous: RunActivity | null) => RunActivity | null)) => void
  onArtifactCreated?: (payload: { path: string; sessionId?: string; sessionPath?: string }) => void
  onSessionSynced?: (session: {
    sessionId: string
    sessionPath: string
    cwd: string
    title: string
    messages: unknown[]
    model: string | null
    thinkingLevel: string
    tokenCount: number
  }) => void
}

export function useChatIPC({
  onAssistantMessage,
  onStreamStart,
  onStreamEnd,
  onRuntimeStatus,
  onRunActivity,
  onArtifactCreated,
  onSessionSynced,
  currentModel = 'openai/gpt-4',
  currentDir,
  currentSessionId,
  currentSessionPath,
  thinkingLevel = 'medium',
}: UseChatIPCOptions & {
  currentModel?: string
  currentSessionId?: string
  currentSessionPath?: string
  currentDir?: string
  thinkingLevel?: string
}) {
  const accumulatedRef = useRef('')
  const partsRef = useRef<MessagePart[]>([])
  const tokenModeRef = useRef<'text' | 'thinking'>('text')
  const msgIdRef = useRef('')
  const toolCallsRef = useRef<ToolCall[]>([])
  const activeRunIdRef = useRef<string | null>(null)
  const activeRunSessionIdRef = useRef<string | undefined>(currentSessionId)
  const activeRunSessionPathRef = useRef<string | undefined>(currentSessionPath)
  const currentSessionIdRef = useRef(currentSessionId)
  const currentSessionPathRef = useRef(currentSessionPath)
  const currentDirRef = useRef(currentDir)
  const lastRuntimeUpdateRef = useRef<number>(0)
  const runtimeStatusRef = useRef<RuntimeStatus | null>(null)
  const pendingTokenFlushRef = useRef<number | null>(null)
  const pendingStatusFlushRef = useRef<number | null>(null)
  const pendingStatusRef = useRef<RuntimeStatus | null>(null)
  const runActivityRef = useRef<RunActivity | null>(null)
  const pendingRunEventsRef = useRef<AgentEvent[]>([])
  const awaitingRunIdRef = useRef(false)
  const lastTerminalRunIdRef = useRef<string | null>(null)
  const callbacksRef = useRef({
    onAssistantMessage,
    onStreamStart,
    onStreamEnd,
    onRuntimeStatus,
    onRunActivity,
    onArtifactCreated,
    onSessionSynced,
  })

  useEffect(() => {
    currentSessionIdRef.current = currentSessionId
    currentSessionPathRef.current = currentSessionPath
    currentDirRef.current = currentDir
  }, [currentDir, currentSessionId, currentSessionPath])

  useEffect(() => {
    callbacksRef.current = {
      onAssistantMessage,
      onStreamStart,
      onStreamEnd,
      onRuntimeStatus,
      onRunActivity,
      onArtifactCreated,
      onSessionSynced,
    }
  }, [onArtifactCreated, onAssistantMessage, onRunActivity, onRuntimeStatus, onSessionSynced, onStreamEnd, onStreamStart])

  const setRuntimeStatus = useCallback((next: RuntimeStatus | ((previous: RuntimeStatus | null) => RuntimeStatus | null), throttle = false) => {
    const resolved = typeof next === 'function' ? next(runtimeStatusRef.current) : next
    const isTerminal = resolved?.status === 'completed' || resolved?.status === 'failed'
    if (!throttle || isTerminal) {
      if (pendingStatusFlushRef.current !== null) {
        window.clearTimeout(pendingStatusFlushRef.current)
        pendingStatusFlushRef.current = null
      }
      pendingStatusRef.current = null
    }
    if (resolved && throttle) {
      const now = Date.now()
      const elapsed = now - lastRuntimeUpdateRef.current
      pendingStatusRef.current = resolved
      if (elapsed < 250 && !isTerminal) {
        if (pendingStatusFlushRef.current === null) {
          pendingStatusFlushRef.current = window.setTimeout(() => {
            pendingStatusFlushRef.current = null
            const pending = pendingStatusRef.current
            pendingStatusRef.current = null
            if (pending) {
              runtimeStatusRef.current = pending
              lastRuntimeUpdateRef.current = Date.now()
              callbacksRef.current.onRuntimeStatus?.(pending)
            }
          }, 250 - elapsed)
        }
        return
      }
      pendingStatusRef.current = null
    }
    runtimeStatusRef.current = resolved
    if (resolved) {
      lastRuntimeUpdateRef.current = Date.now()
      callbacksRef.current.onRuntimeStatus?.(resolved)
    } else {
      callbacksRef.current.onRuntimeStatus?.(() => null)
    }
  }, [])

  const appendThinkingPreview = useCallback((previous: string | undefined, delta: string) => {
    const next = `${previous || ''}${delta}`
    if (next.length <= MAX_THINKING_PREVIEW_LENGTH) return next
    return next.slice(next.length - MAX_THINKING_PREVIEW_LENGTH)
  }, [])

  const setRunActivity = useCallback((next: RunActivity | null | ((previous: RunActivity | null) => RunActivity | null)) => {
    const resolved = typeof next === 'function' ? next(runActivityRef.current) : next
    runActivityRef.current = resolved
    callbacksRef.current.onRunActivity?.(resolved)
  }, [])

  const upsertRunFiles = useCallback((previous: RunActivityFile[], additions: RunActivityFile[]) => {
    const seen = new Set<string>()
    const next = [...additions, ...previous].filter((entry) => {
      const key = normalizeSessionPath(entry.path)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    return next.slice(0, MAX_RUN_ACTIVITY_FILES)
  }, [])

  const appendRunStep = useCallback((activity: RunActivity, label: string, detail: string | undefined, state: 'active' | 'done' | 'error' | 'info') => {
    const step = {
      id: `${activity.runId || 'run'}-${activity.lastEventAt}-${label}`,
      label,
      detail,
      at: activity.lastEventAt,
      state,
    }
    return [step, ...activity.recentSteps].slice(0, MAX_RUN_ACTIVITY_STEPS)
  }, [])

  const appendTextPart = useCallback((text: string) => {
    if (!text) return
    accumulatedRef.current += text
    const nextParts = [...partsRef.current]
    const last = nextParts[nextParts.length - 1]
    if (last?.type === 'text') {
      nextParts[nextParts.length - 1] = { ...last, text: `${last.text}${text}` }
    } else {
      nextParts.push({ type: 'text', text })
    }
    partsRef.current = nextParts
  }, [])

  const appendThinkingPart = useCallback((text: string, state: MessagePart['state'] = 'streaming') => {
    if (!text) return
    const now = Date.now()
    const nextParts = [...partsRef.current]
    const lastIndex = nextParts.length - 1
    const last = nextParts[lastIndex]
    if (last?.type === 'thinking') {
      nextParts[lastIndex] = {
        ...last,
        text: `${last.text}${text}`,
        collapsed: true,
        state,
        updatedAt: now,
      }
    } else {
      nextParts.push({
        type: 'thinking',
        title: 'Thinking',
        text,
        collapsed: true,
        state,
        updatedAt: now,
      })
    }
    partsRef.current = nextParts
  }, [])

  const appendToolCallPart = useCallback((toolCall: ToolCall) => {
    partsRef.current = [
      ...partsRef.current,
      {
        type: 'toolCall',
        text: '',
        toolCall,
      },
    ]
  }, [])

  const updateToolCallPart = useCallback((toolCallId: string | undefined, toolName: string | undefined, status: ToolCall['status']) => {
    const nextParts = [...partsRef.current]
    const targetIndex = [...nextParts].reverse().findIndex((part) => {
      if (part.type !== 'toolCall' || !part.toolCall) return false
      if (toolCallId) return (part.toolCall.toolCallId || part.toolCall.id) === toolCallId
      return part.toolCall.name === toolName && part.toolCall.status === 'running'
    })
    const resolvedIndex = targetIndex === -1 ? -1 : nextParts.length - 1 - targetIndex
    if (resolvedIndex >= 0) {
      const existing = nextParts[resolvedIndex]
      nextParts[resolvedIndex] = {
        ...existing,
        toolCall: existing.toolCall ? { ...existing.toolCall, status } : existing.toolCall,
      }
      partsRef.current = nextParts
    }
  }, [])

  const markThinkingComplete = useCallback(() => {
    partsRef.current = partsRef.current.map((part) =>
      part.type === 'thinking'
        ? { ...part, state: 'complete' as const, updatedAt: Date.now(), collapsed: true }
        : part,
    )
  }, [])

  const appendTokenDelta = useCallback((text: string) => {
    if (!text) return
    let remaining = text
    while (remaining) {
      if (tokenModeRef.current === 'text') {
        const startMatch = /<thinking>/i.exec(remaining)
        if (!startMatch || startMatch.index < 0) {
          appendTextPart(remaining)
          return
        }
        const before = remaining.slice(0, startMatch.index)
        if (before) appendTextPart(before)
        tokenModeRef.current = 'thinking'
        remaining = remaining.slice(startMatch.index + startMatch[0].length)
      } else {
        const endMatch = /<\/thinking>/i.exec(remaining)
        if (!endMatch || endMatch.index < 0) {
          appendThinkingPart(remaining)
          return
        }
        const thinking = remaining.slice(0, endMatch.index)
        if (thinking) appendThinkingPart(thinking)
        tokenModeRef.current = 'text'
        remaining = remaining.slice(endMatch.index + endMatch[0].length)
      }
    }
  }, [appendTextPart, appendThinkingPart])

  const buildAssistantMessage = useCallback((isStreaming = true): Message => ({
    id: msgIdRef.current || `msg-${Date.now()}`,
    role: 'assistant',
    content: accumulatedRef.current,
    timestamp: Date.now(),
    isStreaming,
    runId: activeRunIdRef.current || undefined,
    sessionId: activeRunSessionIdRef.current || currentSessionIdRef.current,
    sessionPath: activeRunSessionPathRef.current || currentSessionPathRef.current,
    parts: partsRef.current.length ? partsRef.current : undefined,
    toolCalls: toolCallsRef.current,
    anchors: {
      answerStart: msgIdRef.current ? `${msgIdRef.current}-answer-start` : undefined,
      latestOutput: msgIdRef.current ? `${msgIdRef.current}-latest-output` : undefined,
      toolSummary: msgIdRef.current ? `${msgIdRef.current}-tool-summary` : undefined,
      finalAnswer: msgIdRef.current ? `${msgIdRef.current}-final-answer` : undefined,
    },
  }), [])

  const ensureAssistantRun = useCallback((runId?: string) => {
    if (runId && !activeRunIdRef.current) {
      activeRunIdRef.current = runId
    }
    if (!msgIdRef.current) {
      msgIdRef.current = `msg-${Date.now()}`
      accumulatedRef.current = ''
      partsRef.current = []
      toolCallsRef.current = []
      callbacksRef.current.onStreamStart()
    }
  }, [])

  const flushAssistantMessage = useCallback((isStreaming = true) => {
    if (!msgIdRef.current && !accumulatedRef.current && toolCallsRef.current.length === 0) return
    callbacksRef.current.onAssistantMessage(buildAssistantMessage(isStreaming))
  }, [buildAssistantMessage])

  const scheduleTokenFlush = useCallback(() => {
    if (pendingTokenFlushRef.current !== null) return
    pendingTokenFlushRef.current = window.setTimeout(() => {
      pendingTokenFlushRef.current = null
      flushAssistantMessage(true)
    }, 75)
  }, [flushAssistantMessage])

  const clearRunState = useCallback(() => {
    if (pendingTokenFlushRef.current !== null) {
      window.clearTimeout(pendingTokenFlushRef.current)
      pendingTokenFlushRef.current = null
    }
    msgIdRef.current = ''
    accumulatedRef.current = ''
    partsRef.current = []
    tokenModeRef.current = 'text'
    toolCallsRef.current = []
    activeRunIdRef.current = null
    activeRunSessionIdRef.current = undefined
    activeRunSessionPathRef.current = undefined
  }, [])

  const createOrUpdateRunActivity = useCallback((
    previous: RunActivity | null,
    input: {
      runId?: string
      sessionId?: string
      sessionPath?: string
      status: RunActivity['status']
      statusLabel: string
      lastAction?: string
      activeToolName?: string
      activeToolState?: 'running' | 'done' | 'failed'
      fileUpdates?: RunActivityFile[]
      stepState?: 'active' | 'done' | 'error' | 'info'
    },
  ): RunActivity => {
    const now = Date.now()
    const sameRun =
      previous
      && (!input.runId || !previous.runId || previous.runId === input.runId)
      && (!previous.sessionPath || !input.sessionPath || normalizeSessionPath(previous.sessionPath) === normalizeSessionPath(input.sessionPath))
      && previous.status !== 'completed'
      && previous.status !== 'failed'

    const base: RunActivity = sameRun && previous
      ? previous
      : {
          runId: input.runId,
          sessionId: input.sessionId,
          sessionPath: input.sessionPath,
          status: input.status,
          statusLabel: input.statusLabel,
          lastAction: input.lastAction,
          startedAt: now,
          lastEventAt: now,
          activeToolName: input.activeToolName,
          activeToolState: input.activeToolState,
          recentSteps: [],
          files: [],
          resultPaths: [],
        }

    const next: RunActivity = {
      ...base,
      runId: input.runId || base.runId,
      sessionId: input.sessionId || base.sessionId,
      sessionPath: input.sessionPath || base.sessionPath,
      status: input.status,
      statusLabel: input.statusLabel,
      lastAction: input.lastAction,
      lastEventAt: now,
      activeToolName: input.activeToolName ?? base.activeToolName,
      activeToolState: input.activeToolState ?? base.activeToolState,
      files: input.fileUpdates ? upsertRunFiles(base.files, input.fileUpdates) : base.files,
      resultPaths: input.fileUpdates
        ? upsertRunFiles(
            base.resultPaths.map((path) => ({ path, label: path.split(/[/\\]/).pop() || path, kind: 'generated' as const })),
            input.fileUpdates.filter((entry) => entry.kind === 'generated'),
          ).map((entry) => entry.path)
        : base.resultPaths,
      recentSteps: base.recentSteps,
    }

    next.recentSteps = appendRunStep(next, input.statusLabel, input.lastAction, input.stepState || 'info')
    return next
  }, [appendRunStep, upsertRunFiles])

  const shouldThrottleLiveStatus = useCallback((runId?: string) => {
    const current = runtimeStatusRef.current
    if (!current) return false
    if (current.status === 'completed' || current.status === 'failed') return false
    if (!runId || !current.runId) return true
    return current.runId === runId
  }, [])

  const handleAgentEvent = useCallback((event: AgentEvent) => {
    const eventSessionId = getEventSessionId(event)
    const eventSessionPath = getEventSessionPath(event)
    if (eventSessionId) activeRunSessionIdRef.current = eventSessionId
    if (eventSessionPath) activeRunSessionPathRef.current = eventSessionPath

    if (event.type === 'status') {
      const previousStatus = runtimeStatusRef.current
      const continuingSameRun =
        previousStatus
        && previousStatus.status !== 'completed'
        && previousStatus.status !== 'failed'
        && (!event.runId || !previousStatus.runId || previousStatus.runId === event.runId)
      const startedAt = event.startedAt || (continuingSameRun ? previousStatus?.startedAt : undefined) || Date.now()
      const eventTimestamp = event.updatedAt || Date.now()
      setRuntimeStatus((previous) => ({
        ...(continuingSameRun ? previous : null),
        startedAt,
        status: event.status,
        statusLabel: event.statusLabel,
        lastAction: event.lastAction,
        elapsedMs: event.status === 'completed' || event.status === 'failed'
          ? event.elapsedMs ?? previous?.elapsedMs ?? Date.now() - startedAt
          : Date.now() - startedAt,
        updatedAt: eventTimestamp,
        isWaitingForUser: event.isWaitingForUser,
        isStalled: false,
        runId: event.runId || activeRunIdRef.current || previous?.runId,
        lastEventAt: event.lastEventAt || eventTimestamp,
        terminalAt: event.terminalAt,
        messageId: continuingSameRun ? previous?.messageId : undefined,
        errorSummary:
          event.status === 'completed' || event.status === 'failed'
            ? event.errorSummary ?? previous?.errorSummary
            : event.errorSummary,
        resultSummary:
          event.status === 'completed' || event.status === 'failed'
            ? event.resultSummary ?? previous?.resultSummary
            : event.resultSummary,
        activeToolName: event.activeToolName ?? (continuingSameRun ? previous?.activeToolName : undefined),
        activeToolState: event.activeToolState ?? (continuingSameRun ? previous?.activeToolState : undefined),
        lastProgressMessage: event.lastProgressMessage ?? (continuingSameRun ? previous?.lastProgressMessage : undefined),
        sessionId: event.sessionId || previous?.sessionId,
        sessionPath: event.sessionPath || previous?.sessionPath,
        thinkingPreview: continuingSameRun ? previous?.thinkingPreview : undefined,
        thinkingUpdatedAt: continuingSameRun ? previous?.thinkingUpdatedAt : undefined,
        hasThinking: continuingSameRun ? previous?.hasThinking : undefined,
      }), shouldThrottleLiveStatus(event.runId))
      setRunActivity((previous) => createOrUpdateRunActivity(previous, {
        runId: event.runId || activeRunIdRef.current || undefined,
        sessionId: event.sessionId,
        sessionPath: event.sessionPath,
        status: event.status,
        statusLabel: event.statusLabel,
        lastAction: event.lastAction,
        activeToolName: event.activeToolName,
        activeToolState: event.activeToolState,
        stepState: event.status === 'failed' ? 'error' : event.status === 'completed' ? 'done' : 'info',
      }))
      if (event.status !== 'completed' && event.status !== 'failed' && !msgIdRef.current) {
        callbacksRef.current.onStreamStart()
      }
    } else if (event.type === 'token') {
      ensureAssistantRun(event.runId)
      appendTokenDelta(event.text)
      scheduleTokenFlush()
    } else if (event.type === 'thinking_delta') {
      ensureAssistantRun(event.runId)
      appendThinkingPart(event.text)
      setRuntimeStatus((previous) => {
        const previousRunIsActive =
          !previous ||
          !previous.runId ||
          !event.runId ||
          previous.runId === event.runId
        const startedAt =
          previousRunIsActive && previous?.status !== 'completed' && previous?.status !== 'failed'
            ? previous?.startedAt || Date.now()
            : Date.now()
        return {
          status:
            previousRunIsActive && previous?.status && previous.status !== 'completed' && previous.status !== 'failed'
              ? previous.status
              : 'processing',
          statusLabel:
            previousRunIsActive && previous?.statusLabel && previous.status !== 'completed' && previous.status !== 'failed'
              ? previous.statusLabel
              : 'Thinking',
          lastAction:
            previousRunIsActive && previous?.lastAction && previous.status !== 'completed' && previous.status !== 'failed'
              ? previous.lastAction
              : 'Streaming live reasoning',
          startedAt,
          elapsedMs: Date.now() - startedAt,
          isWaitingForUser: previous?.isWaitingForUser || false,
          isStalled: false,
          errorSummary: previous?.status === 'failed' ? previous?.errorSummary : undefined,
          resultSummary: undefined,
          runId: event.runId || activeRunIdRef.current || previous?.runId,
          messageId: msgIdRef.current || previous?.messageId,
          updatedAt: Date.now(),
          lastEventAt: Date.now(),
          terminalAt: undefined,
          sessionId: event.sessionId || previous?.sessionId,
          sessionPath: event.sessionPath || previous?.sessionPath,
          activeToolName: previous?.activeToolName,
          activeToolState: previous?.activeToolState,
          lastProgressMessage: previous?.lastProgressMessage,
          thinkingPreview: appendThinkingPreview(previous?.thinkingPreview, event.text),
          thinkingUpdatedAt: Date.now(),
          hasThinking: true,
        }
      })
      setRunActivity((previous) => createOrUpdateRunActivity(previous, {
        runId: event.runId || activeRunIdRef.current || undefined,
        sessionId: event.sessionId,
        sessionPath: event.sessionPath,
        status: 'processing',
        statusLabel: 'Thinking',
        lastAction: 'Streaming live reasoning',
        stepState: 'info',
      }))
      scheduleTokenFlush()
    } else if (event.type === 'tool_started') {
      ensureAssistantRun(event.runId)
      const toolCall = {
        id: event.toolCallId || `tool-${Date.now()}`,
        toolCallId: event.toolCallId,
        name: event.toolName || 'tool',
        args: typeof event.args === 'string' ? event.args : JSON.stringify(event.args || {}),
        status: 'running' as const,
      }
      toolCallsRef.current = [...toolCallsRef.current, toolCall]
      appendToolCallPart(toolCall)
      const readPaths = extractFilePathsFromArgs(event.args).map((path) => ({
        path,
        label: path.split(/[/\\]/).pop() || path,
        kind: 'read' as const,
      }))
      setRuntimeStatus((previous) => {
        const startedAt = previous?.startedAt || Date.now()
        return {
          ...previous,
          status: previous?.status === 'waiting' ? previous.status : 'processing',
          statusLabel: previous?.statusLabel || 'Processing',
          lastAction: event.toolName ? `Running ${event.toolName}` : 'Running tool',
          startedAt,
          elapsedMs: Date.now() - startedAt,
          isWaitingForUser: false,
          isStalled: false,
          errorSummary: undefined,
          resultSummary: undefined,
          runId: event.runId || activeRunIdRef.current || previous?.runId,
          updatedAt: Date.now(),
          lastEventAt: Date.now(),
          terminalAt: undefined,
          sessionId: event.sessionId || previous?.sessionId,
          sessionPath: event.sessionPath || previous?.sessionPath,
          activeToolName: event.toolName || previous?.activeToolName,
          activeToolState: 'running',
          lastProgressMessage: previous?.lastProgressMessage,
          thinkingPreview: previous?.thinkingPreview,
          thinkingUpdatedAt: previous?.thinkingUpdatedAt,
          hasThinking: previous?.hasThinking,
        }
      }, shouldThrottleLiveStatus(event.runId))
      setRunActivity((previous) => createOrUpdateRunActivity(previous, {
        runId: event.runId || activeRunIdRef.current || undefined,
        sessionId: event.sessionId,
        sessionPath: event.sessionPath,
        status: 'processing',
        statusLabel: event.toolName ? `Running ${event.toolName}` : 'Running tool',
        lastAction: event.toolName ? `Running ${event.toolName}` : 'Running tool',
        activeToolName: event.toolName,
        activeToolState: 'running',
        fileUpdates: readPaths,
        stepState: 'active',
      }))
      scheduleTokenFlush()
    } else if (event.type === 'tool_finished' || event.type === 'tool_failed') {
      const nextToolStatus = event.type === 'tool_failed' ? 'error' : 'done'
      toolCallsRef.current = toolCallsRef.current.map((toolCall, index, array) => {
        const targetIndex = [...array].reverse().findIndex((entry) => {
          if (event.toolCallId) return (entry.toolCallId || entry.id) === event.toolCallId
          return entry.name === event.toolName && entry.status === 'running'
        })
        const resolvedIndex = targetIndex === -1 ? -1 : array.length - 1 - targetIndex
        if (index !== resolvedIndex) return toolCall
        return {
          ...toolCall,
          status: nextToolStatus,
        }
      })
      updateToolCallPart(event.toolCallId, event.toolName, nextToolStatus)
      setRuntimeStatus((previous) => {
        const startedAt = previous?.startedAt || Date.now()
        return {
          ...previous,
          status: event.type === 'tool_failed' ? previous?.status || 'processing' : previous?.status || 'processing',
          statusLabel: previous?.statusLabel || 'Processing',
          lastAction:
            event.type === 'tool_failed'
              ? (event.toolName ? `${event.toolName} failed, continuing` : 'Tool failed, continuing')
              : (event.toolName ? `${event.toolName} finished, continuing` : 'Tool finished, continuing'),
          startedAt,
          elapsedMs: Date.now() - startedAt,
          isWaitingForUser: false,
          isStalled: false,
          errorSummary: event.type === 'tool_failed' ? event.error || previous?.errorSummary : undefined,
          resultSummary: undefined,
          runId: event.runId || activeRunIdRef.current || previous?.runId,
          updatedAt: Date.now(),
          lastEventAt: Date.now(),
          terminalAt: undefined,
          sessionId: event.sessionId || previous?.sessionId,
          sessionPath: event.sessionPath || previous?.sessionPath,
          activeToolName: event.toolName || previous?.activeToolName,
          activeToolState: event.type === 'tool_failed' ? 'failed' : 'done',
          lastProgressMessage: previous?.lastProgressMessage,
          thinkingPreview: previous?.thinkingPreview,
          thinkingUpdatedAt: previous?.thinkingUpdatedAt,
          hasThinking: previous?.hasThinking,
        }
      }, shouldThrottleLiveStatus(event.runId))
      setRunActivity((previous) => createOrUpdateRunActivity(previous, {
        runId: event.runId || activeRunIdRef.current || undefined,
        sessionId: event.sessionId,
        sessionPath: event.sessionPath,
        status: 'processing',
        statusLabel: previous?.statusLabel || 'Processing',
        lastAction:
          event.type === 'tool_failed'
            ? (event.toolName ? `${event.toolName} failed, continuing` : 'Tool failed, continuing')
            : (event.toolName ? `${event.toolName} finished, continuing` : 'Tool finished, continuing'),
        activeToolName: event.toolName,
        activeToolState: event.type === 'tool_failed' ? 'failed' : 'done',
        stepState: event.type === 'tool_failed' ? 'error' : 'done',
      }))
      scheduleTokenFlush()
    } else if (event.type === 'done') {
      markThinkingComplete()
      flushAssistantMessage(false)
      const terminalRunId = event.runId || activeRunIdRef.current || runtimeStatusRef.current?.runId || null
      const hasFinalReply = hasVisibleAssistantText(event.session?.messages)
      const completionLabel = hasFinalReply ? 'Completed' : 'No final reply'
      const completionSummary = hasFinalReply
        ? 'Pi session synced'
        : 'Pi ended after tool activity without a final text response.'
      const completionAction = hasFinalReply
        ? undefined
        : 'Pi ended without a final text response'
      setRuntimeStatus((previous) => {
        const startedAt = previous?.startedAt || Date.now()
        const terminalAt = Date.now()
        return {
          status: 'completed',
          statusLabel: previous?.status === 'failed' ? previous.statusLabel : completionLabel,
          lastAction: completionAction || previous?.lastAction || 'Response finished',
          startedAt,
          elapsedMs: terminalAt - startedAt,
          isWaitingForUser: false,
          isStalled: false,
          errorSummary: previous?.errorSummary,
          resultSummary: hasFinalReply ? previous?.resultSummary || completionSummary : completionSummary,
          runId: event.runId || activeRunIdRef.current || previous?.runId,
          messageId: msgIdRef.current || previous?.messageId,
          updatedAt: terminalAt,
          lastEventAt: terminalAt,
          terminalAt,
          sessionId: event.session?.sessionId || previous?.sessionId,
          sessionPath: event.session?.sessionPath || previous?.sessionPath,
          activeToolName: previous?.activeToolName,
          activeToolState: previous?.activeToolState,
          lastProgressMessage: previous?.lastProgressMessage,
          thinkingPreview: previous?.thinkingPreview,
          thinkingUpdatedAt: previous?.thinkingUpdatedAt,
          hasThinking: previous?.hasThinking,
        }
      })
      setRunActivity((previous) => createOrUpdateRunActivity(previous, {
        runId: terminalRunId || undefined,
        sessionId: event.session?.sessionId,
        sessionPath: event.session?.sessionPath,
        status: 'completed',
        statusLabel: completionLabel,
        lastAction: completionAction || previous?.lastAction || 'Response finished',
        activeToolName: previous?.activeToolName,
        activeToolState: previous?.activeToolState,
        stepState: 'done',
      }))
      if (event.session) {
        callbacksRef.current.onSessionSynced?.(event.session)
      } else {
        flushAssistantMessage(false)
      }
      lastTerminalRunIdRef.current = terminalRunId
      clearRunState()
      callbacksRef.current.onStreamEnd()
    } else if (event.type === 'artifact_created' && event.path) {
      const artifactPath = event.path
      setRuntimeStatus((previous) => {
        const startedAt = previous?.startedAt || Date.now()
        const artifactName = artifactPath.split(/[/\\]/).pop() || artifactPath
        return {
          status: previous?.status === 'failed' ? 'failed' : 'writing_file',
          statusLabel: previous?.status === 'failed' ? previous.statusLabel : 'Writing file',
          lastAction: 'Result file created',
          startedAt,
          elapsedMs: Date.now() - startedAt,
          isWaitingForUser: false,
          isStalled: false,
          errorSummary: previous?.errorSummary,
          resultSummary: `Created ${artifactName}`,
          runId: event.runId || activeRunIdRef.current || previous?.runId,
          messageId: msgIdRef.current || previous?.messageId,
          updatedAt: Date.now(),
          lastEventAt: Date.now(),
          terminalAt: undefined,
          sessionId: event.sessionId || previous?.sessionId,
          sessionPath: event.sessionPath || previous?.sessionPath,
          activeToolName: previous?.activeToolName,
          activeToolState: previous?.activeToolState,
          lastProgressMessage: `Created ${artifactName}`,
          thinkingPreview: previous?.thinkingPreview,
          thinkingUpdatedAt: previous?.thinkingUpdatedAt,
          hasThinking: previous?.hasThinking,
        }
      })
      setRunActivity((previous) => createOrUpdateRunActivity(previous, {
        runId: event.runId || activeRunIdRef.current || undefined,
        sessionId: event.sessionId,
        sessionPath: event.sessionPath,
        status: 'writing_file',
        statusLabel: 'Writing file',
        lastAction: 'Result file created',
        fileUpdates: [
          {
            path: artifactPath,
            label: artifactPath.split(/[/\\]/).pop() || artifactPath,
            kind: 'generated',
          },
        ],
        stepState: 'done',
      }))
      callbacksRef.current.onArtifactCreated?.({
        path: artifactPath,
        sessionId: event.sessionId,
        sessionPath: event.sessionPath,
      })
    } else if (event.type === 'error') {
      const currentMessageId = msgIdRef.current
      const terminalRunId = event.runId || activeRunIdRef.current || runtimeStatusRef.current?.runId || null
      setRuntimeStatus((previous) => {
        const startedAt = previous?.startedAt || Date.now()
        const terminalAt = Date.now()
        return {
          status: 'failed',
          statusLabel: 'Failed',
          lastAction: previous?.lastAction || 'Pi could not finish this request',
          startedAt,
          elapsedMs: terminalAt - startedAt,
          isWaitingForUser: false,
          isStalled: false,
          errorSummary: event.error || 'Unknown error',
          resultSummary: previous?.resultSummary,
          runId: terminalRunId || previous?.runId,
          messageId: currentMessageId || previous?.messageId,
          updatedAt: terminalAt,
          lastEventAt: terminalAt,
          terminalAt,
          sessionId: event.sessionId || previous?.sessionId,
          sessionPath: event.sessionPath || previous?.sessionPath,
          activeToolName: previous?.activeToolName,
          activeToolState: 'failed',
          lastProgressMessage: previous?.lastProgressMessage,
          thinkingPreview: previous?.thinkingPreview,
          thinkingUpdatedAt: previous?.thinkingUpdatedAt,
          hasThinking: previous?.hasThinking,
        }
      })
      setRunActivity((previous) => createOrUpdateRunActivity(previous, {
        runId: terminalRunId || undefined,
        sessionId: event.sessionId,
        sessionPath: event.sessionPath,
        status: 'failed',
        statusLabel: 'Failed',
        lastAction: event.error || 'Unknown error',
        activeToolName: previous?.activeToolName,
        activeToolState: 'failed',
        stepState: 'error',
      }))
      callbacksRef.current.onAssistantMessage({
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${event.error}`,
        timestamp: Date.now(),
        runId: terminalRunId || undefined,
        sessionId: event.sessionId || activeRunSessionIdRef.current || currentSessionIdRef.current,
        sessionPath: event.sessionPath || activeRunSessionPathRef.current || currentSessionPathRef.current,
      })
      lastTerminalRunIdRef.current = terminalRunId
      clearRunState()
      callbacksRef.current.onStreamEnd()
    }
  }, [appendThinkingPart, appendThinkingPreview, appendTokenDelta, appendToolCallPart, clearRunState, createOrUpdateRunActivity, ensureAssistantRun, flushAssistantMessage, markThinkingComplete, scheduleTokenFlush, setRunActivity, setRuntimeStatus, shouldThrottleLiveStatus, updateToolCallPart])

  const replayPendingRunEvents = useCallback((runId: string) => {
    const matching = pendingRunEventsRef.current.filter((event) => event.runId === runId)
    pendingRunEventsRef.current = pendingRunEventsRef.current.filter((event) => event.runId !== runId)

    matching.forEach(handleAgentEvent)
  }, [handleAgentEvent])

  useEffect(() => {
    const cleanup = window.piDesktop.onAgentEvent((event: AgentEvent) => {
      const activeSessionId = currentSessionIdRef.current
      const activeSessionPath = currentSessionPathRef.current
      const eventSessionId = getEventSessionId(event)
      const eventSessionPath = getEventSessionPath(event)
      const matchesActiveRun = Boolean(event.runId && activeRunIdRef.current && event.runId === activeRunIdRef.current)
      const isDifferentSession =
        activeSessionPath
          ? (
              eventSessionPath
                ? normalizeSessionPath(eventSessionPath) !== normalizeSessionPath(activeSessionPath)
                : Boolean(eventSessionId)
            )
          : Boolean(activeSessionId && eventSessionId && eventSessionId !== activeSessionId)

      if (isDifferentSession && !matchesActiveRun) {
        return
      }
      if (event.runId && !activeRunIdRef.current) {
        if (awaitingRunIdRef.current) {
          pendingRunEventsRef.current = [...pendingRunEventsRef.current.slice(-40), event]
          activeRunIdRef.current = event.runId
          replayPendingRunEvents(event.runId)
          return
        }
        if (lastTerminalRunIdRef.current && lastTerminalRunIdRef.current === event.runId) {
          return
        }
        activeRunIdRef.current = event.runId
        lastTerminalRunIdRef.current = null
        handleAgentEvent(event)
        return
      }
      if (event.runId && activeRunIdRef.current !== event.runId) {
        return
      }

      handleAgentEvent(event)
    })
    return () => {
      if (pendingTokenFlushRef.current !== null) {
        window.clearTimeout(pendingTokenFlushRef.current)
      }
      if (pendingStatusFlushRef.current !== null) {
        window.clearTimeout(pendingStatusFlushRef.current)
      }
      cleanup()
    }
  }, [handleAgentEvent])

  useEffect(() => {
    const interval = window.setInterval(() => {
      const status = runtimeStatusRef.current
      if (!status?.startedAt) return
      if (status.status === 'completed' || status.status === 'failed') return

      const now = Date.now()
      const idleFor = now - lastRuntimeUpdateRef.current
      if (idleFor < 12000) {
        return
      }

      setRuntimeStatus({
        ...status,
        elapsedMs: now - status.startedAt,
        isStalled: true,
        lastAction: status.isWaitingForUser ? status.lastAction : 'No new output recently',
      })
    }, 1000)

    return () => window.clearInterval(interval)
  }, [setRuntimeStatus])

  const sendMessage = useCallback(
    async (text: string) => {
      try {
        awaitingRunIdRef.current = true
        lastTerminalRunIdRef.current = null
        activeRunSessionIdRef.current = currentSessionIdRef.current
        activeRunSessionPathRef.current = currentSessionPathRef.current
        const response = await window.piDesktop.chat.send({
          text,
          cwd: currentDirRef.current || undefined,
          modelId: currentModel,
          sessionId: currentSessionId,
          sessionPath: currentSessionPath,
          thinkingLevel,
        })
        if (!response.success) {
          awaitingRunIdRef.current = false
          callbacksRef.current.onAssistantMessage({
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: `Error: ${response.error || 'Failed to send'}`,
            timestamp: Date.now(),
          })
          callbacksRef.current.onStreamEnd()
        } else if (response.data && typeof response.data === 'object' && 'runId' in response.data) {
          const runId = String((response.data as { runId?: unknown }).runId || '')
          if (runId) {
            activeRunIdRef.current = runId
            const responseSession = response.data as { sessionId?: unknown; sessionPath?: unknown }
            if (typeof responseSession.sessionId === 'string') activeRunSessionIdRef.current = responseSession.sessionId
            if (typeof responseSession.sessionPath === 'string') activeRunSessionPathRef.current = responseSession.sessionPath
            replayPendingRunEvents(runId)
          }
          awaitingRunIdRef.current = false
        } else {
          awaitingRunIdRef.current = false
        }
        return response
      } catch (err) {
        awaitingRunIdRef.current = false
        callbacksRef.current.onAssistantMessage({
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
          timestamp: Date.now(),
        })
        callbacksRef.current.onStreamEnd()
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        }
      }
    },
    [currentModel, currentSessionId, currentSessionPath, thinkingLevel, replayPendingRunEvents],
  )

  return { sendMessage }
}
