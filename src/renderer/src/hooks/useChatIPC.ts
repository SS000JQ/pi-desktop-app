import { useCallback, useEffect, useRef } from 'react'
import type { Message } from '../types/chat'

interface UseChatIPCOptions {
  onAssistantMessage: (message: Message) => void
  onStreamStart: () => void
  onStreamEnd: () => void
}

export function useChatIPC({
  onAssistantMessage,
  onStreamStart,
  onStreamEnd,
}: UseChatIPCOptions) {
  const accumulatedRef = useRef('')
  const msgIdRef = useRef('')

  useEffect(() => {
    const cleanup = window.piDesktop.onAgentEvent((event: any) => {
      if (event.type === 'token') {
        if (!msgIdRef.current) {
          msgIdRef.current = `msg-${Date.now()}`
          accumulatedRef.current = ''
          onStreamStart()
        }
        accumulatedRef.current += event.text
        onAssistantMessage({
          id: msgIdRef.current,
          role: 'assistant',
          content: accumulatedRef.current,
          timestamp: Date.now(),
          isStreaming: true,
        })
      } else if (event.type === 'done') {
        onAssistantMessage({
          id: msgIdRef.current,
          role: 'assistant',
          content: accumulatedRef.current,
          timestamp: Date.now(),
          isStreaming: false,
        })
        msgIdRef.current = ''
        accumulatedRef.current = ''
        onStreamEnd()
      } else if (event.type === 'error') {
        onAssistantMessage({
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `Error: ${event.error}`,
          timestamp: Date.now(),
        })
        msgIdRef.current = ''
        accumulatedRef.current = ''
        onStreamEnd()
      }
    })
    return cleanup
  }, [onAssistantMessage, onStreamStart, onStreamEnd])

  const sendMessage = useCallback(
    async (text: string) => {
      try {
        const response = await window.piDesktop.chat.send(text)
        if (!response.success) {
          onAssistantMessage({
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: `Error: ${response.error || 'Failed to send'}`,
            timestamp: Date.now(),
          })
          onStreamEnd()
        }
      } catch (err) {
        onAssistantMessage({
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
          timestamp: Date.now(),
        })
        onStreamEnd()
      }
    },
    [onAssistantMessage, onStreamEnd],
  )

  return { sendMessage }
}
