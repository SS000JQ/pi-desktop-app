interface ContextChipsProps {
  attachments: { name: string }[]
  onRemove: (index: number) => void
}

export default function ContextChips({ attachments, onRemove }: ContextChipsProps) {
  return (
    <div className="flex gap-1 flex-wrap pb-1">
      {attachments.map((file, i) => (
        <div key={i} className="flex items-center gap-1 bg-surface border border-border rounded px-1.5 py-0.5 text-[10px] text-[#94A3B8]">
          <span className="text-xs">📄</span>
          {file.name}
          <button onClick={() => onRemove(i)} className="text-dim hover:text-error text-xs leading-none ml-0.5">✕</button>
        </div>
      ))}
    </div>
  )
}
