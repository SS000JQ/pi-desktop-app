import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import InputBar from '../../src/renderer/src/components/InputBar'

describe('InputBar', () => {
  it('calls onSendMessage when Enter is pressed', () => {
    const onSend = vi.fn()
    render(<InputBar onSendMessage={onSend} isStreaming={false} />)
    const input = screen.getByPlaceholderText(/Ask Pi/)
    fireEvent.change(input, { target: { value: 'hello' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSend).toHaveBeenCalledWith('hello', expect.objectContaining({ displayText: 'hello', attachments: [] }))
  })

  it('does not call onSendMessage when empty', () => {
    const onSend = vi.fn()
    render(<InputBar onSendMessage={onSend} isStreaming={false} />)
    const input = screen.getByPlaceholderText(/Ask Pi/)
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSend).not.toHaveBeenCalled()
  })

  it('disables input while streaming', () => {
    render(<InputBar onSendMessage={() => {}} isStreaming={true} />)
    const input = screen.getByPlaceholderText(/Ask Pi/) as HTMLInputElement
    expect(input.disabled).toBe(true)
  })

  it('renders dynamic slash commands instead of a hard-coded list', () => {
    render(
      <InputBar
        onSendMessage={() => {}}
        isStreaming={false}
        slashCommands={[
          {
            id: 'skill:pdf',
            command: '/skill:pdf',
            label: 'pdf',
            description: 'Read PDFs',
            kind: 'skill',
            source: 'skill',
          },
          {
            id: 'prompt:review',
            command: '/review',
            label: 'review',
            description: 'Review changes',
            kind: 'prompt',
            source: 'prompt',
            argumentHint: '[scope]',
          },
        ]}
      />,
    )

    const input = screen.getByPlaceholderText(/Ask Pi/)
    fireEvent.change(input, { target: { value: '/' } })

    fireEvent.click(screen.getByRole('button', { name: 'Skills commands' }))
    fireEvent.click(screen.getByRole('button', { name: 'Prompts commands' }))

    expect(screen.getByText('/skill:pdf')).toBeTruthy()
    expect(screen.getByText('/review')).toBeTruthy()
    expect(screen.getByText('[scope]')).toBeTruthy()
  })

  it('collapses resource slash command groups until the user expands them', () => {
    render(
      <InputBar
        onSendMessage={() => {}}
        isStreaming={false}
        slashCommands={[
          {
            id: 'desktop:new',
            command: '/new',
            label: 'New',
            description: 'Create session',
            kind: 'desktop',
            execution: 'desktop',
            source: 'Pi Desktop',
            group: 'Desktop',
          },
          {
            id: 'skill:pdf',
            command: '/skill:pdf',
            label: 'pdf',
            description: 'Read PDFs',
            kind: 'skill',
            execution: 'prompt',
            source: 'skill',
          },
        ]}
      />,
    )

    const input = screen.getByPlaceholderText(/Ask Pi/)
    fireEvent.change(input, { target: { value: '/' } })

    expect(screen.getByText('/new')).toBeTruthy()
    expect(screen.queryByText('/skill:pdf')).toBeNull()

    const skillsGroup = screen.getByRole('button', { name: 'Skills commands' })
    expect(skillsGroup.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(skillsGroup)

    expect(skillsGroup.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('/skill:pdf')).toBeTruthy()
  })

  it('keeps desktop fallback commands available while dynamic commands are loading', () => {
    render(<InputBar onSendMessage={() => {}} isStreaming={false} slashCommands={[]} />)

    const input = screen.getByPlaceholderText(/Ask Pi/)
    fireEvent.change(input, { target: { value: '/' } })

    expect(screen.getByText('/new')).toBeTruthy()
    expect(screen.getByText('/skills')).toBeTruthy()
    expect(screen.getByText('/reload')).toBeTruthy()
  })

  it('sends Pi slash commands as normal messages when they are not desktop commands', () => {
    const onSend = vi.fn()
    const onCommand = vi.fn()
    render(
      <InputBar
        onSendMessage={onSend}
        isStreaming={false}
        onCommand={onCommand}
        slashCommands={[
          {
            id: 'skill:pdf',
            command: '/skill:pdf',
            label: 'pdf',
            description: 'Read PDFs',
            kind: 'skill',
            execution: 'prompt',
            source: 'skill',
          },
        ]}
      />,
    )

    const input = screen.getByPlaceholderText(/Ask Pi/)
    fireEvent.change(input, { target: { value: '/skill:pdf summarize this' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onSend).toHaveBeenCalledWith('/skill:pdf summarize this', expect.objectContaining({ displayText: '/skill:pdf summarize this', attachments: [] }))
    expect(onCommand).not.toHaveBeenCalled()
  })

  it('routes runtime slash commands through onCommand instead of sending prompt text', () => {
    const onSend = vi.fn()
    const onCommand = vi.fn()
    render(
      <InputBar
        onSendMessage={onSend}
        isStreaming={false}
        onCommand={onCommand}
        slashCommands={[
          {
            id: 'pi:compact',
            command: '/compact',
            label: 'Compact',
            description: 'Compact context',
            kind: 'pi_runtime',
            execution: 'runtime',
            source: 'Pi',
          },
        ]}
      />,
    )

    const input = screen.getByPlaceholderText(/Ask Pi/)
    fireEvent.change(input, { target: { value: '/compact focus on code' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onCommand).toHaveBeenCalledWith('/compact focus on code')
    expect(onSend).not.toHaveBeenCalled()
  })

  it('does not send disabled slash commands', () => {
    const onSend = vi.fn()
    const onCommand = vi.fn()
    render(
      <InputBar
        onSendMessage={onSend}
        isStreaming={false}
        onCommand={onCommand}
        slashCommands={[
          {
            id: 'unsupported:export',
            command: '/export',
            label: 'Export',
            description: 'Export session',
            kind: 'unsupported',
            execution: 'disabled',
            source: 'Pi',
            disabledReason: 'Not implemented in Pi Desktop yet',
          },
        ]}
      />,
    )

    const input = screen.getByPlaceholderText(/Ask Pi/)
    fireEvent.change(input, { target: { value: '/export' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(screen.getByText('Not implemented in Pi Desktop yet')).toBeTruthy()
    expect(onSend).not.toHaveBeenCalled()
    expect(onCommand).not.toHaveBeenCalled()
  })

  it('opens the file picker and sends selected file paths with the prompt', async () => {
    window.piDesktop = {
      ...(window.piDesktop || {}),
      files: {
        ...(window.piDesktop?.files || {}),
        pickFiles: vi.fn().mockResolvedValue({
          success: true,
          data: [
            { name: 'report.pdf', path: 'D:/work/report.pdf', size: 1200 },
            { name: 'slides.pptx', path: 'D:/work/slides.pptx', size: 2400 },
          ],
        }),
      },
    } as typeof window.piDesktop
    const onSend = vi.fn()

    render(<InputBar onSendMessage={onSend} isStreaming={false} />)

    fireEvent.click(screen.getByRole('button', { name: 'Attach files' }))

    expect(await screen.findByText('report.pdf')).toBeTruthy()
    expect(screen.getByText('slides.pptx')).toBeTruthy()

    fireEvent.change(screen.getByPlaceholderText(/Ask Pi/), { target: { value: 'summarize these' } })
    fireEvent.keyDown(screen.getByPlaceholderText(/Ask Pi/), { key: 'Enter' })

    expect(onSend).toHaveBeenCalledWith([
      'Attached files:',
      '- D:/work/report.pdf',
      '- D:/work/slides.pptx',
      '',
      'User request:',
      'summarize these',
    ].join('\n'), expect.objectContaining({
      displayText: 'summarize these',
      attachments: expect.arrayContaining([
        expect.objectContaining({ name: 'report.pdf', path: 'D:/work/report.pdf' }),
        expect.objectContaining({ name: 'slides.pptx', path: 'D:/work/slides.pptx' }),
      ]),
    }))
  })

  it('imports external dropped files into workspace attachments before sending', async () => {
    window.piDesktop = {
      ...(window.piDesktop || {}),
      files: {
        ...(window.piDesktop?.files || {}),
        getPathForFile: vi.fn((file: File) => (file.name === 'notes.md' ? 'D:/work/notes.md' : '')),
        importAttachments: vi.fn().mockResolvedValue({
          success: true,
          data: [
            { name: 'notes.md', path: 'D:/workspace/.pi-desktop/attachments/notes.md', size: 5 },
          ],
        }),
      },
    } as typeof window.piDesktop
    const onSend = vi.fn()
    const onWorkspaceRefresh = vi.fn()
    render(
      <InputBar
        onSendMessage={onSend}
        isStreaming={false}
        currentWorkspace="D:/workspace"
        onWorkspaceRefresh={onWorkspaceRefresh}
      />,
    )

    const dropTarget = screen.getByTestId('input-drop-target')
    const file = new File(['hello'], 'notes.md', { type: 'text/markdown' })

    fireEvent.drop(dropTarget, {
      dataTransfer: {
        files: [file, file],
      },
    })

    expect(await screen.findByText('notes.md')).toBeTruthy()
    expect(screen.getAllByText('notes.md')).toHaveLength(1)
    expect(window.piDesktop.files.importAttachments).toHaveBeenCalledWith({
      workspaceDir: 'D:/workspace',
      paths: ['D:/work/notes.md'],
    })
    expect(onWorkspaceRefresh).toHaveBeenCalledTimes(1)

    fireEvent.change(screen.getByPlaceholderText(/Ask Pi/), { target: { value: 'read this' } })
    fireEvent.keyDown(screen.getByPlaceholderText(/Ask Pi/), { key: 'Enter' })

    expect(onSend).toHaveBeenCalledWith([
      'Attached files:',
      '- D:/workspace/.pi-desktop/attachments/notes.md',
      '',
      'User request:',
      'read this',
    ].join('\n'), expect.objectContaining({
      displayText: 'read this',
      attachments: [expect.objectContaining({ name: 'notes.md', path: 'D:/workspace/.pi-desktop/attachments/notes.md' })],
    }))
  })

  it('rejects dropped files without a real native path instead of creating fake attachments', async () => {
    const importAttachments = vi.fn()
    window.piDesktop = {
      ...(window.piDesktop || {}),
      files: {
        ...(window.piDesktop?.files || {}),
        getPathForFile: vi.fn(() => ''),
        importAttachments,
      },
    } as typeof window.piDesktop
    const onSend = vi.fn()
    render(<InputBar onSendMessage={onSend} isStreaming={false} currentWorkspace="D:/workspace" />)

    const dropTarget = screen.getByTestId('input-drop-target')
    const file = new File(['hello'], '941956e06ceabe84ea8af67a087c9b99.jpg', { type: 'image/jpeg' })

    fireEvent.drop(dropTarget, {
      dataTransfer: {
        files: [file],
      },
    })

    expect(importAttachments).not.toHaveBeenCalled()
    expect(await screen.findByText('This drop source did not provide a real file path. Please use Files or drag from Explorer.')).toBeTruthy()
    expect(screen.queryByText('941956e06ceabe84ea8af67a087c9b99.jpg')).toBeNull()
  })

  it('attaches files dragged from the workspace panel', async () => {
    const onSend = vi.fn()
    render(<InputBar onSendMessage={onSend} isStreaming={false} />)

    const dropTarget = screen.getByTestId('input-drop-target')
    fireEvent.drop(dropTarget, {
      dataTransfer: {
        files: [],
        getData: (format: string) => (
          format === 'application/x-pi-desktop-file'
            ? JSON.stringify({ path: 'D:/work/generated.md', name: 'generated.md' })
            : ''
        ),
      },
    })

    expect(await screen.findByText('generated.md')).toBeTruthy()
  })

  it('removes the paste button from the input actions', () => {
    render(<InputBar onSendMessage={() => {}} isStreaming={false} />)

    expect(screen.getByRole('button', { name: 'Attach files' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Paste/i })).toBeNull()
  })
})
