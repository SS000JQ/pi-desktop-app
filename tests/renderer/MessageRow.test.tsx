import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
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
})
