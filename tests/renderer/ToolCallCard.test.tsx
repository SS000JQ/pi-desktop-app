import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import ToolCallCard from '../../src/renderer/src/components/ToolCallCard'

describe('ToolCallCard', () => {
  it('shows done status with green indicator', () => {
    const { container } = render(<ToolCallCard toolCall={{ id: '1', name: 'search', args: '("x")', status: 'done', duration: '0.5s' }} />)
    expect(container.textContent).toContain('search')
    expect(container.textContent).toContain('Done')
    expect(container.textContent).toContain('0.5s')
  })

  it('shows running status', () => {
    const { container } = render(<ToolCallCard toolCall={{ id: '2', name: 'bash', args: '("ls")', status: 'running' }} />)
    expect(container.textContent).toContain('Running')
  })

  it('shows error status', () => {
    const { container } = render(<ToolCallCard toolCall={{ id: '3', name: 'read_file', args: '("/x")', status: 'error' }} />)
    expect(container.textContent).toContain('Error')
  })
})
