import { describe, it, expect } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import MessageRow from '../../src/renderer/src/components/MessageRow'

describe('MessageRow', () => {
  it('renders user message correctly', () => {
    render(<MessageRow message={{ id: '1', role: 'user', content: 'Hello', timestamp: 0 }} />)
    expect(screen.getByText('You')).toBeTruthy()
    expect(screen.getByText('Hello')).toBeTruthy()
  })

  it('renders assistant message with Pi label', () => {
    render(<MessageRow message={{ id: '2', role: 'assistant', content: 'Hi there', timestamp: 0, toolCalls: [] }} />)
    expect(screen.getByText('Pi')).toBeTruthy()
    expect(screen.getByText('Hi there')).toBeTruthy()
  })

  it('renders tool calls when present', () => {
    const message = {
      id: '3',
      role: 'assistant' as const,
      content: 'Searching...',
      timestamp: 0,
      toolCalls: [{ id: 'tc1', name: 'web_search', args: '("query")', status: 'done' as const }],
    }
    const { container } = render(<MessageRow message={message} />)
    expect(container.textContent).toContain('web_search')
  })

  it('renders running tool call status from Pi events', () => {
    const message = {
      id: '4',
      role: 'assistant' as const,
      content: 'Working...',
      timestamp: 0,
      toolCalls: [{ id: 'tc2', name: 'read', args: '{}', status: 'running' as const }],
    }
    const { container } = render(<MessageRow message={message} />)
    expect(container.textContent).toContain('read')
    expect(container.textContent?.toLowerCase()).toContain('running')
  })

  it('renders thinking as a distinct collapsed block instead of plain answer text', () => {
    render(
      <MessageRow
        message={{
          id: '5',
          role: 'assistant',
          content: 'Final answer',
          timestamp: 0,
          parts: [
            { type: 'thinking', title: 'Thinking', text: 'private reasoning', collapsed: true },
            { type: 'text', text: 'Final answer' },
          ],
        }}
      />,
    )

    expect(screen.getByText('Final answer')).toBeTruthy()
    expect(screen.getByRole('button', { name: /show thinking/i })).toBeTruthy()
    expect(screen.queryByText('private reasoning')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /show thinking/i }))
    expect(screen.getByText('private reasoning')).toBeTruthy()
    expect(screen.getByRole('button', { name: /close thinking/i })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /close thinking/i }))
    expect(screen.queryByText('private reasoning')).toBeNull()
  })

  it('shows thinking activity state while keeping long reasoning collapsible', () => {
    render(
      <MessageRow
        message={{
          id: '5b',
          role: 'assistant',
          content: 'Final answer',
          timestamp: 0,
          isStreaming: true,
          parts: [
            {
              type: 'thinking',
              title: 'Thinking',
              text: 'line one\nline two\nline three',
              collapsed: true,
              state: 'streaming',
              updatedAt: Date.now(),
            },
            { type: 'text', text: 'Final answer' },
          ],
        }}
      />,
    )

    expect(screen.getByText(/Thinking · updating/i)).toBeTruthy()
    expect(screen.queryByText(/line two/)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /show thinking/i }))
    expect(screen.getByText(/line two/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /close thinking/i })).toBeTruthy()
  })

  it('summarizes completed tool calls while keeping the running tool visible', () => {
    render(
      <MessageRow
        message={{
          id: '6',
          role: 'assistant',
          content: 'Working...',
          timestamp: 0,
          toolCalls: [
            { id: 'read-1', name: 'read', args: '{"path":"a.ts"}', status: 'done' },
            { id: 'read-2', name: 'read', args: '{"path":"b.ts"}', status: 'done' },
            { id: 'bash-1', name: 'bash', args: '{"command":"npm test"}', status: 'running' },
          ],
        }}
      />,
    )

    expect(screen.getByText(/read 2/i)).toBeTruthy()
    expect(screen.getByText(/bash/i)).toBeTruthy()
    expect(screen.getByText(/running/i)).toBeTruthy()
  })
})
