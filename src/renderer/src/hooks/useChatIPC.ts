import { useCallback } from 'react'
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
  // Phase 2: Uses mock IPC. Phase 3 replaces with real AgentSession.
  const sendMessage = useCallback(async (text: string) => {
    onStreamStart()

    try {
      const response = await window.piDesktop.chat.send(text)
      if (!response.success) {
        // Handle error
        onAssistantMessage({
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: `Error: ${response.error || 'Failed to send message'}`,
          timestamp: Date.now(),
        })
        onStreamEnd()
        return
      }

      // Mock response for Phase 2 — Phase 3 streams real response through AGENT_EVENT
      setTimeout(() => {
        const assistantMsg: Message = {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: 'This is a mock response. Phase 3 connects to Pi AgentSession for real streaming.',
          timestamp: Date.now(),
          toolCalls: [
            { id: `tc-${Date.now()}`, name: 'web_search', args: '("query")', status: 'done', duration: '0.8s' }
          ],
        }
        onAssistantMessage(assistantMsg)
        onStreamEnd()
      }, 800)
    } catch (err) {
      onAssistantMessage({
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
        timestamp: Date.now(),
      })
      onStreamEnd()
    }
  }, [onAssistantMessage, onStreamStart, onStreamEnd])

  return { sendMessage }
}
