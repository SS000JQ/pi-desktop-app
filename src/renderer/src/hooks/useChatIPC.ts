import { useCallback, useEffect, useRef } from 'react'
import type { AgentEvent, Message, RuntimeStatus, ToolCall } from '../types/chat'

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
  const msgIdRef = useRef('')
  const toolCallsRef = useRef<ToolCall[]>([])
  const currentSessionIdRef = useRef(currentSessionId)
  const currentSessionPathRef = useRef(currentSessionPath)
  const currentDirRef = useRef(currentDir)
  const lastRuntimeUpdateRef = useRef<number>(0)
  const runtimeStatusRef = useRef<RuntimeStatus | null>(null)

  useEffect(() => {
    currentSessionIdRef.current = currentSessionId
    currentSessionPathRef.current = currentSessionPath
    currentDirRef.current = currentDir
  }, [currentDir, currentSessionId, currentSessionPath])

  const setRuntimeStatus = useCallback((next: RuntimeStatus | ((previous: RuntimeStatus | null) => RuntimeStatus | null)) => {
    const resolved = typeof next === 'function' ? next(runtimeStatusRef.current) : next
    runtimeStatusRef.current = resolved
    if (resolved) {
      lastRuntimeUpdateRef.current = Date.now()
      onRuntimeStatus?.(resolved)
    } else {
      onRuntimeStatus?.(() => null)
    }
  }, [onRuntimeStatus])

  useEffect(() => {
    const cleanup = window.piDesktop.onAgentEvent((event: AgentEvent) => {
      const activeSessionId = currentSessionIdRef.current
      const activeSessionPath = currentSessionPathRef.current
      const isDifferentSession =
        (activeSessionId && event.sessionId && event.sessionId !== activeSessionId)
        || (activeSessionPath && event.sessionPath && event.sessionPath !== activeSessionPath)

      if (isDifferentSession) {
        return
      }

      if (event.type === 'status') {
        const startedAt = event.startedAt || runtimeStatusRef.current?.startedAt || Date.now()
        setRuntimeStatus((previous) => ({
          ...previous,
          ...event,
          startedAt,
          elapsedMs: Date.now() - startedAt,
          isStalled: false,
        }))
        if (event.status !== 'completed' && event.status !== 'failed' && !msgIdRef.current) {
          onStreamStart()
        }
      } else if (event.type === 'token') {
        if (!msgIdRef.current) {
          msgIdRef.current = `msg-${Date.now()}`
          accumulatedRef.current = ''
          toolCallsRef.current = []
          onStreamStart()
        }
        accumulatedRef.current += event.text
        onAssistantMessage({
          id: msgIdRef.current,
          role: 'assistant',
          content: accumulatedRef.current,
          timestamp: Date.now(),
          isStreaming: true,
          toolCalls: toolCallsRef.current,
        })
      } else if (event.type === 'tool_started') {
        if (!msgIdRef.current) {
          msgIdRef.current = `msg-${Date.now()}`
          accumulatedRef.current = ''
          toolCallsRef.current = []
          onStreamStart()
        }
        toolCallsRef.current = [
          ...toolCallsRef.current,
          {
            id: `tool-${Date.now()}`,
            name: event.toolName || 'tool',
            args: typeof event.args === 'string' ? event.args : JSON.stringify(event.args || {}),
            status: 'running',
          },
        ]
        onAssistantMessage({
          id: msgIdRef.current,
          role: 'assistant',
          content: accumulatedRef.current,
          timestamp: Date.now(),
          isStreaming: true,
          toolCalls: toolCallsRef.current,
        })
      } else if (event.type === 'tool_finished' || event.type === 'tool_failed') {
        toolCallsRef.current = toolCallsRef.current.map((toolCall, index, array) => {
          const targetIndex = [...array].reverse().findIndex((entry) => entry.name === event.toolName && entry.status === 'running')
          const resolvedIndex = targetIndex === -1 ? -1 : array.length - 1 - targetIndex
          if (index !== resolvedIndex) return toolCall
          return {
            ...toolCall,
            status: event.type === 'tool_failed' ? 'error' : 'done',
          }
        })
        onAssistantMessage({
          id: msgIdRef.current || `msg-${Date.now()}`,
          role: 'assistant',
          content: accumulatedRef.current,
          timestamp: Date.now(),
          isStreaming: true,
          toolCalls: toolCallsRef.current,
        })
      } else if (event.type === 'done') {
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
            sessionId: event.session?.sessionId || previous?.sessionId,
            sessionPath: event.session?.sessionPath || previous?.sessionPath,
          }
        })
        if (event.session) {
          onSessionSynced?.(event.session)
        } else {
          onAssistantMessage({
            id: msgIdRef.current,
            role: 'assistant',
            content: accumulatedRef.current,
            timestamp: Date.now(),
            isStreaming: false,
            toolCalls: toolCallsRef.current,
          })
        }
        msgIdRef.current = ''
        accumulatedRef.current = ''
        toolCallsRef.current = []
        onStreamEnd()
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
            sessionId: event.sessionId || previous?.sessionId,
            sessionPath: event.sessionPath || previous?.sessionPath,
          }
        })
        onArtifactCreated?.({
          path: event.path,
          sessionId: event.sessionId,
          sessionPath: event.sessionPath,
        })
      } else if (event.type === 'error') {
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
            sessionId: event.sessionId || previous?.sessionId,
            sessionPath: event.sessionPath || previous?.sessionPath,
          }
        })
        onAssistantMessage({
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `Error: ${event.error}`,
          timestamp: Date.now(),
        })
        msgIdRef.current = ''
        accumulatedRef.current = ''
        toolCallsRef.current = []
        onStreamEnd()
      }
    })
    return cleanup
  }, [onArtifactCreated, onAssistantMessage, onSessionSynced, onStreamStart, onStreamEnd, setRuntimeStatus])

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
        const response = await window.piDesktop.chat.send({
          text,
          cwd: currentDirRef.current || undefined,
          modelId: currentModel,
          sessionId: currentSessionId,
          sessionPath: currentSessionPath,
          thinkingLevel,
        })
        if (!response.success) {
          onAssistantMessage({
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: `Error: ${response.error || 'Failed to send'}`,
            timestamp: Date.now(),
          })
          onStreamEnd()
        }
        return response
      } catch (err) {
        onAssistantMessage({
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
          timestamp: Date.now(),
        })
        onStreamEnd()
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        }
      }
    },
    [currentModel, currentSessionId, currentSessionPath, thinkingLevel, onAssistantMessage, onStreamEnd],
  )

  return { sendMessage }
}
