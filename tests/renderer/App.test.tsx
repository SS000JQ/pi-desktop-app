import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
      pickDirectory: vi.fn().mockResolvedValue({ success: true, data: null }),
    },
    artifacts: {
      list: vi.fn().mockResolvedValue({ success: true, data: [] }),
      get: vi.fn().mockResolvedValue({ success: true, data: null }),
      history: vi.fn().mockResolvedValue({ success: true, data: [] }),
      refresh: vi.fn().mockResolvedValue({ success: true, data: null }),
      pin: vi.fn().mockResolvedValue({ success: true, data: null }),
      markPrimary: vi.fn().mockResolvedValue({ success: true, data: null }),
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

  it('opens a new chat dialog and creates a session in the chosen directory', async () => {
    const createMock = vi.fn().mockResolvedValue({
      success: true,
      data: {
        id: 'session-3',
        path: 'C:/Users/test/.pi/agent/sessions/project/session-3.jsonl',
        cwd: 'D:/PI/client-a',
        title: 'Client A Session',
        source: 'pi',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    })
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
        create: createMock,
      },
    })

    render(<App />)

    expect(await screen.findByText('Real Pi Session')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'New Chat' }))
    expect(await screen.findByText(/Choose where this Pi session should live/)).toBeTruthy()

    fireEvent.change(screen.getByPlaceholderText('D:/Work/My Project'), {
      target: { value: 'D:/PI/client-a' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith({ cwd: 'D:/PI/client-a' })
    })
    await waitFor(() => {
      expect(configSetMock).toHaveBeenCalledWith('workingDirectory', 'D:/PI/client-a')
    })
  })

  it('creates a new session in a known directory instead of always reusing the current one', async () => {
    const createMock = vi.fn().mockResolvedValue({
      success: true,
      data: {
        id: 'session-4',
        path: 'C:/Users/test/.pi/agent/sessions/project/session-4.jsonl',
        cwd: 'D:/PI/client-b',
        title: 'Client B Session',
        source: 'pi',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    })

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
              path: 'C:/Users/test/.pi/agent/sessions/client-b/session-2.jsonl',
              cwd: 'D:/PI/client-b',
              title: 'Client B Session',
              model: 'openai/gpt-4o-mini',
              tokenCount: 0,
              messageCount: 2,
              source: 'pi',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        }),
        create: createMock,
      },
    })

    render(<App />)

    expect(await screen.findByText('Real Pi Session')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'New Chat' }))

    const knownOption = (await screen.findAllByLabelText('Choose a known directory'))[0]
    fireEvent.click(knownOption)
    fireEvent.change(screen.getByDisplayValue('D:/PI/app'), {
      target: { value: 'D:/PI/client-b' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith({ cwd: 'D:/PI/client-b' })
    })
  })

  it('lets the user browse for a folder instead of manually pasting a path when creating a session', async () => {
    const pickDirectoryMock = vi.fn().mockResolvedValue({
      success: true,
      data: 'D:/PI/client-c',
    })
    const createMock = vi.fn().mockResolvedValue({
      success: true,
      data: {
        id: 'session-5',
        path: 'C:/Users/test/.pi/agent/sessions/project/session-5.jsonl',
        cwd: 'D:/PI/client-c',
        title: 'Client C Session',
        source: 'pi',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    })

    window.piDesktop = createPiDesktopMock({
      files: {
        ...createPiDesktopMock().files,
        pickDirectory: pickDirectoryMock,
      },
      session: {
        ...createPiDesktopMock().session,
        create: createMock,
      },
    })

    render(<App />)

    expect(await screen.findByText('Real Pi Session')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'New Chat' }))

    fireEvent.click(screen.getByRole('button', { name: 'Browse folders' }))

    await waitFor(() => {
      expect(pickDirectoryMock).toHaveBeenCalled()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith({ cwd: 'D:/PI/client-c' })
    })
  })

  it('keeps the left sidebar focused on sessions with models and skills as secondary actions', async () => {
    window.piDesktop = createPiDesktopMock()

    render(<App />)

    expect(await screen.findByText('Real Pi Session')).toBeTruthy()
    const leftPanel = screen.getByText('Pi Sessions').closest('.left')
    expect(leftPanel).toBeTruthy()
    const panel = within(leftPanel as HTMLElement)

    expect(panel.getByRole('button', { name: 'New Chat' })).toBeTruthy()
    expect(panel.getByRole('button', { name: 'Recent' })).toBeTruthy()
    expect(panel.getByRole('button', { name: 'Directories' })).toBeTruthy()
    expect(panel.getByRole('button', { name: 'Models' })).toBeTruthy()
    expect(panel.getByRole('button', { name: 'Skills' })).toBeTruthy()
    expect(panel.queryByText('Files')).toBeNull()
    expect(panel.queryByText('Tools')).toBeNull()
    expect(panel.queryByText('Memory')).toBeNull()
  })

  it('shows a results workbench on the right with progress, workspace, and context sections', async () => {
    window.piDesktop = createPiDesktopMock({
      files: {
        list: vi.fn().mockResolvedValue({
          success: true,
          data: [
            {
              name: 'assets',
              path: 'D:/PI/app/assets',
              isDir: true,
              size: 0,
              modifiedAt: new Date().toISOString(),
            },
            {
              name: 'report.md',
              path: 'D:/PI/app/report.md',
              isDir: false,
              size: 1200,
              modifiedAt: new Date().toISOString(),
            },
            {
              name: 'brief.docx',
              path: 'D:/PI/app/brief.docx',
              isDir: false,
              size: 2200,
              modifiedAt: new Date().toISOString(),
            },
          ],
        }),
        read: vi.fn().mockResolvedValue({ success: true, data: { type: 'text', content: '# Report' } }),
        save: vi.fn().mockResolvedValue({ success: true }),
        open: vi.fn().mockResolvedValue({ success: true }),
      },
    })

    render(<App />)

    expect(await screen.findByText('Real Pi Session')).toBeTruthy()
    expect(await screen.findByText('Progress')).toBeTruthy()
    expect(screen.getByText('Workspace')).toBeTruthy()
    expect(screen.getByText('Context')).toBeTruthy()
    expect(screen.getByText('Uploads')).toBeTruthy()
    expect(screen.getByText('Connectors')).toBeTruthy()
    expect(screen.getAllByText('Skills').length).toBeGreaterThan(0)
    expect(screen.getAllByText('report.md').length).toBeGreaterThan(0)
    expect(screen.getAllByText('brief.docx').length).toBeGreaterThan(0)
    expect(screen.getByText('assets')).toBeTruthy()
  })

  it('shows a preparing status immediately after the user sends a message', async () => {
    const sendMock = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              success: true,
              data: {
                sessionId: 'session-1',
                sessionPath: 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl',
                createdNewSession: false,
              },
            })
          }, 50)
        }),
    )

    window.piDesktop = createPiDesktopMock({
      chat: {
        send: sendMock,
        abort: vi.fn().mockResolvedValue({ success: true }),
      },
    })

    render(<App />)

    const input = await screen.findByPlaceholderText(/Ask Pi/)
    fireEvent.change(input, { target: { value: 'draft the update' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect((await screen.findAllByText('Preparing')).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Connecting to the selected Pi session/).length).toBeGreaterThan(0)
  })

  it('renders runtime status updates from agent events in the chat header', async () => {
    let agentCallback: ((event: unknown) => void) | null = null

    window.piDesktop = createPiDesktopMock({
      onAgentEvent: vi.fn((callback) => {
        agentCallback = callback
        return () => {
          agentCallback = null
        }
      }),
    })

    render(<App />)

    expect(await screen.findByText('Real Pi Session')).toBeTruthy()
    await waitFor(() => {
      expect(window.piDesktop.onAgentEvent).toHaveBeenCalled()
    })

    await act(async () => {
      agentCallback?.({
        type: 'status',
        status: 'reading_file',
        statusLabel: 'Reading files',
        lastAction: 'Reading with read',
        isWaitingForUser: false,
        sessionId: 'session-1',
        sessionPath: 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl',
      })
    })

    expect((await screen.findAllByText('Reading files')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Reading with read').length).toBeGreaterThan(0)
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

    fireEvent.click(screen.getByRole('button', { name: 'Current model' }))
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
    const switchMock = vi.fn().mockResolvedValue({
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
    })

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
        switch: switchMock,
      },
    })

    render(<App />)

    expect(await screen.findByText('Restored Session')).toBeTruthy()
    await waitFor(() => {
      expect(switchMock).toHaveBeenCalledWith(
        'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl',
      )
    })
    expect(switchMock).toHaveBeenCalledTimes(1)
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

  it('shows runtime status updates at the top of the chat view', async () => {
    let agentListener: ((event: any) => void) | undefined

    window.piDesktop = createPiDesktopMock({
      onAgentEvent: vi.fn((callback) => {
        agentListener = callback
        return () => {}
      }),
    })

    render(<App />)

    expect(await screen.findByText('Real Pi Session')).toBeTruthy()
    expect(screen.queryAllByText('Generating content')).toHaveLength(0)

    await act(async () => {
      agentListener?.({
        type: 'status',
        status: 'generating',
        statusLabel: 'Generating content',
        lastAction: 'Drafting the response',
        isWaitingForUser: false,
        sessionId: 'session-1',
        sessionPath: 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl',
        startedAt: Date.now(),
      })
    })

    expect((await screen.findAllByText('Generating content')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Drafting the response').length).toBeGreaterThan(0)

    await act(async () => {
      agentListener?.({
        type: 'status',
        status: 'completed',
        statusLabel: 'Completed',
        lastAction: 'Response finished',
        resultSummary: 'Created report.md',
        isWaitingForUser: false,
        sessionId: 'session-1',
        sessionPath: 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl',
      })
    })

    expect((await screen.findAllByText('Completed')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Created report.md').length).toBeGreaterThan(0)
  })
})
