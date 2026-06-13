import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ToolCallCard from '../../src/renderer/src/components/ToolCallCard'

describe('ToolCallCard', () => {
  it('shows a compact done status with duration', () => {
    const { container } = render(<ToolCallCard toolCall={{ id: '1', name: 'search', args: '("x")', status: 'done', duration: '0.5s' }} />)
    expect(container.textContent).toContain('search')
    expect(container.textContent).toContain('done')
    expect(container.textContent).toContain('0.5s')
    expect(container.querySelector('.tc.done')).toBeTruthy()
  })

  it('shows running status and keeps elapsed time visible', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-10T10:00:00.000Z'))
    const { container } = render(<ToolCallCard toolCall={{ id: '2', name: 'bash', args: '("ls")', status: 'running' }} />)
    expect(container.textContent).toContain('running')
    expect(container.querySelector('.tc.running')).toBeTruthy()

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(container.textContent).toContain('1s')
    vi.useRealTimers()
  })

  it('shows error status', () => {
    const { container } = render(<ToolCallCard toolCall={{ id: '3', name: 'read_file', args: '("/x")', status: 'error' }} />)
    expect(container.textContent).toContain('error')
    expect(container.querySelector('.tc.error')).toBeTruthy()
  })

  it('uses a command-bar header and expands long details on demand', () => {
    const longArgs = JSON.stringify({ content: 'x'.repeat(160), path: 'README.md' })
    const { container } = render(<ToolCallCard toolCall={{ id: '4', name: 'write', args: longArgs, status: 'done', duration: '2s' }} />)

    expect(container.querySelector('.tc-header')).toBeTruthy()
    expect(container.querySelector('.tc-details')).toBeNull()
    expect(screen.getByRole('button', { name: /show write details/i })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /show write details/i }))

    expect(container.querySelector('.tc-details')).toBeTruthy()
    expect(screen.getByText(longArgs)).toBeTruthy()
  })
})
