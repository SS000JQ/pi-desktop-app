import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import MessageList from '../../src/renderer/src/components/MessageList'
import type { Message } from '../../src/renderer/src/types/chat'

function makeMessage(id: string, content: string): Message {
  return {
    id,
    role: 'assistant',
    content,
    timestamp: Date.now(),
  }
}

describe('MessageList', () => {
  it('does not force-scroll when the user is reviewing older output', () => {
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView

    const initialMessages = [makeMessage('m1', 'Earlier output'), makeMessage('m2', 'Current output')]
    const { container, rerender } = render(
      <MessageList
        messages={initialMessages}
        isStreaming
        onRegenerate={() => {}}
        onEditMessage={() => {}}
      />,
    )

    const scroller = container.querySelector('.msgs') as HTMLDivElement
    Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 2000 })
    Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 500 })
    Object.defineProperty(scroller, 'scrollTop', { configurable: true, writable: true, value: 200 })

    scrollIntoView.mockClear()
    fireEvent.scroll(scroller)

    rerender(
      <MessageList
        messages={[...initialMessages, makeMessage('m3', 'New streamed output')]}
        isStreaming
        onRegenerate={() => {}}
        onEditMessage={() => {}}
      />,
    )

    expect(scrollIntoView).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /jump to latest/i })).toBeTruthy()
  })

  it('lets the user jump back to the latest output explicitly', () => {
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView

    const { container, rerender } = render(
      <MessageList messages={[makeMessage('m1', 'Earlier output')]} isStreaming onRegenerate={() => {}} onEditMessage={() => {}} />,
    )

    const scroller = container.querySelector('.msgs') as HTMLDivElement
    Object.defineProperty(scroller, 'scrollHeight', { configurable: true, value: 2000 })
    Object.defineProperty(scroller, 'clientHeight', { configurable: true, value: 500 })
    Object.defineProperty(scroller, 'scrollTop', { configurable: true, writable: true, value: 200 })
    fireEvent.scroll(scroller)

    rerender(
      <MessageList
        messages={[makeMessage('m1', 'Earlier output'), makeMessage('m2', 'New streamed output')]}
        isStreaming
        onRegenerate={() => {}}
        onEditMessage={() => {}}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /jump to latest/i }))

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto' })
  })
})
