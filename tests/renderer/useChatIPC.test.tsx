import { act, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useChatIPC } from '../../src/renderer/src/hooks/useChatIPC'
import type { AgentEvent, Message, RuntimeStatus } from '../../src/renderer/src/types/chat'

function ChatIPCHost({
  onStreamEnd = vi.fn(),
  onArtifactCreated = vi.fn(),
  currentSessionId = 'session-1',
  currentSessionPath = 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl',
}: {
  onStreamEnd?: () => void
  onArtifactCreated?: (payload: { path: string; sessionId?: string; sessionPath?: string }) => void
  currentSessionId?: string
  currentSessionPath?: string
} = {}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [status, setStatus] = useState<RuntimeStatus | null>(null)
  const { sendMessage } = useChatIPC({
    currentDir: 'D:/PI/app',
    currentModel: 'openai/gpt-4o-mini',
    currentSessionId,
    currentSessionPath,
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
  const toolSummary = assistant?.toolCalls?.map((tool) => `${tool.name}:${tool.status}`).join('|') || ''
  const partOrder = assistant?.parts?.map((part) => {
    if (part.type === 'thinking') return `thinking:${part.text}`
    if (part.type === 'toolCall') return `tool:${part.toolCall?.name || ''}:${part.toolCall?.status || ''}`
    if (part.type === 'text') return `text:${part.text}`
    return part.type
  }).join('>') || ''

  return (
    <div>
      <button type="button" onClick={() => { void sendMessage('question') }}>send</button>
      <div data-testid="content">{assistant?.content || ''}</div>
      <div data-testid="thinking">{thinking?.text || ''}</div>
      <div data-testid="thinking-state">{thinking?.state || ''}</div>
      <div data-testid="text">{text || ''}</div>
      <div data-testid="status">{status?.lastAction || ''}</div>
      <div data-testid="status-label">{status?.statusLabel || ''}</div>
      <div data-testid="status-result">{status?.resultSummary || ''}</div>
      <div data-testid="status-thinking">{status?.thinkingPreview || ''}</div>
      <div data-testid="status-thinking-live">{status?.hasThinking ? 'yes' : 'no'}</div>
      <div data-testid="tools">{toolSummary}</div>
      <div data-testid="part-order">{partOrder}</div>
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
    expect(screen.getByTestId('status-thinking').textContent).toBe('checking files and comparing state')
    expect(screen.getByTestId('status-thinking-live').textContent).toBe('yes')

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
    expect(screen.getByTestId('status-thinking').textContent).toBe('checking files and comparing state')
    expect(screen.getByTestId('status-thinking-live').textContent).toBe('yes')
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

  it('streams tool calls before the terminal done event', async () => {
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
            runId: 'run-tools-live',
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
        type: 'tool_started',
        toolName: 'bash',
        toolCallId: 'tool-bash-1',
        args: { command: 'python script.py' },
        runId: 'run-tools-live',
        sessionId: 'session-1',
        sessionPath: 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl',
      })
      vi.advanceTimersByTime(80)
    })

    expect(screen.getByTestId('tools').textContent).toBe('bash:running')
    expect(screen.getByTestId('status').textContent).toBe('Running bash')

    await act(async () => {
      agentCallback?.({
        type: 'tool_finished',
        toolName: 'bash',
        toolCallId: 'tool-bash-1',
        runId: 'run-tools-live',
        sessionId: 'session-1',
        sessionPath: 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl',
      })
      vi.advanceTimersByTime(80)
    })

    expect(screen.getByTestId('tools').textContent).toBe('bash:done')
    expect(screen.getByTestId('status-label').textContent).not.toBe('Completed')
    vi.useRealTimers()
  })

  it('keeps live thinking, tool calls, and text in event order', async () => {
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
            runId: 'run-interleaved',
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
        type: 'thinking_delta',
        text: 'first thought',
        runId: 'run-interleaved',
        sessionId: 'session-1',
        sessionPath: 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl',
      })
      agentCallback?.({
        type: 'tool_started',
        toolName: 'bash',
        toolCallId: 'tool-bash-1',
        args: { command: 'python script.py' },
        runId: 'run-interleaved',
        sessionId: 'session-1',
        sessionPath: 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl',
      })
      agentCallback?.({
        type: 'tool_finished',
        toolName: 'bash',
        toolCallId: 'tool-bash-1',
        runId: 'run-interleaved',
        sessionId: 'session-1',
        sessionPath: 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl',
      })
      agentCallback?.({
        type: 'thinking_delta',
        text: 'second thought',
        runId: 'run-interleaved',
        sessionId: 'session-1',
        sessionPath: 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl',
      })
      agentCallback?.({
        type: 'token',
        text: 'Final answer',
        runId: 'run-interleaved',
        sessionId: 'session-1',
        sessionPath: 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl',
      })
      vi.advanceTimersByTime(80)
    })

    expect(screen.getByTestId('part-order').textContent).toBe(
      'thinking:first thought>tool:bash:done>thinking:second thought>text:Final answer',
    )
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

    render(<ChatIPCHost onArtifactCreated={artifactCreated} onStreamEnd={streamEnd} />)

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
    expect(screen.getByTestId('status-label').textContent).not.toBe('Completed')
    expect(screen.getByTestId('status-result').textContent).toBe('Created result.md')
    expect(streamEnd).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('clears the previous completion summary when a new run starts reporting live status', async () => {
    vi.useFakeTimers()
    let agentCallback: ((event: AgentEvent) => void) | null = null
    window.piDesktop = {
      chat: {
        send: vi.fn()
          .mockResolvedValueOnce({
            success: true,
            data: {
              sessionId: 'session-1',
              sessionPath: 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl',
              createdNewSession: false,
              runId: 'run-summary-1',
            },
          })
          .mockResolvedValueOnce({
            success: true,
            data: {
              sessionId: 'session-1',
              sessionPath: 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl',
              createdNewSession: false,
              runId: 'run-summary-2',
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
        type: 'done',
        runId: 'run-summary-1',
        session: {
          sessionId: 'session-1',
          sessionPath: 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl',
          cwd: 'D:/PI/app',
          title: 'Session',
          model: 'openai/gpt-4o-mini',
          thinkingLevel: 'medium',
          tokenCount: 0,
          messages: [],
        },
      })
      vi.advanceTimersByTime(80)
    })

    expect(screen.getByTestId('status-result').textContent).toBe('Pi session synced')

    await act(async () => {
      screen.getByRole('button', { name: 'send' }).click()
      await Promise.resolve()
    })

    await act(async () => {
      agentCallback?.({
        type: 'status',
        status: 'reading_file',
        statusLabel: 'Reading files',
        lastAction: 'Reading fresh context',
        isWaitingForUser: false,
        runId: 'run-summary-2',
        sessionId: 'session-1',
        sessionPath: 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl',
      })
      vi.advanceTimersByTime(80)
    })

    expect(screen.getByTestId('status').textContent).toBe('Reading fresh context')
    expect(screen.getByTestId('status-result').textContent).toBe('')
    vi.useRealTimers()
  })

  it('ignores pathless events that only match a duplicate session id while a session path is active', async () => {
    let agentCallback: ((event: AgentEvent) => void) | null = null
    window.piDesktop = {
      chat: {
        send: vi.fn().mockResolvedValue({
          success: true,
          data: {
            sessionId: 'duplicate-id',
            sessionPath: 'C:/Users/test/.pi/agent/sessions/second/session.jsonl',
            createdNewSession: false,
            runId: 'run-current',
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

    render(
      <ChatIPCHost
        currentSessionId="duplicate-id"
        currentSessionPath="C:/Users/test/.pi/agent/sessions/second/session.jsonl"
      />,
    )

    await act(async () => {
      agentCallback?.({
        type: 'status',
        status: 'generating',
        statusLabel: 'Generating content',
        lastAction: 'This belongs to another duplicate-id session',
        isWaitingForUser: false,
        sessionId: 'duplicate-id',
      })
    })

    expect(screen.getByTestId('status').textContent).toBe('')
  })

  it('marks a completed run without visible assistant text as no final reply', async () => {
    let agentCallback: ((event: AgentEvent) => void) | null = null
    window.piDesktop = {
      chat: {
        send: vi.fn().mockResolvedValue({
          success: true,
          data: {
            sessionId: 'session-1',
            sessionPath: 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl',
            createdNewSession: false,
            runId: 'run-tool-only',
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
        type: 'done',
        runId: 'run-tool-only',
        session: {
          sessionId: 'session-1',
          sessionPath: 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl',
          cwd: 'D:/PI/app',
          title: 'Session',
          model: 'openai/gpt-4o-mini',
          thinkingLevel: 'medium',
          tokenCount: 0,
          messages: [
            {
              role: 'assistant',
              content: [
                { type: 'toolCall', id: 'tool-1', name: 'read', arguments: { path: 'README.md' } },
              ],
            },
            {
              role: 'toolResult',
              toolCallId: 'tool-1',
              toolName: 'read',
              content: 'done',
            },
          ],
        },
      })
    })

    expect(screen.getByTestId('status-label').textContent).toBe('No final reply')
    expect(screen.getByTestId('status-result').textContent).toBe('Pi ended after tool activity without a final text response.')
  })
})
