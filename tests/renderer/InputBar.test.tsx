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
})
