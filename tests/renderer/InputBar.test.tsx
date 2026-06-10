import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import InputBar from '../../src/renderer/src/components/InputBar'

describe('InputBar', () => {
  it('calls onSendMessage when Enter is pressed', () => {
    const onSend = vi.fn()
    render(<InputBar onSendMessage={onSend} isStreaming={false} />)
    const input = screen.getByPlaceholderText(/Ask Pi/)
    fireEvent.change(input, { target: { value: 'hello' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSend).toHaveBeenCalledWith('hello')
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

    expect(screen.getByText('/skill:pdf')).toBeTruthy()
    expect(screen.getByText('/review')).toBeTruthy()
    expect(screen.getByText('[scope]')).toBeTruthy()
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

    expect(onSend).toHaveBeenCalledWith('/skill:pdf summarize this')
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
})
