import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ChatRuntimeStatusBar from '../../src/renderer/src/components/ChatRuntimeStatusBar'

describe('ChatRuntimeStatusBar', () => {
  it('renders a live thinking preview when runtime status contains reasoning text', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-10T10:00:05.000Z'))

    render(
      <ChatRuntimeStatusBar
        status={{
          status: 'processing',
          statusLabel: 'Thinking',
          lastAction: 'Reviewing files',
          startedAt: new Date('2026-06-10T10:00:00.000Z').getTime(),
          updatedAt: new Date('2026-06-10T10:00:05.000Z').getTime(),
          isWaitingForUser: false,
          thinkingPreview: 'Inspecting the workspace state before replying.',
          hasThinking: true,
          thinkingUpdatedAt: new Date('2026-06-10T10:00:05.000Z').getTime(),
        }}
      />,
    )

    expect(screen.getByText(/thinking live/i)).toBeTruthy()
    expect(screen.getByText(/reviewing files/i)).toBeTruthy()
    expect(screen.getByText(/Inspecting the workspace state before replying\./i)).toBeTruthy()
    expect(screen.getByRole('button', { name: /expand live thinking/i })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /expand live thinking/i }))
    expect(screen.getByRole('button', { name: /collapse live thinking/i })).toBeTruthy()

    vi.useRealTimers()
  })

  it('stays compact when there is no live thinking content', () => {
    render(
      <ChatRuntimeStatusBar
        status={{
          status: 'processing',
          statusLabel: 'Processing',
          lastAction: 'Using tools',
          startedAt: Date.now(),
          updatedAt: Date.now(),
          isWaitingForUser: false,
        }}
      />,
    )

    expect(screen.getByText(/using tools/i)).toBeTruthy()
    expect(screen.queryByText(/thinking live/i)).toBeNull()
  })

  it('freezes the displayed elapsed time after the run completes', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-10T10:00:05.000Z'))

    render(
      <ChatRuntimeStatusBar
        status={{
          status: 'completed',
          statusLabel: 'Completed',
          lastAction: 'Response finished',
          startedAt: new Date('2026-06-10T10:00:00.000Z').getTime(),
          terminalAt: new Date('2026-06-10T10:00:05.000Z').getTime(),
          elapsedMs: 5000,
          updatedAt: new Date('2026-06-10T10:00:05.000Z').getTime(),
          isWaitingForUser: false,
          resultSummary: 'Created report.md',
        }}
      />,
    )

    expect(screen.getByText('5s')).toBeTruthy()

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(screen.getByText('5s')).toBeTruthy()
    expect(screen.queryByText('10s')).toBeNull()
    vi.useRealTimers()
  })
})
