import { useCallback, useEffect, useRef } from 'react'
import type { AgentEvent, Message, MessagePart, RuntimeStatus, ToolCall } from '../types/chat'

function normalizeSessionPath(path?: string): string {
  return (path || '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
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

interface UseChatIPCOptions {
  onAssistantMessage: (message: Message) => void
  onStreamStart: () => void
  onStreamEnd: () => void
  onRuntimeStatus?: (status: RuntimeStatus | ((previous: RuntimeStatus | null) => RuntimeStatus | null)) => void
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
  const currentSessionIdRef = useRef(currentSessionId)
  const currentSessionPathRef = useRef(currentSessionPath)
  const currentDirRef = useRef(currentDir)
  const lastRuntimeUpdateRef = useRef<number>(0)
  const runtimeStatusRef = useRef<RuntimeStatus | null>(null)
  const pendingTokenFlushRef = useRef<number | null>(null)
  const pendingStatusFlushRef = useRef<number | null>(null)
  const pendingStatusRef = useRef<RuntimeStatus | null>(null)
  const pendingRunEventsRef = useRef<AgentEvent[]>([])
  const awaitingRunIdRef = useRef(false)
  const promoteQueuedRunRef = useRef<number | null>(null)
  const callbacksRef = useRef({
    onAssistantMessage,
    onStreamStart,
    onStreamEnd,
    onRuntimeStatus,
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
      onArtifactCreated,
      onSessionSynced,
    }
  }, [onArtifactCreated, onAssistantMessage, onRuntimeStatus, onSessionSynced, onStreamEnd, onStreamStart])

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
    const existingIndex = nextParts.findIndex((part) => part.type === 'thinking')
    if (existingIndex >= 0) {
      const existing = nextParts[existingIndex]
      nextParts[existingIndex] = {
        ...existing,
        text: `${existing.text}${text}`,
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
  }, [])

  const handleAgentEvent = useCallback((event: AgentEvent) => {
    if (event.type === 'status') {
      const startedAt = event.startedAt || runtimeStatusRef.current?.startedAt || Date.now()
      setRuntimeStatus((previous) => ({
        ...previous,
        ...event,
        startedAt,
        elapsedMs: Date.now() - startedAt,
        isStalled: false,
        runId: event.runId || activeRunIdRef.current || previous?.runId,
        updatedAt: event.updatedAt || Date.now(),
      }), true)
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
      scheduleTokenFlush()
    } else if (event.type === 'tool_started') {
      ensureAssistantRun(event.runId)
      toolCallsRef.current = [
        ...toolCallsRef.current,
        {
          id: event.toolCallId || `tool-${Date.now()}`,
          toolCallId: event.toolCallId,
          name: event.toolName || 'tool',
          args: typeof event.args === 'string' ? event.args : JSON.stringify(event.args || {}),
          status: 'running',
        },
      ]
      scheduleTokenFlush()
    } else if (event.type === 'tool_finished' || event.type === 'tool_failed') {
      toolCallsRef.current = toolCallsRef.current.map((toolCall, index, array) => {
        const targetIndex = [...array].reverse().findIndex((entry) => {
          if (event.toolCallId) return (entry.toolCallId || entry.id) === event.toolCallId
          return entry.name === event.toolName && entry.status === 'running'
        })
        const resolvedIndex = targetIndex === -1 ? -1 : array.length - 1 - targetIndex
        if (index !== resolvedIndex) return toolCall
        return {
          ...toolCall,
          status: event.type === 'tool_failed' ? 'error' : 'done',
        }
      })
      scheduleTokenFlush()
    } else if (event.type === 'done') {
      markThinkingComplete()
      flushAssistantMessage(false)
      setRuntimeStatus((previous) => {
        const startedAt = previous?.startedAt || Date.now()
        return {
          status: 'completed',
          statusLabel: previous?.status === 'failed' ? previous.statusLabel : 'Completed',
          lastAction: previous?.lastAction || 'Response finished',
          startedAt,
          elapsedMs: Date.now() - startedAt,
          isWaitingForUser: false,
          isStalled: false,
          errorSummary: previous?.errorSummary,
          resultSummary: previous?.resultSummary || 'Pi session synced',
          runId: event.runId || activeRunIdRef.current || previous?.runId,
          messageId: msgIdRef.current || previous?.messageId,
          updatedAt: Date.now(),
          sessionId: event.session?.sessionId || previous?.sessionId,
          sessionPath: event.session?.sessionPath || previous?.sessionPath,
        }
      })
      if (event.session) {
        callbacksRef.current.onSessionSynced?.(event.session)
      } else {
        flushAssistantMessage(false)
      }
      clearRunState()
      callbacksRef.current.onStreamEnd()
    } else if (event.type === 'artifact_created' && event.path) {
      setRuntimeStatus((previous) => {
        const startedAt = previous?.startedAt || Date.now()
        const artifactName = event.path?.split(/[/\\]/).pop() || event.path
        return {
          status: previous?.status === 'failed' ? 'failed' : 'completed',
          statusLabel: previous?.status === 'failed' ? previous.statusLabel : 'Completed',
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
          sessionId: event.sessionId || previous?.sessionId,
          sessionPath: event.sessionPath || previous?.sessionPath,
        }
      })
      callbacksRef.current.onArtifactCreated?.({
        path: event.path,
        sessionId: event.sessionId,
        sessionPath: event.sessionPath,
      })
    } else if (event.type === 'error') {
      const currentMessageId = msgIdRef.current
      setRuntimeStatus((previous) => {
        const startedAt = previous?.startedAt || Date.now()
        return {
          status: 'failed',
          statusLabel: 'Failed',
          lastAction: previous?.lastAction || 'Pi could not finish this request',
          startedAt,
          elapsedMs: Date.now() - startedAt,
          isWaitingForUser: false,
          isStalled: false,
          errorSummary: event.error || 'Unknown error',
          resultSummary: previous?.resultSummary,
          runId: event.runId || activeRunIdRef.current || previous?.runId,
          messageId: currentMessageId || previous?.messageId,
          updatedAt: Date.now(),
          sessionId: event.sessionId || previous?.sessionId,
          sessionPath: event.sessionPath || previous?.sessionPath,
        }
      })
      callbacksRef.current.onAssistantMessage({
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${event.error}`,
        timestamp: Date.now(),
        runId: event.runId || activeRunIdRef.current || undefined,
      })
      clearRunState()
      callbacksRef.current.onStreamEnd()
    }
  }, [appendThinkingPart, appendTokenDelta, clearRunState, ensureAssistantRun, flushAssistantMessage, markThinkingComplete, scheduleTokenFlush, setRuntimeStatus])

  const replayPendingRunEvents = useCallback((runId: string) => {
    const matching = pendingRunEventsRef.current.filter((event) => event.runId === runId)
    pendingRunEventsRef.current = pendingRunEventsRef.current.filter((event) => event.runId !== runId)

    matching.forEach(handleAgentEvent)
  }, [handleAgentEvent])

  const scheduleQueuedRunPromotion = useCallback(() => {
    if (!awaitingRunIdRef.current || promoteQueuedRunRef.current !== null) return
    promoteQueuedRunRef.current = window.setTimeout(() => {
      promoteQueuedRunRef.current = null
      if (activeRunIdRef.current || !awaitingRunIdRef.current) return
      const candidate = [...pendingRunEventsRef.current].reverse().find((event) => event.runId)?.runId
      if (!candidate) return
      activeRunIdRef.current = candidate
      replayPendingRunEvents(candidate)
    }, 0)
  }, [replayPendingRunEvents])

  useEffect(() => {
    const cleanup = window.piDesktop.onAgentEvent((event: AgentEvent) => {
      const activeSessionId = currentSessionIdRef.current
      const activeSessionPath = currentSessionPathRef.current
      const eventSessionId = getEventSessionId(event)
      const eventSessionPath = getEventSessionPath(event)
      const isDifferentSession =
        activeSessionPath && eventSessionPath
          ? normalizeSessionPath(eventSessionPath) !== normalizeSessionPath(activeSessionPath)
          : Boolean(activeSessionId && eventSessionId && eventSessionId !== activeSessionId)

      if (isDifferentSession) {
        return
      }
      if (event.runId && !activeRunIdRef.current) {
        pendingRunEventsRef.current = [...pendingRunEventsRef.current.slice(-40), event]
        if (awaitingRunIdRef.current) {
          activeRunIdRef.current = event.runId
          replayPendingRunEvents(event.runId)
          return
        }
        scheduleQueuedRunPromotion()
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
      if (promoteQueuedRunRef.current !== null) {
        window.clearTimeout(promoteQueuedRunRef.current)
      }
      cleanup()
    }
  }, [handleAgentEvent, scheduleQueuedRunPromotion])

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
        lastAction: status.isWaitingForUser ? status.lastAction : 'Still processing without new output',
      })
    }, 1000)

    return () => window.clearInterval(interval)
  }, [setRuntimeStatus])

  const sendMessage = useCallback(
    async (text: string) => {
      try {
        awaitingRunIdRef.current = true
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
