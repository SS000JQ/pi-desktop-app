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

  it('renders assistant final content as markdown inside an answer card', () => {
    const { container } = render(
      <MessageRow
        message={{
          id: '2b',
          role: 'assistant',
          content: '## Result\n\n- item one\n\n```ts\nconst answer = 42\n```',
          timestamp: 0,
          toolCalls: [],
        }}
      />,
    )

    expect(container.querySelector('.answer-card')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Result' })).toBeTruthy()
    expect(screen.getByText('item one')).toBeTruthy()
    expect(screen.getByText('const answer = 42')).toBeTruthy()
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

  it('renders thinking as a distinct preview block instead of plain answer text', () => {
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

  it('shows a live thinking preview while the details stay collapsed', () => {
    render(
      <MessageRow
        message={{
          id: '5c',
          role: 'assistant',
          content: '',
          timestamp: 0,
          isStreaming: true,
          parts: [
            {
              type: 'thinking',
              title: 'Thinking',
              text: 'checking HyperFrames environment\nreading project config',
              collapsed: true,
              state: 'streaming',
              updatedAt: Date.now(),
            },
          ],
        }}
      />,
    )

    expect(screen.getByText(/reading project config/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /show thinking/i })).toBeTruthy()
  })

  it('renders completed tools as visible process cards instead of hiding them behind a summary', () => {
    render(
      <MessageRow
        message={{
          id: '5d',
          role: 'assistant',
          content: 'Working...',
          timestamp: 0,
          toolCalls: [
            { id: 'read-1', name: 'read', args: '{"path":"a.ts"}', status: 'done' },
            { id: 'read-2', name: 'read', args: '{"path":"b.ts"}', status: 'done' },
            { id: 'bash-1', name: 'bash', args: '{"command":"npm test"}', status: 'done' },
          ],
        }}
      />,
    )

    expect(screen.queryByRole('button', { name: /read 2/i })).toBeNull()
    expect(screen.getAllByText('read').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('bash')).toBeTruthy()
    expect(screen.getAllByText(/done/i).length).toBeGreaterThanOrEqual(3)
  })

  it('places process cards before the final answer so tool use reads as realtime progress', () => {
    const { container } = render(
      <MessageRow
        message={{
          id: '5e',
          role: 'assistant',
          content: 'Final answer is ready',
          timestamp: 0,
          parts: [
            {
              type: 'thinking',
              title: 'Thinking',
              text: 'checking tools',
              collapsed: true,
              state: 'streaming',
              updatedAt: Date.now(),
            },
            { type: 'text', text: 'Final answer is ready' },
          ],
          toolCalls: [
            { id: 'bash-1', name: 'bash', args: '{"command":"python script.py"}', status: 'done' },
          ],
        }}
      />,
    )

    const text = container.textContent || ''
    expect(text.indexOf('Thinking')).toBeLessThan(text.indexOf('bash'))
    expect(text.indexOf('bash')).toBeLessThan(text.indexOf('Final answer is ready'))
  })

  it('keeps thinking, tool calls, and answer text in the original event order', () => {
    const { container } = render(
      <MessageRow
        message={{
          id: '5f',
          role: 'assistant',
          content: 'Final answer',
          timestamp: 0,
          parts: [
            {
              type: 'thinking',
              title: 'Thinking',
              text: 'first thought',
              collapsed: true,
              state: 'streaming',
              updatedAt: Date.now(),
            },
            {
              type: 'toolCall',
              text: '',
              toolCall: { id: 'bash-1', name: 'bash', args: '{"command":"python script.py"}', status: 'done' },
            },
            {
              type: 'thinking',
              title: 'Thinking',
              text: 'second thought',
              collapsed: true,
              state: 'streaming',
              updatedAt: Date.now(),
            },
            { type: 'text', text: 'Final answer' },
          ],
          toolCalls: [
            { id: 'bash-1', name: 'bash', args: '{"command":"python script.py"}', status: 'done' },
          ],
        }}
      />,
    )

    const text = container.textContent || ''
    expect(text.indexOf('first thought')).toBeLessThan(text.indexOf('bash'))
    expect(text.indexOf('bash')).toBeLessThan(text.indexOf('second thought'))
    expect(text.indexOf('second thought')).toBeLessThan(text.indexOf('Final answer'))
  })

  it('renders text parts as markdown answer cards after realtime process cards', () => {
    const { container } = render(
      <MessageRow
        message={{
          id: '5g',
          role: 'assistant',
          content: '## Final\n\n- shipped',
          timestamp: 0,
          parts: [
            {
              type: 'thinking',
              title: 'Thinking',
              text: 'checking current state',
              collapsed: true,
              state: 'complete',
              updatedAt: Date.now(),
            },
            {
              type: 'toolCall',
              text: '',
              toolCall: { id: 'bash-1', name: 'bash', args: '{"command":"npm test"}', status: 'done' },
            },
            { type: 'text', text: '## Final\n\n- shipped' },
          ],
          toolCalls: [
            { id: 'bash-1', name: 'bash', args: '{"command":"npm test"}', status: 'done' },
          ],
        }}
      />,
    )

    const text = container.textContent || ''
    expect(container.querySelector('.thinking-card')).toBeTruthy()
    expect(container.querySelector('.tool-card')).toBeTruthy()
    expect(container.querySelector('.answer-card')).toBeTruthy()
    expect(text.indexOf('Thinking')).toBeLessThan(text.indexOf('bash'))
    expect(text.indexOf('bash')).toBeLessThan(text.indexOf('Final'))
    expect(screen.getByRole('heading', { name: 'Final' })).toBeTruthy()
    expect(screen.getByText('shipped')).toBeTruthy()
  })

  it('keeps completed and running tools visible in the process timeline', () => {
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

    expect(screen.getAllByText('read').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText(/bash/i)).toBeTruthy()
    expect(screen.getByText(/running/i)).toBeTruthy()
  })
})
