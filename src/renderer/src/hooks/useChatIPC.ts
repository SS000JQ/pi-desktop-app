import { useCallback, useEffect, useRef } from 'react'
import type { Message, ToolCall } from '../types/chat'

interface UseChatIPCOptions {
  onAssistantMessage: (message: Message) => void
  onStreamStart: () => void
  onStreamEnd: () => void
  onArtifactCreated?: (path: string) => void
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
  onArtifactCreated,
  onSessionSynced,
  currentModel = 'openai/gpt-4',
  currentSessionId,
  currentSessionPath,
  thinkingLevel = 'medium',
}: UseChatIPCOptions & {
  currentModel?: string
  currentSessionId?: string
  currentSessionPath?: string
  thinkingLevel?: string
}) {
  const accumulatedRef = useRef('')
  const msgIdRef = useRef('')
  const toolCallsRef = useRef<ToolCall[]>([])
  const currentSessionIdRef = useRef(currentSessionId)
  const currentSessionPathRef = useRef(currentSessionPath)

  useEffect(() => {
    currentSessionIdRef.current = currentSessionId
    currentSessionPathRef.current = currentSessionPath
  }, [currentSessionId, currentSessionPath])

  useEffect(() => {
    const cleanup = window.piDesktop.onAgentEvent((event: any) => {
      const activeSessionId = currentSessionIdRef.current
      const activeSessionPath = currentSessionPathRef.current
      const isDifferentSession =
        (activeSessionId && event.sessionId && event.sessionId !== activeSessionId)
        || (activeSessionPath && event.sessionPath && event.sessionPath !== activeSessionPath)

      if (isDifferentSession) {
        return
      }

      if (event.type === 'token') {
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
        onArtifactCreated?.(event.path)
      } else if (event.type === 'error') {
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
  }, [onArtifactCreated, onAssistantMessage, onSessionSynced, onStreamStart, onStreamEnd])

  const sendMessage = useCallback(
    async (text: string) => {
      try {
        const response = await window.piDesktop.chat.send({
          text,
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
