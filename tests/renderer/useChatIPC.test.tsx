import { act, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useChatIPC } from '../../src/renderer/src/hooks/useChatIPC'
import type { AgentEvent, Message, RuntimeStatus } from '../../src/renderer/src/types/chat'

function ChatIPCHost({
  onStreamEnd = vi.fn(),
  onArtifactCreated = vi.fn(),
}: {
  onStreamEnd?: () => void
  onArtifactCreated?: (payload: { path: string; sessionId?: string; sessionPath?: string }) => void
} = {}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [status, setStatus] = useState<RuntimeStatus | null>(null)
  const { sendMessage } = useChatIPC({
    currentDir: 'D:/PI/app',
    currentModel: 'openai/gpt-4o-mini',
    currentSessionId: 'session-1',
    currentSessionPath: 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl',
    onAssistantMessage: (message) => {
      setMessages((previous) => {
        const index = previous.findIndex((entry) => entry.id === message.id)
        if (index >= 0) {
          const next = [...previous]
          next[index] = message
          return next
        }
        return [...previous, message]
      })
    },
    onStreamStart: vi.fn(),
    onStreamEnd,
    onRuntimeStatus: (next) => {
      setStatus((previous) => (typeof next === 'function' ? next(previous) : next))
    },
    onArtifactCreated,
  })

  const assistant = messages.find((message) => message.role === 'assistant')
  const thinking = assistant?.parts?.find((part) => part.type === 'thinking')
  const text = assistant?.parts?.filter((part) => part.type === 'text').map((part) => part.text).join('')

  return (
    <div>
      <button type="button" onClick={() => { void sendMessage('question') }}>send</button>
      <div data-testid="content">{assistant?.content || ''}</div>
      <div data-testid="thinking">{thinking?.text || ''}</div>
      <div data-testid="thinking-state">{thinking?.state || ''}</div>
      <div data-testid="text">{text || ''}</div>
      <div data-testid="status">{status?.lastAction || ''}</div>
    </div>
  )
}

