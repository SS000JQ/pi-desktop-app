import { useState, useRef, KeyboardEvent } from 'react'
import ContextChips from './ContextChips'

interface InputBarProps {
  onSendMessage: (text: string) => void
  isStreaming: boolean
}

export default function InputBar({ onSendMessage, isStreaming }: InputBarProps) {
  const [text, setText] = useState('')
  const [attachments, setAttachments] = useState<{ name: string }[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSend = () => {
    if (!text.trim() || isStreaming) return
    onSendMessage(text)
    setText('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="border-t border-[#1E293B] bg-[#0F172A] px-3 py-2 flex-shrink-0">
      {attachments.length > 0 && (
        <ContextChips attachments={attachments} onRemove={(i) => setAttachments(prev => prev.filter((_, idx) => idx !== i))} />
      )}
      <div className="flex items-center gap-1.5 bg-surface border border-border rounded-md px-2 py-1.5 transition-colors focus-within:border-accent">
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Pi... ( / commands · drop files · paste images )"
          className="flex-1 bg-transparent border-none outline-none text-sm text-[#F1F5F9] placeholder-muted"
          disabled={isStreaming}
        />
        <div className="flex items-center gap-1 flex-shrink-0">
          <button title="Attach files" className="text-dim hover:text-muted text-sm px-0.5 rounded transition-colors hover:bg-[#334155]">📎</button>
          <button title="Paste screenshot" className="text-dim hover:text-muted text-sm px-0.5 rounded transition-colors hover:bg-[#334155]">🖼</button>
          <span className="text-[#334155] text-[9px] font-mono">⌘⏎</span>
          <button
            onClick={handleSend}
            disabled={isStreaming || !text.trim()}
            className="bg-accent text-white border-none rounded px-2 py-0.5 text-[10px] font-medium cursor-pointer hover:bg-[#2563EB] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
