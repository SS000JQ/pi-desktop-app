import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
      getPiResources: vi.fn().mockResolvedValue({
        success: true,
        data: {
          skills: [],
          prompts: [],
          extensions: [],
          extensionCommands: [],
          diagnostics: [],
        },
      }),
      getSlashCommands: vi.fn().mockResolvedValue({ success: true, data: [] }),
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
    cleanup()
    vi.restoreAllMocks()
    delete document.documentElement.dataset.theme
    document.documentElement.style.colorScheme = ''
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

  it('applies the configured theme preset and light color scheme on startup', async () => {
    window.piDesktop = createPiDesktopMock({
      config: {
        get: vi.fn(async (key: string) => {
          if (key === 'workingDirectory') return { success: true, data: 'D:/PI/app' }
          if (key === 'wizardCompleted') return { success: true, data: 'true' }
          if (key === 'theme') return { success: true, data: 'mint-docs' }
          return { success: true, data: null }
        }),
        set: vi.fn().mockResolvedValue({ success: true }),
      },
    })

    render(<App />)

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe('mint-docs')
      expect(document.documentElement.style.colorScheme).toBe('light')
    })
  })

  it('does not fall back to the developer workspace path when no working directory is configured', async () => {
    window.piDesktop = createPiDesktopMock({
      config: {
        get: vi.fn().mockResolvedValue({ success: true, data: null }),
        set: vi.fn().mockResolvedValue({ success: true }),
      },
      session: {
        ...createPiDesktopMock().session,
        list: vi.fn().mockResolvedValue({ success: true, data: [] }),
        getActive: vi.fn().mockResolvedValue({ success: true, data: null }),
      },
    })

    render(<App />)

    expect(await screen.findByText('Choose workspace...')).toBeTruthy()
    expect(screen.queryByText('D:/PI/app')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Choose workspace...' }))
    expect(await screen.findByRole('button', { name: 'Browse folders...' })).toBeTruthy()
  })

  it('does not use the newest session cwd as the workspace when no working directory is configured', async () => {
    window.piDesktop = createPiDesktopMock({
      config: {
        get: vi.fn(async (key: string) => {
          if (key === 'workingDirectory') return { success: true, data: null }
          if (key === 'wizardCompleted') return { success: true, data: 'true' }
          return { success: true, data: null }
        }),
        set: vi.fn().mockResolvedValue({ success: true }),
      },
      session: {
        ...createPiDesktopMock().session,
        list: vi.fn().mockResolvedValue({
          success: true,
          data: [
            {
              id: 'downloads-session',
              path: 'C:/Users/test/.pi/agent/sessions/downloads/session.jsonl',
              cwd: 'C:/Users/test/Downloads',
              title: 'Downloads Session',
              model: 'openai/gpt-4o-mini',
              tokenCount: 0,
              messageCount: 1,
              source: 'pi',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        }),
        getActive: vi.fn().mockResolvedValue({ success: true, data: null }),
      },
    })

    render(<App />)

    expect(await screen.findByText('Downloads Session')).toBeTruthy()
    expect(screen.getByText('Choose workspace...')).toBeTruthy()
    expect(screen.queryByText('C:/Users/test/Downloads')).toBeNull()
  })

  it('does not load the app folder from a session cwd when no working directory is configured', async () => {
    const filesListMock = vi.fn().mockResolvedValue({ success: true, data: [] })
    window.piDesktop = createPiDesktopMock({
      config: {
        get: vi.fn(async (key: string) => {
          if (key === 'workingDirectory') return { success: true, data: null }
          if (key === 'wizardCompleted') return { success: true, data: 'true' }
          return { success: true, data: null }
        }),
        set: vi.fn().mockResolvedValue({ success: true }),
      },
      files: {
        ...createPiDesktopMock().files,
        list: filesListMock,
      },
      session: {
        ...createPiDesktopMock().session,
        list: vi.fn().mockResolvedValue({
          success: true,
          data: [
            {
              id: 'app-session',
              path: 'C:/Users/test/.pi/agent/sessions/app/session.jsonl',
              cwd: 'D:/PI/app',
              title: 'App Folder Session',
              model: 'openai/gpt-4o-mini',
              tokenCount: 0,
              messageCount: 1,
              source: 'pi',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        }),
        getActive: vi.fn().mockResolvedValue({ success: true, data: null }),
      },
    })

    render(<App />)

    expect(await screen.findByText('App Folder Session')).toBeTruthy()
    expect(screen.getByText('Choose workspace...')).toBeTruthy()
    expect(filesListMock).not.toHaveBeenCalledWith('D:/PI/app')
  })

  it('uses the active session cwd for the right workspace instead of the configured working directory', async () => {
    const sessionPath = 'C:/Users/test/.pi/agent/sessions/second/session.jsonl'
    const filesListMock = vi.fn(async (dir: string) => ({
      success: true,
      data: dir === 'D:/PI/second'
        ? [
            {
              name: 'second-report.md',
              path: 'D:/PI/second/second-report.md',
              isDir: false,
              size: 120,
              modifiedAt: new Date().toISOString(),
            },
          ]
        : [
            {
              name: 'app-report.md',
              path: 'D:/PI/app/app-report.md',
              isDir: false,
              size: 120,
              modifiedAt: new Date().toISOString(),
            },
          ],
    }))

    window.piDesktop = createPiDesktopMock({
      config: {
        get: vi.fn(async (key: string) => {
          if (key === 'workingDirectory') return { success: true, data: 'D:/PI/app' }
          if (key === 'wizardCompleted') return { success: true, data: 'true' }
          return { success: true, data: null }
        }),
        set: vi.fn().mockResolvedValue({ success: true }),
      },
      files: {
        ...createPiDesktopMock().files,
        list: filesListMock,
      },
      session: {
        ...createPiDesktopMock().session,
        list: vi.fn().mockResolvedValue({
          success: true,
          data: [
            {
              id: 'duplicate-id',
              path: 'C:/Users/test/.pi/agent/sessions/first/session.jsonl',
              cwd: 'D:/PI/first',
              title: 'First Session',
              model: 'openai/gpt-4o-mini',
              tokenCount: 0,
              messageCount: 1,
              source: 'pi',
              createdAt: new Date().toISOString(),
              updatedAt: new Date(Date.now() - 1000).toISOString(),
            },
            {
              id: 'duplicate-id',
              path: sessionPath,
              cwd: 'D:/PI/second',
              title: 'Second Session',
              model: 'openai/gpt-4o-mini',
              tokenCount: 0,
              messageCount: 1,
              source: 'pi',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        }),
        getActive: vi.fn().mockResolvedValue({ success: true, data: sessionPath }),
        switch: vi.fn().mockResolvedValue({
          success: true,
          data: {
            sessionId: 'duplicate-id',
            sessionPath,
            cwd: 'D:/PI/second',
            title: 'Second Session',
            model: 'openai/gpt-4o-mini',
            thinkingLevel: 'medium',
            messages: [],
            tokenCount: 0,
          },
        }),
      },
    })

    render(<App />)

    expect(await screen.findByText('Second Session')).toBeTruthy()
    await waitFor(() => {
      expect(filesListMock).toHaveBeenCalledWith('D:/PI/second')
    })
    expect((await screen.findAllByText('second-report.md')).length).toBeGreaterThan(0)
    expect(screen.queryByText('app-report.md')).toBeNull()
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
      expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({
        text: 'continue this task',
        cwd: 'D:/PI/app',
      }))
    })
  })

  it('passes the selected working directory when the first message creates a new Pi session', async () => {
    const sendMock = vi.fn().mockResolvedValue({
      success: true,
      data: {
        sessionId: 'session-implicit',
        sessionPath: 'C:/Users/test/.pi/agent/sessions/project/session-implicit.jsonl',
        createdNewSession: true,
      },
    })

    window.piDesktop = createPiDesktopMock({
      chat: {
        send: sendMock,
        abort: vi.fn().mockResolvedValue({ success: true }),
      },
      config: {
        get: vi.fn(async (key: string) => {
          if (key === 'workingDirectory') return { success: true, data: 'D:/PI/client-implicit' }
          if (key === 'wizardCompleted') return { success: true, data: 'true' }
          return { success: true, data: null }
        }),
        set: vi.fn().mockResolvedValue({ success: true }),
      },
      session: {
        ...createPiDesktopMock().session,
        list: vi.fn().mockResolvedValue({ success: true, data: [] }),
        getActive: vi.fn().mockResolvedValue({ success: true, data: null }),
      },
    })

    render(<App />)

    const input = await screen.findByPlaceholderText(/Ask Pi/)
    fireEvent.change(input, { target: { value: 'start in the selected folder' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({
        text: 'start in the selected folder',
        cwd: 'D:/PI/client-implicit',
      }))
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
    expect(await screen.findByText(/Choose the working folder this Pi session should use/)).toBeTruthy()

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

  it('accepts session details returned directly from create and updates the workspace immediately', async () => {
    const createMock = vi.fn().mockResolvedValue({
      success: true,
      data: {
        id: 'session-direct',
        path: 'C:/Users/test/.pi/agent/sessions/project/session-direct.jsonl',
        sessionId: 'session-direct',
        sessionPath: 'C:/Users/test/.pi/agent/sessions/project/session-direct.jsonl',
        cwd: 'D:/PI/client-direct',
        title: 'Direct Session',
        messages: [],
        model: null,
        thinkingLevel: 'medium',
        tokenCount: 0,
        source: 'pi',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    })
    const switchMock = vi.fn().mockResolvedValue({
      success: true,
      data: {
        sessionId: 'session-direct',
        sessionPath: 'C:/Users/test/.pi/agent/sessions/project/session-direct.jsonl',
        cwd: 'D:/PI/client-direct',
        title: 'Direct Session',
        model: null,
        thinkingLevel: 'medium',
        messages: [],
        tokenCount: 0,
      },
    })

    window.piDesktop = createPiDesktopMock({
      session: {
        ...createPiDesktopMock().session,
        create: createMock,
        switch: switchMock,
      },
    })

    render(<App />)

    expect(await screen.findByText('Real Pi Session')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'New Chat' }))
    fireEvent.change(screen.getByPlaceholderText('D:/Work/My Project'), {
      target: { value: 'D:/PI/client-direct' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith({ cwd: 'D:/PI/client-direct' })
    })

    expect(createMock).toHaveBeenCalledTimes(1)
    expect(screen.getAllByText('D:/PI/client-direct').length).toBeGreaterThan(0)
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
    fireEvent.change(screen.getByRole('combobox'), {
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

  it('keeps the last manually chosen folder in the new chat dialog instead of resetting to the current workspace every time', async () => {
    window.piDesktop = createPiDesktopMock()

    render(<App />)

    expect(await screen.findByText('Real Pi Session')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'New Chat' }))
    fireEvent.change(screen.getByPlaceholderText('D:/Work/My Project'), {
      target: { value: 'D:/PI/client-z' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    fireEvent.click(screen.getByRole('button', { name: 'New Chat' }))
    expect(screen.getByDisplayValue('D:/PI/client-z')).toBeTruthy()
  })

  it('respects a known directory selection after the user previously typed a custom path', async () => {
    const createMock = vi.fn().mockResolvedValue({
      success: true,
      data: {
        id: 'session-5b',
        path: 'C:/Users/test/.pi/agent/sessions/project/session-5b.jsonl',
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
    fireEvent.change(screen.getByPlaceholderText('D:/Work/My Project'), {
      target: { value: 'D:/PI/client-z' },
    })

    const knownOption = (await screen.findAllByLabelText('Choose a known directory'))[0]
    fireEvent.click(knownOption)
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'D:/PI/client-b' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith({ cwd: 'D:/PI/client-b' })
    })
  })

  it('uses the Pi Desktop default folder after the user switches away from a remembered custom path', async () => {
    const createMock = vi.fn().mockResolvedValue({
      success: true,
      data: {
        id: 'session-5c',
        path: 'C:/Users/test/.pi/agent/sessions/project/session-5c.jsonl',
        cwd: 'C:/Users/test/Pi-Desktop-Session',
        title: 'Default Session',
        source: 'pi',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    })

    window.piDesktop = createPiDesktopMock({
      session: {
        ...createPiDesktopMock().session,
        create: createMock,
      },
    })

    render(<App />)

    expect(await screen.findByText('Real Pi Session')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'New Chat' }))
    fireEvent.change(screen.getByPlaceholderText('D:/Work/My Project'), {
      target: { value: 'D:/PI/client-z' },
    })
    fireEvent.click(screen.getByLabelText('Use Pi Desktop default folder'))
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith(undefined)
    })
  })

  it('defaults a new chat to the current workspace when opening the dialog', async () => {
    window.piDesktop = createPiDesktopMock()

    render(<App />)

    expect(await screen.findByText('Real Pi Session')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'New Chat' }))

    const radios = screen.getAllByRole('radio') as HTMLInputElement[]
    expect(radios[0]?.checked).toBe(true)
    expect(radios[radios.length - 1]?.checked).toBe(false)
  })

  it('keeps the new chat dialog open and shows an error when session creation fails', async () => {
    const createMock = vi.fn().mockResolvedValue({
      success: false,
      error: 'Permission denied while creating the session',
    })

    window.piDesktop = createPiDesktopMock({
      session: {
        ...createPiDesktopMock().session,
        create: createMock,
      },
    })

    render(<App />)

    expect(await screen.findByText('Real Pi Session')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'New Chat' }))
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => {
      expect(screen.getByText('Permission denied while creating the session')).toBeTruthy()
      expect(screen.getByRole('heading', { name: 'New Chat' })).toBeTruthy()
    })
  })

  it('rehydrates a newly created session from Pi session detail instead of keeping the old workspace state', async () => {
    const createMock = vi.fn().mockResolvedValue({
      success: true,
      data: {
        id: 'session-6',
        path: 'C:/Users/test/.pi/agent/sessions/client-d/session-6.jsonl',
        cwd: 'D:/PI/client-d',
        title: 'Client D Session',
        source: 'pi',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    })
    const switchMock = vi.fn().mockResolvedValue({
      success: true,
      data: {
        sessionId: 'session-6',
        sessionPath: 'C:/Users/test/.pi/agent/sessions/client-d/session-6.jsonl',
        cwd: 'D:/PI/client-d',
        title: 'Client D Session',
        model: 'openai/gpt-4o-mini',
        thinkingLevel: 'medium',
        messages: [],
        tokenCount: 0,
      },
    })

    window.piDesktop = createPiDesktopMock({
      session: {
        ...createPiDesktopMock().session,
        create: createMock,
        switch: switchMock,
      },
      files: {
        ...createPiDesktopMock().files,
        list: vi
          .fn()
          .mockResolvedValueOnce({ success: true, data: [] })
          .mockResolvedValueOnce({
            success: true,
            data: [
              {
                name: 'client-d-brief.md',
                path: 'D:/PI/client-d/client-d-brief.md',
                isDir: false,
                size: 400,
                modifiedAt: new Date().toISOString(),
              },
            ],
          }),
      },
    })

    render(<App />)

    expect(await screen.findByText('Real Pi Session')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'New Chat' }))
    fireEvent.change(screen.getByPlaceholderText('D:/Work/My Project'), {
      target: { value: 'D:/PI/client-d' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith({ cwd: 'D:/PI/client-d' })
    })
    await waitFor(() => {
      expect(switchMock).toHaveBeenCalledWith('C:/Users/test/.pi/agent/sessions/client-d/session-6.jsonl')
    })
    expect(screen.getAllByText('D:/PI/client-d').length).toBeGreaterThan(0)
  })

  it('keeps a newly created session visible even if the next session scan has not picked it up yet', async () => {
    const createMock = vi.fn().mockResolvedValue({
      success: true,
      data: {
        id: 'session-7',
        path: 'C:/Users/test/.pi/agent/sessions/client-e/session-7.jsonl',
        cwd: 'D:/PI/client-e',
        title: 'Client E Session',
        source: 'pi',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    })
    const switchMock = vi.fn().mockResolvedValue({
      success: true,
      data: {
        sessionId: 'session-7',
        sessionPath: 'C:/Users/test/.pi/agent/sessions/client-e/session-7.jsonl',
        cwd: 'D:/PI/client-e',
        title: 'Client E Session',
        model: 'openai/gpt-4o-mini',
        thinkingLevel: 'medium',
        messages: [],
        tokenCount: 0,
      },
    })
    const listMock = vi
      .fn()
      .mockResolvedValueOnce({
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
      })
      .mockResolvedValueOnce({
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
      })

    window.piDesktop = createPiDesktopMock({
      session: {
        ...createPiDesktopMock().session,
        list: listMock,
        create: createMock,
        switch: switchMock,
      },
    })

    render(<App />)

    expect(await screen.findByText('Real Pi Session')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'New Chat' }))
    fireEvent.change(screen.getByPlaceholderText('D:/Work/My Project'), {
      target: { value: 'D:/PI/client-e' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create' }))

    expect(await screen.findByText('Client E Session')).toBeTruthy()
    expect(screen.getAllByText('D:/PI/client-e').length).toBeGreaterThan(0)
  })

  it('keeps the left sidebar focused on sessions with models and skills as secondary actions', async () => {
    window.piDesktop = createPiDesktopMock()

    render(<App />)

    expect(await screen.findByText('Real Pi Session')).toBeTruthy()
    const leftPanel = screen.getByRole('button', { name: 'New Chat' }).closest('.left')
    expect(leftPanel).toBeTruthy()
    const panel = within(leftPanel as HTMLElement)

    expect(panel.getByRole('button', { name: 'New Chat' })).toBeTruthy()
    expect(panel.queryByRole('tablist', { name: 'Session views' })).toBeNull()
    expect(panel.queryByText('Pi Sessions')).toBeNull()
    expect(panel.getByRole('button', { name: 'D:/PI/app' })).toBeTruthy()
    expect(panel.getByRole('button', { name: 'Models' })).toBeTruthy()
    expect(panel.getByRole('button', { name: 'Skills' })).toBeTruthy()
    expect(panel.getByRole('button', { name: 'Settings' })).toBeTruthy()
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
    expect((await screen.findAllByText('report.md')).length).toBeGreaterThan(0)
    expect((await screen.findAllByText('brief.docx')).length).toBeGreaterThan(0)
    expect(await screen.findByText('assets')).toBeTruthy()
  })

  it('keeps the default web connector visible when the desktop summary omits connectors', async () => {
    window.piDesktop = createPiDesktopMock({
      desktop: {
        getStateSummary: vi.fn().mockResolvedValue({
          success: true,
          data: {
            memory: [],
            skills: [],
          },
        }),
      },
    })

    render(<App />)

    expect(await screen.findByText('Real Pi Session')).toBeTruthy()
    expect(await screen.findByText('Web search')).toBeTruthy()
  })

  it('surfaces nested generated artifacts in the right workspace even when the root file list only has folders', async () => {
    const artifactPath = 'D:/PI/app/reports/progress.md'
    window.piDesktop = createPiDesktopMock({
      files: {
        list: vi.fn().mockResolvedValue({
          success: true,
          data: [
            {
              name: 'reports',
              path: 'D:/PI/app/reports',
              isDir: true,
              size: 0,
              modifiedAt: new Date().toISOString(),
            },
          ],
        }),
        read: vi.fn().mockResolvedValue({ success: true, data: { type: 'text', content: '# Progress' } }),
        save: vi.fn().mockResolvedValue({ success: true }),
        open: vi.fn().mockResolvedValue({ success: true }),
        pickDirectory: vi.fn().mockResolvedValue({ success: true, data: null }),
      },
      artifacts: {
        ...createPiDesktopMock().artifacts,
        list: vi.fn().mockResolvedValue({
          success: true,
          data: [
            {
              id: 'artifact-progress',
              sessionId: 'session-1',
              title: 'progress.md',
              artifactType: 'report',
              sourceKind: 'pi_generated',
              status: 'ready',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              sourcePath: artifactPath,
              metadata: {
                actionLabel: 'Created progress.md',
              },
              versions: [],
            },
          ],
        }),
      },
    })

    render(<App />)

    expect(await screen.findByText('Real Pi Session')).toBeTruthy()
    await waitFor(() => {
      expect(screen.getAllByText('progress.md').length).toBeGreaterThan(0)
    })
    const workspaceSection = screen.getByText('Workspace').closest('.c-sec')
    expect(workspaceSection).toBeTruthy()
    expect(within(workspaceSection as HTMLElement).getByText('progress.md')).toBeTruthy()
  })

  it('refreshes progress, workspace, and context when the active session creates an artifact', async () => {
    const sessionPath = 'C:/Users/test/.pi/agent/sessions/second/session.jsonl'
    const artifactPath = 'D:/PI/second/report.md'
    let agentCallback: ((event: unknown) => void) | null = null
    const artifactListMock = vi.fn(async (sessionKey?: string) => ({
      success: true,
      data: sessionKey === sessionPath
        ? [
            {
              id: 'artifact-report',
              sessionId: 'duplicate-id',
              sessionPath,
              title: 'report.md',
              artifactType: 'report',
              sourceKind: 'pi_generated',
              status: 'ready',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              sourcePath: artifactPath,
              metadata: { actionLabel: 'Created report.md' },
              versions: [],
            },
          ]
        : [],
    }))
    const filesListMock = vi.fn(async (dir: string) => ({
      success: true,
      data: dir === 'D:/PI/second'
        ? [
            {
              name: 'report.md',
              path: artifactPath,
              isDir: false,
              size: 100,
              modifiedAt: new Date().toISOString(),
            },
          ]
        : [],
    }))

    window.piDesktop = createPiDesktopMock({
      chat: {
        send: vi.fn().mockResolvedValue({
          success: true,
          data: {
            sessionId: 'duplicate-id',
            sessionPath,
            createdNewSession: false,
            runId: 'run-artifact',
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
      files: {
        ...createPiDesktopMock().files,
        list: filesListMock,
      },
      artifacts: {
        ...createPiDesktopMock().artifacts,
        list: artifactListMock,
      },
      session: {
        ...createPiDesktopMock().session,
        list: vi.fn().mockResolvedValue({
          success: true,
          data: [
            {
              id: 'duplicate-id',
              path: sessionPath,
              cwd: 'D:/PI/second',
              title: 'Second Session',
              model: 'openai/gpt-4o-mini',
              tokenCount: 0,
              messageCount: 1,
              source: 'pi',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        }),
        getActive: vi.fn().mockResolvedValue({ success: true, data: sessionPath }),
        switch: vi.fn().mockResolvedValue({
          success: true,
          data: {
            sessionId: 'duplicate-id',
            sessionPath,
            cwd: 'D:/PI/second',
            title: 'Second Session',
            model: 'openai/gpt-4o-mini',
            thinkingLevel: 'medium',
            messages: [],
            tokenCount: 0,
          },
        }),
      },
      onAgentEvent: vi.fn((callback) => {
        agentCallback = callback
        return () => {
          agentCallback = null
        }
      }),
    })

    render(<App />)

    expect(await screen.findByText('Second Session')).toBeTruthy()
    const input = await screen.findByPlaceholderText(/Ask Pi/)
    fireEvent.change(input, { target: { value: 'create a report' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(window.piDesktop.chat.send).toHaveBeenCalled()
    })

    await act(async () => {
      agentCallback?.({
        type: 'artifact_created',
        path: artifactPath,
        runId: 'run-artifact',
        sessionId: 'duplicate-id',
        sessionPath,
      })
      await Promise.resolve()
    })

    expect((await screen.findAllByText('Created report.md')).length).toBeGreaterThan(0)
    const workspaceSection = screen.getByText('Workspace').closest('.c-sec')
    const contextSection = screen.getByText('Context').closest('.c-sec')
    expect(workspaceSection).toBeTruthy()
    expect(contextSection).toBeTruthy()
    await waitFor(() => {
      expect(within(workspaceSection as HTMLElement).getByText('report.md')).toBeTruthy()
      expect(within(contextSection as HTMLElement).getByText('report.md')).toBeTruthy()
    })
    expect(filesListMock).toHaveBeenCalledWith('D:/PI/second')
    expect(artifactListMock).toHaveBeenCalledWith(sessionPath)
  })

  it('shows an explicit preview failure instead of silently doing nothing when a file cannot be read', async () => {
    window.piDesktop = createPiDesktopMock({
      files: {
        list: vi.fn().mockResolvedValue({
          success: true,
          data: [
            {
              name: 'report.pdf',
              path: 'D:/PI/app/report.pdf',
              isDir: false,
              size: 2048,
              modifiedAt: new Date().toISOString(),
            },
          ],
        }),
        read: vi.fn().mockResolvedValue({
          success: false,
          error: 'Permission denied while reading preview',
        }),
        save: vi.fn().mockResolvedValue({ success: true }),
        open: vi.fn().mockResolvedValue({ success: true }),
        pickDirectory: vi.fn().mockResolvedValue({ success: true, data: null }),
      },
    })

    render(<App />)

    expect((await screen.findAllByText('report.pdf')).length).toBeGreaterThan(0)
    fireEvent.click(screen.getAllByText('report.pdf')[0])

    expect(await screen.findByText('Preview unavailable')).toBeTruthy()
    expect(screen.getByText('Permission denied while reading preview')).toBeTruthy()
  })

  it('keeps the latest selected preview when an older file read resolves late', async () => {
    let resolveSlow: ((value: unknown) => void) | null = null
    let resolveFast: ((value: unknown) => void) | null = null
    const slowRead = new Promise((resolve) => {
      resolveSlow = resolve
    })
    const fastRead = new Promise((resolve) => {
      resolveFast = resolve
    })

    const readMock = vi.fn((path: string) => {
      if (path.endsWith('slow.md')) return slowRead
      if (path.endsWith('fast.md')) return fastRead
      return Promise.resolve({ success: true, data: { type: 'text', content: '' } })
    })

    window.piDesktop = createPiDesktopMock({
      files: {
        list: vi.fn().mockResolvedValue({
          success: true,
          data: [
            {
              name: 'slow.md',
              path: 'D:/PI/app/slow.md',
              isDir: false,
              size: 100,
              modifiedAt: new Date().toISOString(),
            },
            {
              name: 'fast.md',
              path: 'D:/PI/app/fast.md',
              isDir: false,
              size: 100,
              modifiedAt: new Date().toISOString(),
            },
          ],
        }),
        read: readMock,
        save: vi.fn().mockResolvedValue({ success: true }),
        open: vi.fn().mockResolvedValue({ success: true }),
        pickDirectory: vi.fn().mockResolvedValue({ success: true, data: null }),
      },
    })

    render(<App />)

    expect((await screen.findAllByText('slow.md')).length).toBeGreaterThan(0)
    fireEvent.click(screen.getAllByText('slow.md')[0])
    fireEvent.click(screen.getAllByText('fast.md')[0])

    await act(async () => {
      resolveFast?.({ success: true, data: { type: 'text', content: 'Fast content' } })
    })

    expect(await screen.findByText('Fast content')).toBeTruthy()

    await act(async () => {
      resolveSlow?.({ success: true, data: { type: 'text', content: 'Slow content' } })
    })

    await waitFor(() => {
      expect(screen.getByText('Fast content')).toBeTruthy()
      expect(screen.queryByText('Slow content')).toBeNull()
    })
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

  it('ignores stale agent events from an older run in the same session', async () => {
    let agentCallback: ((event: unknown) => void) | null = null

    window.piDesktop = createPiDesktopMock({
      chat: {
        send: vi.fn().mockResolvedValue({
          success: true,
          data: {
            sessionId: 'session-1',
            sessionPath: 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl',
            createdNewSession: false,
            runId: 'run-current',
          },
        }),
        abort: vi.fn().mockResolvedValue({ success: true }),
      },
      onAgentEvent: vi.fn((callback) => {
        agentCallback = callback
        return () => {
          agentCallback = null
        }
      }),
    })

    render(<App />)

    const input = await screen.findByPlaceholderText(/Ask Pi/)
    fireEvent.change(input, { target: { value: 'answer this' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(window.piDesktop.chat.send).toHaveBeenCalled()
    })

    await act(async () => {
      agentCallback?.({
        type: 'token',
        text: 'stale output',
        runId: 'run-old',
        sessionId: 'session-1',
        sessionPath: 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl',
      })
      agentCallback?.({
        type: 'token',
        text: 'fresh output',
        runId: 'run-current',
        sessionId: 'session-1',
        sessionPath: 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl',
      })
    })

    expect(await screen.findByText('fresh output')).toBeTruthy()
    expect(screen.queryByText('stale output')).toBeNull()
  })

  it('does not show a fake context full warning for high historical token counts without a model limit', async () => {
    const highTokenSession = {
      id: 'session-1',
      path: 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl',
      cwd: 'D:/PI/app',
      title: 'Real Pi Session',
      model: 'openai/gpt-4o-mini',
      tokenCount: 322291,
      messageCount: 3,
      source: 'pi' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    window.piDesktop = createPiDesktopMock({
      session: {
        ...createPiDesktopMock().session,
        list: vi.fn().mockResolvedValue({ success: true, data: [highTokenSession] }),
        switch: vi.fn().mockResolvedValue({
          success: true,
          data: {
            sessionId: 'session-1',
            sessionPath: highTokenSession.path,
            cwd: highTokenSession.cwd,
            title: highTokenSession.title,
            model: highTokenSession.model,
            thinkingLevel: 'medium',
            messages: [],
            tokenCount: highTokenSession.tokenCount,
          },
        }),
      },
    })

    render(<App />)

    expect(await screen.findByText('Real Pi Session')).toBeTruthy()
    expect(screen.queryByText(/Context 100% full/)).toBeNull()
    expect(screen.getByText(/History tokens/i)).toBeTruthy()
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

  it('restores the active Pi session by path when duplicate session ids exist', async () => {
    const firstPath = 'C:/Users/test/.pi/agent/sessions/first/session.jsonl'
    const secondPath = 'C:/Users/test/.pi/agent/sessions/second/session.jsonl'
    const switchMock = vi.fn(async (sessionPath: string) => ({
      success: true,
      data: {
        sessionId: 'duplicate-id',
        sessionPath,
        cwd: sessionPath === secondPath ? 'D:/PI/second' : 'D:/PI/first',
        title: sessionPath === secondPath ? 'Second Session' : 'First Session',
        model: 'openai/gpt-4o-mini',
        thinkingLevel: 'medium',
        messages: [],
        tokenCount: 0,
      },
    }))

    window.piDesktop = createPiDesktopMock({
      session: {
        ...createPiDesktopMock().session,
        list: vi.fn().mockResolvedValue({
          success: true,
          data: [
            {
              id: 'duplicate-id',
              path: firstPath,
              cwd: 'D:/PI/first',
              title: 'First Session',
              model: 'openai/gpt-4o-mini',
              tokenCount: 0,
              messageCount: 1,
              source: 'pi',
              createdAt: new Date().toISOString(),
              updatedAt: new Date(Date.now() + 1000).toISOString(),
            },
            {
              id: 'duplicate-id',
              path: secondPath,
              cwd: 'D:/PI/second',
              title: 'Second Session',
              model: 'openai/gpt-4o-mini',
              tokenCount: 0,
              messageCount: 1,
              source: 'pi',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        }),
        getActive: vi.fn().mockResolvedValue({ success: true, data: secondPath }),
        switch: switchMock,
      },
    })

    render(<App />)

    expect(await screen.findByText('Second Session')).toBeTruthy()
    await waitFor(() => {
      expect(switchMock).toHaveBeenCalledWith(secondPath)
    })
    expect(switchMock).not.toHaveBeenCalledWith(firstPath)
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

  it('collapses a Pi tool-use turn into a single assistant reply when syncing session history', async () => {
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
            tokenCount: 256,
            messages: [
              {
                role: 'user',
                timestamp: Date.now() - 4_000,
                content: [{ type: 'text', text: 'What is this repo?' }],
              },
              {
                role: 'assistant',
                timestamp: Date.now() - 3_000,
                content: [
                  { type: 'thinking', thinking: 'Checking the repository.' },
                  { type: 'toolCall', id: 'tool-1', name: 'read', arguments: { path: 'README.md' } },
                ],
              },
              {
                role: 'toolResult',
                toolName: 'read',
                toolCallId: 'tool-1',
                timestamp: Date.now() - 2_000,
                content: [{ type: 'text', text: 'README loaded' }],
                isError: false,
              },
              {
                role: 'assistant',
                timestamp: Date.now() - 1_000,
                content: [{ type: 'text', text: 'This repository is an AI desktop client.' }],
              },
            ],
          },
        }),
      },
    })

    const { container } = render(<App />)

    expect(await screen.findByText('This repository is an AI desktop client.')).toBeTruthy()
    expect(await screen.findByText(/read/)).toBeTruthy()
    expect(container.querySelectorAll('.msg.left').length).toBe(1)
    expect(container.querySelectorAll('.msg.right').length).toBe(1)
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

  it('collapses plain-text thinking blocks from session history', async () => {
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
            tokenCount: 128,
            messages: [
              {
                role: 'assistant',
                timestamp: Date.now(),
                content: '<thinking>private reasoning from Pi</thinking>\nFinal answer for the user',
              },
            ],
          },
        }),
      },
    })

    render(<App />)

    expect(await screen.findByText('Final answer for the user')).toBeTruthy()
    expect(screen.getByRole('button', { name: /show thinking/i })).toBeTruthy()
    expect(screen.queryByText('private reasoning from Pi')).toBeNull()
  })

  it('does not show runtime progress from another active session in the right workbench', async () => {
    let agentCallback: ((event: unknown) => void) | null = null
    const sessionOnePath = 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl'
    const sessionTwoPath = 'C:/Users/test/.pi/agent/sessions/other/session-2.jsonl'
    const now = new Date().toISOString()

    window.piDesktop = createPiDesktopMock({
      session: {
        ...createPiDesktopMock().session,
        list: vi.fn().mockResolvedValue({
          success: true,
          data: [
            {
              id: 'session-1',
              path: sessionOnePath,
              cwd: 'D:/PI/app',
              title: 'Real Pi Session',
              model: 'openai/gpt-4o-mini',
              tokenCount: 0,
              messageCount: 0,
              source: 'pi',
              createdAt: now,
              updatedAt: now,
            },
            {
              id: 'session-2',
              path: sessionTwoPath,
              cwd: 'D:/PI/other',
              title: 'Other Session',
              model: 'openai/gpt-4o-mini',
              tokenCount: 0,
              messageCount: 0,
              source: 'pi',
              createdAt: now,
              updatedAt: now,
            },
          ],
        }),
        switch: vi.fn(async (sessionPath: string) => ({
          success: true,
          data: {
            sessionId: sessionPath === sessionTwoPath ? 'session-2' : 'session-1',
            sessionPath,
            cwd: sessionPath === sessionTwoPath ? 'D:/PI/other' : 'D:/PI/app',
            title: sessionPath === sessionTwoPath ? 'Other Session' : 'Real Pi Session',
            model: 'openai/gpt-4o-mini',
            thinkingLevel: 'medium',
            tokenCount: 0,
            messages: [],
          },
        })),
      },
      onAgentEvent: vi.fn((callback) => {
        agentCallback = callback
        return () => {
          agentCallback = null
        }
      }),
    })

    render(<App />)

    expect(await screen.findByText('Real Pi Session')).toBeTruthy()

    await act(async () => {
      agentCallback?.({
        type: 'status',
        status: 'reading_file',
        statusLabel: 'Reading files',
        lastAction: 'Reading session one files',
        isWaitingForUser: false,
        sessionId: 'session-1',
        sessionPath: sessionOnePath,
      })
    })

    expect((await screen.findAllByText('Reading session one files')).length).toBeGreaterThan(0)

    fireEvent.click(await screen.findByText('Other Session'))

    await waitFor(() => {
      expect(screen.queryByText('Reading session one files')).toBeNull()
    })
  })

  it('syncs the right workspace when the active session done event reports a new cwd', async () => {
    let agentCallback: ((event: unknown) => void) | null = null
    const listMock = vi.fn(async (dir: string) => ({
      success: true,
      data: [
        {
          name: dir.includes('Downloads') ? 'download-only.txt' : 'app-only.ts',
          path: `${dir}/${dir.includes('Downloads') ? 'download-only.txt' : 'app-only.ts'}`,
          isDir: false,
          size: 10,
          modifiedAt: new Date().toISOString(),
        },
      ],
    }))

    window.piDesktop = createPiDesktopMock({
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
      files: {
        ...createPiDesktopMock().files,
        list: listMock,
      },
      onAgentEvent: vi.fn((callback) => {
        agentCallback = callback
        return () => {
          agentCallback = null
        }
      }),
    })

    render(<App />)

    expect(await screen.findByText('Real Pi Session')).toBeTruthy()
    expect(await screen.findByText('app-only.ts')).toBeTruthy()

    const input = await screen.findByPlaceholderText(/Ask Pi/)
    fireEvent.change(input, { target: { value: 'check workspace' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(window.piDesktop.chat.send).toHaveBeenCalled()
    })

    await act(async () => {
      agentCallback?.({
        type: 'done',
        runId: 'run-1',
        sessionId: 'session-1',
        sessionPath: 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl',
        session: {
          sessionId: 'session-1',
          sessionPath: 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl',
          cwd: 'C:/Users/test/Downloads',
          title: 'Downloads Session',
          model: 'openai/gpt-4o-mini',
          thinkingLevel: 'medium',
          tokenCount: 0,
          messages: [],
        },
      })
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(listMock).toHaveBeenCalledWith('C:/Users/test/Downloads')
    })
    await waitFor(() => {
      expect(screen.getAllByText('C:/Users/test/Downloads').length).toBeGreaterThan(0)
      expect(screen.queryByText('app-only.ts')).toBeNull()
      expect(screen.getAllByText('download-only.txt').length).toBeGreaterThan(0)
    })
  })

  it('adopts the active run session cwd for the right workbench when no workspace is configured', async () => {
    let agentCallback: ((event: unknown) => void) | null = null
    const sessionPath = 'C:/Users/test/.pi/agent/sessions/runtime/session-runtime.jsonl'
    const runtimeCwd = 'D:/PI/runtime-workspace'
    const now = new Date().toISOString()
    const listMock = vi.fn(async (dir: string) => ({
      success: true,
      data: dir === runtimeCwd
        ? [
            {
              name: 'generated.md',
              path: `${runtimeCwd}/generated.md`,
              isDir: false,
              size: 42,
              modifiedAt: now,
            },
          ]
        : [],
    }))

    window.piDesktop = createPiDesktopMock({
      config: {
        get: vi.fn(async (key: string) => {
          if (key === 'workingDirectory') return { success: true, data: null }
          if (key === 'wizardCompleted') return { success: true, data: 'true' }
          return { success: true, data: null }
        }),
        set: vi.fn().mockResolvedValue({ success: true }),
      },
      chat: {
        send: vi.fn().mockResolvedValue({
          success: true,
          data: {
            sessionId: 'session-runtime',
            sessionPath,
            createdNewSession: false,
            runId: 'run-runtime',
          },
        }),
        abort: vi.fn().mockResolvedValue({ success: true }),
      },
      session: {
        ...createPiDesktopMock().session,
        list: vi.fn().mockResolvedValue({
          success: true,
          data: [
            {
              id: 'session-runtime',
              path: sessionPath,
              cwd: runtimeCwd,
              title: 'Runtime Session',
              model: 'openai/gpt-4o-mini',
              tokenCount: 0,
              messageCount: 0,
              source: 'pi',
              createdAt: now,
              updatedAt: now,
            },
          ],
        }),
        getActive: vi.fn().mockResolvedValue({ success: true, data: 'session-runtime' }),
        switch: vi.fn().mockResolvedValue({
          success: true,
          data: {
            sessionId: 'session-runtime',
            sessionPath,
            cwd: runtimeCwd,
            title: 'Runtime Session',
            model: 'openai/gpt-4o-mini',
            thinkingLevel: 'medium',
            messages: [],
            tokenCount: 0,
          },
        }),
      },
      files: {
        ...createPiDesktopMock().files,
        list: listMock,
      },
      onAgentEvent: vi.fn((callback) => {
        agentCallback = callback
        return () => {
          agentCallback = null
        }
      }),
    })

    render(<App />)

    expect(await screen.findByText('Runtime Session')).toBeTruthy()
    expect((await screen.findAllByText(runtimeCwd)).length).toBeGreaterThan(0)
    expect(listMock).toHaveBeenCalledWith(runtimeCwd)

    const input = await screen.findByPlaceholderText(/Ask Pi/)
    fireEvent.change(input, { target: { value: 'create a markdown file' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(window.piDesktop.chat.send).toHaveBeenCalled()
    })

    await act(async () => {
      agentCallback?.({
        type: 'status',
        status: 'writing_file',
        statusLabel: 'Writing file',
        lastAction: 'Creating generated.md',
        isWaitingForUser: false,
        runId: 'run-runtime',
        sessionId: 'session-runtime',
        sessionPath,
      })
    })

    expect((await screen.findAllByText('Creating generated.md')).length).toBeGreaterThan(0)

    await act(async () => {
      agentCallback?.({
        type: 'done',
        runId: 'run-runtime',
        sessionId: 'session-runtime',
        sessionPath,
        session: {
          sessionId: 'session-runtime',
          sessionPath,
          cwd: runtimeCwd,
          title: 'Runtime Session',
          model: 'openai/gpt-4o-mini',
          thinkingLevel: 'medium',
          tokenCount: 0,
          messages: [],
        },
      })
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(listMock).toHaveBeenCalledWith(runtimeCwd)
    })
    await waitFor(() => {
      expect(screen.getAllByText(runtimeCwd).length).toBeGreaterThan(0)
    })
    expect((await screen.findAllByText('generated.md')).length).toBeGreaterThanOrEqual(2)
    expect(window.piDesktop.config.set).not.toHaveBeenCalledWith('workingDirectory', runtimeCwd)
  })

  it('keeps implicit session progress visible after chat.send returns the new session path', async () => {
    window.piDesktop = createPiDesktopMock({
      config: {
        get: vi.fn(async (key: string) => {
          if (key === 'workingDirectory') return { success: true, data: null }
          if (key === 'wizardCompleted') return { success: true, data: 'true' }
          return { success: true, data: null }
        }),
        set: vi.fn().mockResolvedValue({ success: true }),
      },
      chat: {
        send: vi.fn().mockResolvedValue({
          success: true,
          data: {
            sessionId: 'session-implicit-progress',
            sessionPath: 'C:/Users/test/.pi/agent/sessions/runtime/session-implicit-progress.jsonl',
            createdNewSession: true,
            runId: 'run-implicit-progress',
          },
        }),
        abort: vi.fn().mockResolvedValue({ success: true }),
      },
      session: {
        ...createPiDesktopMock().session,
        list: vi.fn().mockResolvedValue({ success: true, data: [] }),
        getActive: vi.fn().mockResolvedValue({ success: true, data: null }),
      },
    })

    render(<App />)

    expect(await screen.findByText('Choose workspace...')).toBeTruthy()
    const input = await screen.findByPlaceholderText(/Ask Pi/)
    fireEvent.change(input, { target: { value: 'create a markdown file' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(window.piDesktop.chat.send).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(screen.getAllByText('Creating a new Pi session').length).toBeGreaterThan(0)
    })
  })

  it('selects sessions by path when Pi reports duplicate session ids', async () => {
    const switchMock = vi.fn(async (sessionPath: string) => ({
      success: true,
      data: {
        sessionId: 'duplicate-id',
        sessionPath,
        cwd: sessionPath.includes('second') ? 'D:/PI/second' : 'D:/PI/first',
        title: sessionPath.includes('second') ? 'Second Session' : 'First Session',
        model: 'openai/gpt-4o-mini',
        thinkingLevel: 'medium',
        messages: [
          {
            role: 'assistant',
            content: sessionPath.includes('second') ? 'Second session answer' : 'First session answer',
            timestamp: Date.now(),
          },
        ],
        tokenCount: 0,
      },
    }))

    window.piDesktop = createPiDesktopMock({
      session: {
        ...createPiDesktopMock().session,
        list: vi.fn().mockResolvedValue({
          success: true,
          data: [
            {
              id: 'duplicate-id',
              path: 'C:/Users/test/.pi/agent/sessions/first/session.jsonl',
              cwd: 'D:/PI/first',
              title: 'First Session',
              model: 'openai/gpt-4o-mini',
              tokenCount: 0,
              messageCount: 1,
              source: 'pi',
              createdAt: new Date().toISOString(),
              updatedAt: new Date(Date.now() - 1000).toISOString(),
            },
            {
              id: 'duplicate-id',
              path: 'C:/Users/test/.pi/agent/sessions/second/session.jsonl',
              cwd: 'D:/PI/second',
              title: 'Second Session',
              model: 'openai/gpt-4o-mini',
              tokenCount: 0,
              messageCount: 1,
              source: 'pi',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        }),
        getActive: vi.fn().mockResolvedValue({ success: true, data: null }),
        switch: switchMock,
      },
    })

    render(<App />)

    expect(await screen.findByText('Second Session')).toBeTruthy()
    fireEvent.click(screen.getByText('Second Session'))

    await waitFor(() => {
      expect(switchMock).toHaveBeenCalledWith('C:/Users/test/.pi/agent/sessions/second/session.jsonl')
    })
    expect(await screen.findByText('Second session answer')).toBeTruthy()
  })

  it('keeps messages and right-panel artifacts separated by session path when Pi reports duplicate session ids', async () => {
    const firstPath = 'C:/Users/test/.pi/agent/sessions/first/session.jsonl'
    const secondPath = 'C:/Users/test/.pi/agent/sessions/second/session.jsonl'
    const now = new Date().toISOString()
    const switchMock = vi.fn(async (sessionPath: string) => ({
      success: true,
      data: {
        sessionId: 'duplicate-id',
        sessionPath,
        cwd: sessionPath === secondPath ? 'D:/PI/second' : 'D:/PI/first',
        title: sessionPath === secondPath ? 'Second Session' : 'First Session',
        model: 'openai/gpt-4o-mini',
        thinkingLevel: 'medium',
        messages: [
          {
            role: 'assistant',
            content: sessionPath === secondPath ? 'Second session answer' : 'First session answer',
            timestamp: Date.now(),
          },
        ],
        tokenCount: 0,
      },
    }))
    const artifactListMock = vi.fn(async (sessionKey?: string) => ({
      success: true,
      data: sessionKey === secondPath
        ? [
            {
              id: 'artifact-second',
              sessionId: 'duplicate-id',
              sessionPath: secondPath,
              title: 'second.md',
              artifactType: 'report',
              sourceKind: 'pi_generated',
              status: 'ready',
              createdAt: now,
              updatedAt: now,
              sourcePath: 'D:/PI/second/second.md',
              metadata: { actionLabel: 'Created second.md' },
              versions: [],
            },
          ]
        : [
            {
              id: 'artifact-first',
              sessionId: 'duplicate-id',
              sessionPath: firstPath,
              title: 'first.md',
              artifactType: 'report',
              sourceKind: 'pi_generated',
              status: 'ready',
              createdAt: now,
              updatedAt: now,
              sourcePath: 'D:/PI/first/first.md',
              metadata: { actionLabel: 'Created first.md' },
              versions: [],
            },
          ],
    }))

    window.piDesktop = createPiDesktopMock({
      session: {
        ...createPiDesktopMock().session,
        list: vi.fn().mockResolvedValue({
          success: true,
          data: [
            {
              id: 'duplicate-id',
              path: firstPath,
              cwd: 'D:/PI/first',
              title: 'First Session',
              model: 'openai/gpt-4o-mini',
              tokenCount: 0,
              messageCount: 1,
              source: 'pi',
              createdAt: now,
              updatedAt: new Date(Date.now() - 1000).toISOString(),
            },
            {
              id: 'duplicate-id',
              path: secondPath,
              cwd: 'D:/PI/second',
              title: 'Second Session',
              model: 'openai/gpt-4o-mini',
              tokenCount: 0,
              messageCount: 1,
              source: 'pi',
              createdAt: now,
              updatedAt: now,
            },
          ],
        }),
        getActive: vi.fn().mockResolvedValue({ success: true, data: null }),
        switch: switchMock,
      },
      artifacts: {
        ...createPiDesktopMock().artifacts,
        list: artifactListMock,
      },
    })

    render(<App />)

    expect(await screen.findByText('Second Session')).toBeTruthy()
    fireEvent.click(screen.getByText('Second Session'))

    expect(await screen.findByText('Second session answer')).toBeTruthy()
    expect((await screen.findAllByText('second.md')).length).toBeGreaterThan(0)
    expect(screen.queryByText('First session answer')).toBeNull()
    expect(screen.queryByText('first.md')).toBeNull()
    expect(artifactListMock).toHaveBeenCalledWith(secondPath)
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
    fireEvent.click(screen.getByTitle('D:/PI/app'))
    fireEvent.click(await screen.findByText('D:/PI/other'))

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
    fireEvent.click(screen.getByTitle('D:/PI/app'))
    fireEvent.click(await screen.findByText('D:/PI/other'))

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

  it('keeps progress running after artifact creation until the terminal done event arrives', async () => {
    let agentListener: ((event: any) => void) | undefined
    const sessionPath = 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl'
    const artifactPath = 'D:/PI/app/report.md'

    window.piDesktop = createPiDesktopMock({
      artifacts: {
        ...createPiDesktopMock().artifacts,
        list: vi.fn().mockResolvedValue({
          success: true,
          data: [
            {
              id: 'artifact-running',
              sessionId: 'session-1',
              sessionPath,
              title: 'report.md',
              artifactType: 'report',
              sourceKind: 'pi_generated',
              status: 'ready',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              sourcePath: artifactPath,
              metadata: { actionLabel: 'Created report.md' },
              versions: [],
            },
          ],
        }),
      },
      files: {
        ...createPiDesktopMock().files,
        list: vi.fn().mockResolvedValue({
          success: true,
          data: [
            {
              name: 'report.md',
              path: artifactPath,
              isDir: false,
              size: 120,
              modifiedAt: new Date().toISOString(),
            },
          ],
        }),
      },
      onAgentEvent: vi.fn((callback) => {
        agentListener = callback
        return () => {}
      }),
    })

    render(<App />)

    expect(await screen.findByText('Real Pi Session')).toBeTruthy()

    await act(async () => {
      agentListener?.({
        type: 'status',
        status: 'writing_file',
        statusLabel: 'Writing file',
        lastAction: 'Creating report.md',
        isWaitingForUser: false,
        runId: 'run-progress',
        sessionId: 'session-1',
        sessionPath,
        startedAt: Date.now(),
      })
    })

    await act(async () => {
      agentListener?.({
        type: 'artifact_created',
        path: artifactPath,
        runId: 'run-progress',
        sessionId: 'session-1',
        sessionPath,
      })
      await Promise.resolve()
    })

    const progressSection = screen.getByText('Progress').closest('.c-sec')
    const contextSection = screen.getByText('Context').closest('.c-sec')
    expect(progressSection).toBeTruthy()
    expect(contextSection).toBeTruthy()

    await waitFor(() => {
      expect(within(progressSection as HTMLElement).queryByText('Completed')).toBeNull()
      expect(within(progressSection as HTMLElement).getByText(/Created report\.md/i)).toBeTruthy()
      expect(within(contextSection as HTMLElement).getByText('report.md')).toBeTruthy()
    })

    await act(async () => {
      agentListener?.({
        type: 'done',
        runId: 'run-progress',
        sessionId: 'session-1',
        sessionPath,
        session: {
          sessionId: 'session-1',
          sessionPath,
          cwd: 'D:/PI/app',
          title: 'Real Pi Session',
          model: 'openai/gpt-4o-mini',
          thinkingLevel: 'medium',
          tokenCount: 0,
          messages: [],
        },
      })
    })

    await waitFor(() => {
      expect(within(progressSection as HTMLElement).getByText('Completed')).toBeTruthy()
    })
  })

  it('replaces temporary streaming messages with synced session history when done arrives', async () => {
    let agentListener: ((event: any) => void) | undefined
    const sessionPath = 'C:/Users/test/.pi/agent/sessions/project/session-1.jsonl'

    window.piDesktop = createPiDesktopMock({
      chat: {
        send: vi.fn().mockResolvedValue({
          success: true,
          data: {
            sessionId: 'session-1',
            sessionPath,
            createdNewSession: false,
            runId: 'run-sync-history',
          },
        }),
        abort: vi.fn().mockResolvedValue({ success: true }),
      },
      onAgentEvent: vi.fn((callback) => {
        agentListener = callback
        return () => {}
      }),
    })

    render(<App />)

    expect(await screen.findByText('Real Pi Session')).toBeTruthy()
    const input = await screen.findByPlaceholderText(/Ask Pi/)
    fireEvent.change(input, { target: { value: 'search bilibili hot list' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(window.piDesktop.chat.send).toHaveBeenCalled()
    })

    await act(async () => {
      agentListener?.({
        type: 'done',
        runId: 'run-sync-history',
        sessionId: 'session-1',
        sessionPath,
        session: {
          sessionId: 'session-1',
          sessionPath,
          cwd: 'D:/PI/app',
          title: 'Real Pi Session',
          model: 'openai/gpt-4o-mini',
          thinkingLevel: 'medium',
          tokenCount: 12,
          messages: [
            {
              role: 'user',
              content: 'search bilibili hot list',
              timestamp: Date.now() - 100,
            },
            {
              role: 'assistant',
              content: 'Here is the synced final answer from Pi.',
              timestamp: Date.now(),
            },
          ],
        },
      })
    })

    expect(await screen.findByText('Here is the synced final answer from Pi.')).toBeTruthy()
    expect(screen.queryByText('(Pi completed this turn without a final text response.)')).toBeNull()
  })

  it('shows the selected session history instead of the streaming session while another run is thinking', async () => {
    let resolveSend: (value: unknown) => void = () => {}
    let agentListener: ((event: any) => void) | undefined
    const firstPath = 'C:/Users/test/.pi/agent/sessions/first/session.jsonl'
    const secondPath = 'C:/Users/test/.pi/agent/sessions/second/session.jsonl'
    const now = new Date().toISOString()
    const switchMock = vi.fn(async (sessionPath: string) => ({
      success: true,
      data: {
        sessionId: sessionPath === firstPath ? 'session-1' : 'session-2',
        sessionPath,
        cwd: sessionPath === firstPath ? 'D:/PI/first' : 'D:/PI/second',
        title: sessionPath === firstPath ? 'First Session' : 'Second Session',
        model: 'openai/gpt-4o-mini',
        thinkingLevel: 'medium',
        messages: [
          {
            role: 'assistant',
            content: sessionPath === firstPath ? 'First session answer' : 'Second session answer',
            timestamp: Date.now(),
          },
        ],
        tokenCount: 0,
      },
    }))

    window.piDesktop = createPiDesktopMock({
      chat: {
        send: vi.fn().mockReturnValue(new Promise((resolve) => { resolveSend = resolve })),
        abort: vi.fn().mockResolvedValue({ success: true }),
      },
      session: {
        ...createPiDesktopMock().session,
        list: vi.fn().mockResolvedValue({
          success: true,
          data: [
            {
              id: 'session-1',
              path: firstPath,
              cwd: 'D:/PI/first',
              title: 'First Session',
              model: 'openai/gpt-4o-mini',
              tokenCount: 0,
              messageCount: 1,
              source: 'pi',
              createdAt: now,
              updatedAt: now,
            },
            {
              id: 'session-2',
              path: secondPath,
              cwd: 'D:/PI/second',
              title: 'Second Session',
              model: 'openai/gpt-4o-mini',
              tokenCount: 0,
              messageCount: 1,
              source: 'pi',
              createdAt: now,
              updatedAt: new Date(Date.now() - 1000).toISOString(),
            },
          ],
        }),
        getActive: vi.fn().mockResolvedValue({ success: true, data: firstPath }),
        switch: switchMock,
      },
      onAgentEvent: vi.fn((callback) => {
        agentListener = callback
        return () => {}
      }),
    })

    render(<App />)

    expect(await screen.findByText('First Session')).toBeTruthy()
    expect(await screen.findByText('First session answer')).toBeTruthy()

    const input = await screen.findByPlaceholderText(/Ask Pi/)
    fireEvent.change(input, { target: { value: 'keep thinking' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => {
      expect(window.piDesktop.chat.send).toHaveBeenCalled()
    })
    expect(await screen.findByText('keep thinking')).toBeTruthy()

    fireEvent.click(screen.getByText('Second Session'))

    expect(await screen.findByText('Second session answer')).toBeTruthy()
    expect(screen.queryByText('keep thinking')).toBeNull()
    expect(screen.queryByText('Pi is thinking...')).toBeNull()

    await act(async () => {
      resolveSend({
        success: true,
        data: {
          sessionId: 'session-1',
          sessionPath: firstPath,
          createdNewSession: false,
          runId: 'run-first',
        },
      })
      await Promise.resolve()
    })

    await act(async () => {
      agentListener?.({
        type: 'done',
        runId: 'run-first',
        session: {
          sessionId: 'session-1',
          sessionPath: firstPath,
          cwd: 'D:/PI/first',
          title: 'First Session',
          model: 'openai/gpt-4o-mini',
          thinkingLevel: 'medium',
          tokenCount: 0,
          messages: [
            {
              role: 'user',
              content: 'keep thinking',
              timestamp: Date.now() - 100,
            },
            {
              role: 'assistant',
              content: 'First final answer',
              timestamp: Date.now(),
            },
          ],
        },
      })
      await Promise.resolve()
    })

    await waitFor(() => {
      expect((screen.getByPlaceholderText(/Ask Pi/) as HTMLInputElement).disabled).toBe(false)
    })
    expect(screen.getByText('Second session answer')).toBeTruthy()
    expect(screen.queryByText('First final answer')).toBeNull()
  })

  it('marks the shell when both side panels are collapsed so the chat rail can widen', async () => {
    window.piDesktop = createPiDesktopMock()

    const { container } = render(<App />)

    expect(await screen.findByText('Real Pi Session')).toBeTruthy()
    const shell = container.querySelector('.app-shell') as HTMLElement
    expect(shell.classList.contains('both-panels-collapsed')).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }))
    expect(shell.classList.contains('left-panel-collapsed')).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Hide panel' }))
    expect(shell.classList.contains('right-panel-collapsed')).toBe(true)
    expect(shell.classList.contains('both-panels-collapsed')).toBe(true)
  })
})