describe('useChatIPC', () => {
  it('keeps live thinking deltas in a collapsed part instead of the final answer text', async () => {
    vi.useFakeTimers()
    let agentCallback: ((event: AgentEvent) => void) | null = null
    window.piDesktop = {
      chat: {
        send: vi.fn().mockResolvedValue({
          success: true,
          data: {
            sessionId: 'session-1',
            sessionPath: 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl',
            createdNewSession: false,
            runId: 'run-1',
          },
        }),
        abort: vi.fn().mockResolvedValue({ success: true }),
      },
      onAgentEvent: vi.fn((callback) => {
        agentCallback = callback as (event: AgentEvent) => void
        return () => {
          agentCallback = null
        }
      }),
    } as Partial<Window['piDesktop']> as Window['piDesktop']

    render(<ChatIPCHost />)

    await act(async () => {
      screen.getByRole('button', { name: 'send' }).click()
    })

    await act(async () => {
      await Promise.resolve()
    })
    expect(window.piDesktop.chat.send).toHaveBeenCalled()

    await act(async () => {
      agentCallback?.({
        type: 'thinking_delta',
        text: 'checking files',
        runId: 'run-1',
        sessionId: 'session-1',
        sessionPath: 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl',
      } as AgentEvent)
      agentCallback?.({
        type: 'thinking_delta',
        text: ' and comparing state',
        runId: 'run-1',
        sessionId: 'session-1',
        sessionPath: 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl',
      } as AgentEvent)
      agentCallback?.({
        type: 'token',
        text: 'Final answer',
        runId: 'run-1',
        sessionId: 'session-1',
        sessionPath: 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl',
      })
      vi.advanceTimersByTime(80)
    })

    expect(screen.getByTestId('thinking').textContent).toBe('checking files and comparing state')
    expect(screen.getByTestId('thinking-state').textContent).toBe('streaming')
    expect(screen.getByTestId('text').textContent).toBe('Final answer')
    expect(screen.getByTestId('content').textContent).toBe('Final answer')

    await act(async () => {
      agentCallback?.({
        type: 'done',
        runId: 'run-1',
        sessionId: 'session-1',
        sessionPath: 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl',
      })
      vi.advanceTimersByTime(80)
    })

    expect(screen.getByTestId('thinking-state').textContent).toBe('complete')
    expect(screen.getByTestId('content').textContent).toBe('Final answer')
    vi.useRealTimers()
  })

  it('parses tagged thinking from plain token streams as a fallback', async () => {
    vi.useFakeTimers()
    let agentCallback: ((event: AgentEvent) => void) | null = null
    window.piDesktop = {
      chat: {
        send: vi.fn().mockResolvedValue({
          success: true,
          data: {
            sessionId: 'session-1',
            sessionPath: 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl',
            createdNewSession: false,
            runId: 'run-2',
          },
        }),
        abort: vi.fn().mockResolvedValue({ success: true }),
      },
      onAgentEvent: vi.fn((callback) => {
        agentCallback = callback as (event: AgentEvent) => void
        return () => {
          agentCallback = null
        }
      }),
    } as Partial<Window['piDesktop']> as Window['piDesktop']

    render(<ChatIPCHost />)

    await act(async () => {
      screen.getByRole('button', { name: 'send' }).click()
      await Promise.resolve()
    })

    await act(async () => {
      agentCallback?.({
        type: 'token',
        text: '<thinking>hidden reasoning</thinking>Visible answer',
        runId: 'run-2',
        sessionId: 'session-1',
        sessionPath: 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl',
      })
      vi.advanceTimersByTime(80)
    })

    expect(screen.getByTestId('thinking').textContent).toBe('hidden reasoning')
    expect(screen.getByTestId('text').textContent).toBe('Visible answer')
    expect(screen.getByTestId('content').textContent).toBe('Visible answer')
    vi.useRealTimers()
  })

  it('replays a queued done event that arrives before chat.send returns the run id', async () => {
    vi.useFakeTimers()
    let agentCallback: ((event: AgentEvent) => void) | null = null
    let resolveSend: (value: unknown) => void = () => {}
    const streamEnd = vi.fn()
    window.piDesktop = {
      chat: {
        send: vi.fn().mockReturnValue(new Promise((resolve) => { resolveSend = resolve })),
        abort: vi.fn().mockResolvedValue({ success: true }),
      },
      onAgentEvent: vi.fn((callback) => {
        agentCallback = callback as (event: AgentEvent) => void
        return () => {
          agentCallback = null
        }
      }),
    } as Partial<Window['piDesktop']> as Window['piDesktop']

    render(<ChatIPCHost onStreamEnd={streamEnd} />)

    await act(async () => {
      screen.getByRole('button', { name: 'send' }).click()
      await Promise.resolve()
    })

    await act(async () => {
      agentCallback?.({
        type: 'thinking_delta',
        text: 'fast reasoning',
        runId: 'run-queued-done',
        sessionId: 'session-1',
        sessionPath: 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl',
      } as AgentEvent)
      agentCallback?.({
        type: 'done',
        runId: 'run-queued-done',
        sessionId: 'session-1',
        sessionPath: 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl',
      })
      resolveSend({
        success: true,
        data: {
          sessionId: 'session-1',
          sessionPath: 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl',
          createdNewSession: false,
          runId: 'run-queued-done',
        },
      })
      await Promise.resolve()
      vi.advanceTimersByTime(80)
    })

    expect(screen.getByTestId('thinking').textContent).toBe('fast reasoning')
    expect(screen.getByTestId('thinking-state').textContent).toBe('complete')
    expect(streamEnd).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('promotes the first matching run event immediately while chat.send is still pending', async () => {
    vi.useFakeTimers()
    let agentCallback: ((event: AgentEvent) => void) | null = null
    window.piDesktop = {
      chat: {
        send: vi.fn().mockReturnValue(new Promise(() => {})),
        abort: vi.fn().mockResolvedValue({ success: true }),
      },
      onAgentEvent: vi.fn((callback) => {
        agentCallback = callback as (event: AgentEvent) => void
        return () => {
          agentCallback = null
        }
      }),
    } as Partial<Window['piDesktop']> as Window['piDesktop']

    render(<ChatIPCHost />)

    await act(async () => {
      screen.getByRole('button', { name: 'send' }).click()
      await Promise.resolve()
    })

    await act(async () => {
      agentCallback?.({
        type: 'status',
        status: 'processing',
        statusLabel: 'Processing',
        lastAction: 'Pi has started working on your request',
        isWaitingForUser: false,
        runId: 'run-live-status',
        sessionId: 'session-1',
        sessionPath: 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl',
      })
    })

    expect(screen.getByTestId('status').textContent).toBe('Pi has started working on your request')
    vi.useRealTimers()
  })

  it('accepts current-session events when Windows path separators or casing differ', async () => {
    let agentCallback: ((event: AgentEvent) => void) | null = null
    window.piDesktop = {
      chat: {
        send: vi.fn().mockResolvedValue({
          success: true,
          data: {
            sessionId: 'session-1',
            sessionPath: 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl',
            createdNewSession: false,
            runId: 'run-path-normalized',
          },
        }),
        abort: vi.fn().mockResolvedValue({ success: true }),
      },
      onAgentEvent: vi.fn((callback) => {
        agentCallback = callback as (event: AgentEvent) => void
        return () => {
          agentCallback = null
        }
      }),
    } as Partial<Window['piDesktop']> as Window['piDesktop']

    render(<ChatIPCHost />)

    await act(async () => {
      agentCallback?.({
        type: 'status',
        status: 'reading_file',
        statusLabel: 'Reading files',
        lastAction: 'Reading normalized session path',
        isWaitingForUser: false,
        sessionId: 'session-1',
        sessionPath: 'c:\\Users\\test\\.pi\\agent\\sessions\\project\\session-1.jsonl',
      })
    })

    expect(screen.getByTestId('status').textContent).toBe('Reading normalized session path')
  })

  it('replays a queued error event that arrives before chat.send returns the run id', async () => {
    vi.useFakeTimers()
    let agentCallback: ((event: AgentEvent) => void) | null = null
    let resolveSend: (value: unknown) => void = () => {}
    const streamEnd = vi.fn()
    window.piDesktop = {
      chat: {
        send: vi.fn().mockReturnValue(new Promise((resolve) => { resolveSend = resolve })),
        abort: vi.fn().mockResolvedValue({ success: true }),
      },
      onAgentEvent: vi.fn((callback) => {
        agentCallback = callback as (event: AgentEvent) => void
        return () => {
          agentCallback = null
        }
      }),
    } as Partial<Window['piDesktop']> as Window['piDesktop']

    render(<ChatIPCHost onStreamEnd={streamEnd} />)

    await act(async () => {
      screen.getByRole('button', { name: 'send' }).click()
      await Promise.resolve()
    })

    await act(async () => {
      agentCallback?.({
        type: 'error',
        error: 'Pi failed quickly',
        runId: 'run-queued-error',
        sessionId: 'session-1',
        sessionPath: 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl',
      })
      resolveSend({
        success: true,
        data: {
          sessionId: 'session-1',
          sessionPath: 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl',
          createdNewSession: false,
          runId: 'run-queued-error',
        },
      })
      await Promise.resolve()
      vi.advanceTimersByTime(80)
    })

    expect(screen.getByText('Error: Pi failed quickly')).toBeTruthy()
    expect(streamEnd).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('replays a queued artifact event that arrives before chat.send returns the run id', async () => {
    vi.useFakeTimers()
    let agentCallback: ((event: AgentEvent) => void) | null = null
    let resolveSend: (value: unknown) => void = () => {}
    const artifactCreated = vi.fn()
    window.piDesktop = {
      chat: {
        send: vi.fn().mockReturnValue(new Promise((resolve) => { resolveSend = resolve })),
        abort: vi.fn().mockResolvedValue({ success: true }),
      },
      onAgentEvent: vi.fn((callback) => {
        agentCallback = callback as (event: AgentEvent) => void
        return () => {
          agentCallback = null
        }
      }),
    } as Partial<Window['piDesktop']> as Window['piDesktop']

    render(<ChatIPCHost onArtifactCreated={artifactCreated} />)

    await act(async () => {
      screen.getByRole('button', { name: 'send' }).click()
      await Promise.resolve()
    })

    await act(async () => {
      agentCallback?.({
        type: 'artifact_created',
        path: 'D:/PI/app/reports/result.md',
        runId: 'run-queued-artifact',
        sessionId: 'session-1',
        sessionPath: 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl',
      })
      resolveSend({
        success: true,
        data: {
          sessionId: 'session-1',
          sessionPath: 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl',
          createdNewSession: false,
          runId: 'run-queued-artifact',
        },
      })
      await Promise.resolve()
      vi.advanceTimersByTime(80)
    })

    expect(artifactCreated).toHaveBeenCalledWith({
      path: 'D:/PI/app/reports/result.md',
      sessionId: 'session-1',
      sessionPath: 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl',
    })
    expect(screen.getByTestId('status').textContent).toBe('Result file created')
    vi.useRealTimers()
  })
})
