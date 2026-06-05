import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from '../../src/renderer/src/App'

function createPiDesktopMock(overrides: Partial<Window['piDesktop']> = {}): Window['piDesktop'] {
  return {
    chat: {
      send: vi.fn().mockResolvedValue({
        success: true,
        data: {
          sessionId: 'session-1',
          sessionPath: 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl',
          createdNewSession: false,
        },
      }),
      abort: vi.fn().mockResolvedValue({ success: true }),
    },
    config: {
      get: vi.fn(async (key: string) => {
        if (key === 'workingDirectory') return { success: true, data: 'D:/PI/app' }
        if (key === 'wizardCompleted') return { success: true, data: 'true' }
        return { success: true, data: null }
      }),
      set: vi.fn().mockResolvedValue({ success: true }),
    },
    session: {
      list: vi.fn().mockResolvedValue({
        success: true,
        data: [
          {
            id: 'session-1',
            path: 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl',
            cwd: 'D:/PI/app',
            title: 'Real Pi Session',
            model: 'openai/gpt-4o-mini',
            tokenCount: 0,
            messageCount: 3,
            source: 'pi',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      }),
      create: vi.fn().mockResolvedValue({
        success: true,
        data: {
          id: 'session-2',
          path: 'C:/Users/test/.pi/agent/sessions/project/session-2.jsonl',
          cwd: 'D:/PI/app',
          title: 'New Pi Session',
          source: 'pi',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }),
      delete: vi.fn().mockResolvedValue({ success: true }),
      search: vi.fn().mockResolvedValue({ success: true, data: [] }),
      getActive: vi.fn().mockResolvedValue({ success: true, data: 'session-1' }),
      switch: vi.fn().mockResolvedValue({
        success: true,
        data: {
          sessionId: 'session-1',
          sessionPath: 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl',
          cwd: 'D:/PI/app',
          title: 'Real Pi Session',
          model: 'openai/gpt-4o-mini',
          thinkingLevel: 'medium',
          messages: [],
          tokenCount: 0,
        },
      }),
      updateRuntime: vi.fn().mockResolvedValue({
        success: true,
        data: {
          sessionId: 'session-1',
          sessionPath: 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl',
          cwd: 'D:/PI/app',
          title: 'Real Pi Session',
          model: 'openai/gpt-4o-mini',
          thinkingLevel: 'medium',
          messages: [],
          tokenCount: 0,
        },
      }),
    },
    providers: {
      catalog: vi.fn().mockResolvedValue({
        success: true,
        data: [
          {
            providerId: 'openai',
            displayName: 'OpenAI',
            apiType: 'openai-responses',
            authType: 'apiKey',
            baseUrl: 'https://api.openai.com/v1',
            allowCustomBaseUrl: false,
          },
        ],
      }),
      list: vi.fn().mockResolvedValue({
        success: true,
        data: [
          {
            id: 'prov-1',
            providerId: 'openai',
            displayName: 'OpenAI',
            kind: 'builtin',
            hasAuth: true,
            authType: 'apiKey',
            apiType: 'openai-responses',
            baseUrl: 'https://api.openai.com/v1',
            models: [
              {
                id: 'gpt-4o-mini',
                name: 'GPT-4o Mini',
                providerId: 'openai',
                runtimeKey: 'openai/gpt-4o-mini',
                input: ['text'],
                reasoning: false,
                isDefault: true,
              },
            ],
            isDefault: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      }),
      add: vi.fn().mockResolvedValue({ success: true }),
      update: vi.fn().mockResolvedValue({ success: true }),
      delete: vi.fn().mockResolvedValue({ success: true }),
      test: vi.fn().mockResolvedValue({
        success: true,
        data: { success: true, message: 'Connection successful', detectedModels: [] },
      }),
      discoverModels: vi.fn().mockResolvedValue({ success: true, data: [] }),
    },
    desktop: {
      getStateSummary: vi.fn().mockResolvedValue({
        success: true,
        data: {
          memory: [],
          skills: [],
        },
      }),
    },
    profiles: {
      list: vi.fn().mockResolvedValue({ success: true, data: [] }),
      create: vi.fn().mockResolvedValue({ success: true }),
      delete: vi.fn().mockResolvedValue({ success: true }),
      getActive: vi.fn().mockResolvedValue({ success: true, data: 'default' }),
      switch: vi.fn().mockResolvedValue({ success: true }),
    },
    files: {
      list: vi.fn().mockResolvedValue({ success: true, data: [] }),
      read: vi.fn().mockResolvedValue({ success: true, data: { type: 'text', content: '' } }),
      save: vi.fn().mockResolvedValue({ success: true }),
      open: vi.fn().mockResolvedValue({ success: true }),
    },
    onAgentEvent: vi.fn(() => () => {}),
    ...overrides,
  }
}

describe('App', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('loads real sessions, working directory, and selected provider model on startup', async () => {
    window.piDesktop = createPiDesktopMock()

    render(<App />)

    await waitFor(() => {
      expect(window.piDesktop.session.list).toHaveBeenCalled()
      expect(window.piDesktop.providers.list).toHaveBeenCalled()
      expect(window.piDesktop.config.get).toHaveBeenCalledWith('workingDirectory')
    })

    expect(await screen.findByText('Real Pi Session')).toBeTruthy()
    expect(screen.getAllByText('D:/PI/app').length).toBeGreaterThan(0)
    expect(screen.getAllByText('OpenAI / GPT-4o Mini').length).toBeGreaterThan(0)
  })

  it('creates a Pi session implicitly when the user sends a message with no existing sessions', async () => {
    const sendMock = vi.fn().mockResolvedValue({
      success: true,
      data: {
        sessionId: 'session-new',
        sessionPath: 'C:/Users/test/.pi/agent/sessions/project/session-new.jsonl',
        createdNewSession: true,
      },
    })

    window.piDesktop = createPiDesktopMock({
      chat: {
        send: sendMock,
        abort: vi.fn().mockResolvedValue({ success: true }),
      },
      session: {
        list: vi.fn().mockResolvedValue({ success: true, data: [] }),
        create: vi.fn().mockResolvedValue({
          success: true,
          data: {
            id: 'session-new',
            path: 'C:/Users/test/.pi/agent/sessions/project/session-new.jsonl',
            cwd: 'D:/PI/app',
            title: 'New Pi Session',
            source: 'pi',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        }),
        delete: vi.fn().mockResolvedValue({ success: true }),
        search: vi.fn().mockResolvedValue({ success: true, data: [] }),
        getActive: vi.fn().mockResolvedValue({ success: true, data: null }),
        switch: vi.fn().mockResolvedValue({
          success: true,
          data: {
            sessionId: 'session-new',
            sessionPath: 'C:/Users/test/.pi/agent/sessions/project/session-new.jsonl',
            cwd: 'D:/PI/app',
            title: 'New Pi Session',
            model: 'openai/gpt-4o-mini',
            thinkingLevel: 'medium',
            messages: [],
            tokenCount: 0,
          },
        }),
        updateRuntime: vi.fn().mockResolvedValue({
          success: true,
          data: {
            sessionId: 'session-new',
            sessionPath: 'C:/Users/test/.pi/agent/sessions/project/session-new.jsonl',
            cwd: 'D:/PI/app',
            title: 'New Pi Session',
            model: 'openai/gpt-4o-mini',
            thinkingLevel: 'medium',
            messages: [],
            tokenCount: 0,
          },
        }),
      },
    })

    render(<App />)

    const input = await screen.findByPlaceholderText(/Ask Pi/)
    fireEvent.change(input, { target: { value: 'continue this task' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(sendMock).toHaveBeenCalled()
    })
  })

  it('shows the welcome flow when no provider is configured', async () => {
    window.piDesktop = createPiDesktopMock({
      providers: {
        catalog: vi.fn().mockResolvedValue({
          success: true,
          data: [
            {
              providerId: 'openai',
              displayName: 'OpenAI',
              apiType: 'openai-responses',
              authType: 'apiKey',
              baseUrl: 'https://api.openai.com/v1',
              allowCustomBaseUrl: false,
            },
          ],
        }),
        list: vi.fn().mockResolvedValue({ success: true, data: [] }),
        add: vi.fn().mockResolvedValue({ success: true }),
        update: vi.fn().mockResolvedValue({ success: true }),
        delete: vi.fn().mockResolvedValue({ success: true }),
        test: vi.fn().mockResolvedValue({
          success: true,
          data: { success: true, message: 'Connection successful', detectedModels: [] },
        }),
        discoverModels: vi.fn().mockResolvedValue({ success: true, data: [] }),
      },
      config: {
        get: vi.fn(async (key: string) => {
          if (key === 'wizardCompleted') return { success: true, data: null }
          if (key === 'workingDirectory') return { success: true, data: null }
          return { success: true, data: null }
        }),
        set: vi.fn().mockResolvedValue({ success: true }),
      },
    })

    render(<App />)

    expect(await screen.findByText('Welcome to Pi Desktop')).toBeTruthy()
    fireEvent.click(screen.getByText(/Continue/))
    expect(await screen.findByText('Choose a Provider')).toBeTruthy()
    expect(screen.getByText(/Continue/)).toBeTruthy()
    expect(screen.getByText('Back')).toBeTruthy()
  })

  it('shows the welcome flow when a default provider exists but no auth is configured', async () => {
    window.piDesktop = createPiDesktopMock({
      providers: {
        catalog: vi.fn().mockResolvedValue({
          success: true,
          data: [
            {
              providerId: 'deepseek',
              displayName: 'DeepSeek',
              apiType: 'openai-completions',
              authType: 'apiKey',
              baseUrl: 'https://api.deepseek.com/v1',
              allowCustomBaseUrl: false,
            },
          ],
        }),
        list: vi.fn().mockResolvedValue({
          success: true,
          data: [
            {
              id: 'deepseek',
              providerId: 'deepseek',
              displayName: 'DeepSeek',
              kind: 'builtin',
              hasAuth: false,
              authType: 'apiKey',
              apiType: 'openai-completions',
              baseUrl: 'https://api.deepseek.com/v1',
              models: [
                {
                  id: 'deepseek-v4-pro',
                  name: 'DeepSeek V4 Pro',
                  providerId: 'deepseek',
                  runtimeKey: 'deepseek/deepseek-v4-pro',
                  input: ['text'],
                  reasoning: true,
                  isDefault: true,
                },
              ],
              isDefault: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        }),
        add: vi.fn().mockResolvedValue({ success: true }),
        update: vi.fn().mockResolvedValue({ success: true }),
        delete: vi.fn().mockResolvedValue({ success: true }),
        test: vi.fn().mockResolvedValue({
          success: true,
          data: { success: true, message: 'Connection successful', detectedModels: [] },
        }),
        discoverModels: vi.fn().mockResolvedValue({ success: true, data: [] }),
      },
      config: {
        get: vi.fn(async (key: string) => {
          if (key === 'wizardCompleted') return { success: true, data: null }
          if (key === 'workingDirectory') return { success: true, data: 'D:/PI/app' }
          return { success: true, data: null }
        }),
        set: vi.fn().mockResolvedValue({ success: true }),
      },
    })

    render(<App />)

    expect(await screen.findByText('Welcome to Pi Desktop')).toBeTruthy()
  })

  it('writes model and thinking changes back to the active Pi session runtime', async () => {
    const updateRuntimeMock = vi.fn()
      .mockResolvedValueOnce({
        success: true,
        data: {
          sessionId: 'session-1',
          sessionPath: 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl',
          cwd: 'D:/PI/app',
          title: 'Real Pi Session',
          model: 'openai/gpt-4o-mini',
          thinkingLevel: 'medium',
          messages: [],
          tokenCount: 0,
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          sessionId: 'session-1',
          sessionPath: 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl',
          cwd: 'D:/PI/app',
          title: 'Real Pi Session',
          model: 'openai/gpt-4o-mini',
          thinkingLevel: 'high',
          messages: [],
          tokenCount: 0,
        },
      })

    window.piDesktop = createPiDesktopMock({
      session: {
        ...createPiDesktopMock().session,
        updateRuntime: updateRuntimeMock,
      },
    })

    render(<App />)

    expect(await screen.findByText('Real Pi Session')).toBeTruthy()

    fireEvent.click(screen.getAllByText('OpenAI / GPT-4o Mini')[0])
    fireEvent.click(await screen.findByRole('button', { name: 'OpenAI / GPT-4o Mini' }))

    await waitFor(() => {
      expect(updateRuntimeMock).toHaveBeenCalledWith({
        sessionPath: 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl',
        modelId: 'openai/gpt-4o-mini',
        thinkingLevel: undefined,
      })
    })

    fireEvent.click(screen.getByText('Thinking: medium'))
    fireEvent.click(await screen.findByText('high'))

    await waitFor(() => {
      expect(updateRuntimeMock).toHaveBeenCalledWith({
        sessionPath: 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl',
        modelId: undefined,
        thinkingLevel: 'high',
      })
    })
  })

  it('restores the last active Pi session when it is still available', async () => {
    window.piDesktop = createPiDesktopMock({
      session: {
        ...createPiDesktopMock().session,
        list: vi.fn().mockResolvedValue({
          success: true,
          data: [
            {
              id: 'session-2',
              path: 'C:/Users/test/.pi/agent/sessions/project/session-2.jsonl',
              cwd: 'D:/PI/other',
              title: 'Older Session',
              model: 'openai/gpt-4o-mini',
              tokenCount: 0,
              messageCount: 1,
              source: 'pi',
              createdAt: new Date().toISOString(),
              updatedAt: new Date(Date.now() + 1000).toISOString(),
            },
            {
              id: 'session-1',
              path: 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl',
              cwd: 'D:/PI/app',
              title: 'Restored Session',
              model: 'openai/gpt-4o-mini',
              tokenCount: 0,
              messageCount: 3,
              source: 'pi',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        }),
        getActive: vi.fn().mockResolvedValue({ success: true, data: 'session-1' }),
        switch: vi.fn().mockResolvedValue({
          success: true,
          data: {
            sessionId: 'session-1',
            sessionPath: 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl',
            cwd: 'D:/PI/app',
            title: 'Restored Session',
            model: 'openai/gpt-4o-mini',
            thinkingLevel: 'medium',
            messages: [],
            tokenCount: 0,
          },
        }),
      },
    })

    render(<App />)

    expect(await screen.findByText('Restored Session')).toBeTruthy()
    await waitFor(() => {
      expect(window.piDesktop.session.switch).toHaveBeenCalledWith(
        'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl',
      )
    })
  })

  it('restores tool calls from Pi session history instead of flattening everything to plain text', async () => {
    window.piDesktop = createPiDesktopMock({
      session: {
        ...createPiDesktopMock().session,
        switch: vi.fn().mockResolvedValue({
          success: true,
          data: {
            sessionId: 'session-1',
            sessionPath: 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl',
            cwd: 'D:/PI/app',
            title: 'Real Pi Session',
            model: 'openai/gpt-4o-mini',
            thinkingLevel: 'medium',
            tokenCount: 42,
            messages: [
              {
                role: 'assistant',
                timestamp: Date.now(),
                content: [
                  { type: 'text', text: 'I inspected the workspace.' },
                  { type: 'toolCall', id: 'tool-1', name: 'read', arguments: { path: 'README.md' } },
                ],
              },
            ],
          },
        }),
      },
    })

    render(<App />)

    expect(await screen.findByText('I inspected the workspace.')).toBeTruthy()
    expect(await screen.findByText(/read/)).toBeTruthy()
    expect(await screen.findByText(/\{"path":"README.md"\}/)).toBeTruthy()
  })

  it('renders Pi-native tool results and compaction summaries from session history', async () => {
    window.piDesktop = createPiDesktopMock({
      session: {
        ...createPiDesktopMock().session,
        switch: vi.fn().mockResolvedValue({
          success: true,
          data: {
            sessionId: 'session-1',
            sessionPath: 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl',
            cwd: 'D:/PI/app',
            title: 'Real Pi Session',
            model: 'openai/gpt-4o-mini',
            thinkingLevel: 'medium',
            tokenCount: 512,
            messages: [
              {
                role: 'toolResult',
                toolName: 'read',
                toolCallId: 'tool-1',
                timestamp: Date.now(),
                content: [{ type: 'text', text: 'README loaded' }],
              },
              {
                role: 'compactionSummary',
                summary: 'Earlier context was condensed.',
                tokensBefore: 2048,
                timestamp: Date.now(),
              },
            ],
          },
        }),
      },
    })

    render(<App />)

    expect(await screen.findByText(/Tool result \(read\)/)).toBeTruthy()
    expect(await screen.findByText(/README loaded/)).toBeTruthy()
    expect(await screen.findByText(/Compaction summary \(2048 tokens before\)/)).toBeTruthy()
    expect(await screen.findByText(/512/)).toBeTruthy()
  })

  it('persists a new working directory selection from the top bar', async () => {
    const configSetMock = vi.fn().mockResolvedValue({ success: true })

    window.piDesktop = createPiDesktopMock({
      config: {
        get: vi.fn(async (key: string) => {
          if (key === 'workingDirectory') return { success: true, data: 'D:/PI/app' }
          if (key === 'wizardCompleted') return { success: true, data: 'true' }
          return { success: true, data: null }
        }),
        set: configSetMock,
      },
      session: {
        ...createPiDesktopMock().session,
        list: vi.fn().mockResolvedValue({
          success: true,
          data: [
            {
              id: 'session-1',
              path: 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl',
              cwd: 'D:/PI/app',
              title: 'Real Pi Session',
              model: 'openai/gpt-4o-mini',
              tokenCount: 0,
              messageCount: 3,
              source: 'pi',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            {
              id: 'session-2',
              path: 'C:/Users/test/.pi/agent/sessions/other/session-2.jsonl',
              cwd: 'D:/PI/other',
              title: 'Other Session',
              model: 'openai/gpt-4o-mini',
              tokenCount: 0,
              messageCount: 2,
              source: 'pi',
              createdAt: new Date().toISOString(),
              updatedAt: new Date(Date.now() - 1000).toISOString(),
            },
          ],
        }),
      },
    })

    render(<App />)

    expect(await screen.findByText('Real Pi Session')).toBeTruthy()
    fireEvent.click(screen.getAllByText('D:/PI/app')[0])
    fireEvent.click(await screen.findByRole('button', { name: 'D:/PI/other' }))

    await waitFor(() => {
      expect(configSetMock).toHaveBeenCalledWith('workingDirectory', 'D:/PI/other')
    })
  })

  it('switches to the most recent session in the selected directory', async () => {
    window.piDesktop = createPiDesktopMock({
      session: {
        ...createPiDesktopMock().session,
        list: vi.fn().mockResolvedValue({
          success: true,
          data: [
            {
              id: 'session-1',
              path: 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl',
              cwd: 'D:/PI/app',
              title: 'Real Pi Session',
              model: 'openai/gpt-4o-mini',
              tokenCount: 0,
              messageCount: 3,
              source: 'pi',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            {
              id: 'session-2',
              path: 'C:/Users/test/.pi/agent/sessions/other/session-2.jsonl',
              cwd: 'D:/PI/other',
              title: 'Other Session',
              model: 'openai/gpt-4o-mini',
              tokenCount: 256,
              messageCount: 2,
              source: 'pi',
              createdAt: new Date().toISOString(),
              updatedAt: new Date(Date.now() + 1000).toISOString(),
            },
          ],
        }),
        switch: vi.fn(async (sessionPath: string) => ({
          success: true,
          data: {
            sessionId: sessionPath.includes('other') ? 'session-2' : 'session-1',
            sessionPath,
            cwd: sessionPath.includes('other') ? 'D:/PI/other' : 'D:/PI/app',
            title: sessionPath.includes('other') ? 'Other Session' : 'Real Pi Session',
            model: 'openai/gpt-4o-mini',
            thinkingLevel: 'medium',
            messages: [],
            tokenCount: sessionPath.includes('other') ? 256 : 0,
          },
        })),
      },
    })

    render(<App />)

    expect(await screen.findByText('Real Pi Session')).toBeTruthy()
    fireEvent.click(screen.getAllByText('D:/PI/app')[0])
    fireEvent.click(await screen.findByRole('button', { name: 'D:/PI/other' }))

    await waitFor(() => {
      expect(window.piDesktop.session.switch).toHaveBeenCalledWith(
        'C:/Users/test/.pi/agent/sessions/other/session-2.jsonl',
      )
    })
  })
})
