import type { ChatAttachment } from '../types/chat'

interface ContextChipsProps {
  attachments: ChatAttachment[]
  onRemove: (index: number) => void
}

export default function ContextChips({ attachments, onRemove }: ContextChipsProps) {
  return (
    <>
      {attachments.map((file, index) => (
        <div key={file.id} className="cchip" title={file.path}>
          <span className="cchip-icon">file</span>
          <span className="cchip-name">{file.name}</span>
          <button type="button" onClick={() => onRemove(index)} className="x" aria-label={`Remove ${file.name}`}>
            x
          </button>
        </div>
      ))}
    </>
  )
}
