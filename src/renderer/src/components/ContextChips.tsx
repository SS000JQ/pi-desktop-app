interface ContextChipsProps {
  attachments: { name: string }[]
  onRemove: (index: number) => void
}

export default function ContextChips({ attachments, onRemove }: ContextChipsProps) {
  return (
    <>
      {attachments.map((file, i) => (
        <div key={i} className="cchip">
          <span style={{ fontSize: '11px' }}>📄</span>
          {file.name}
          <button onClick={() => onRemove(i)} className="x">✕</button>
        </div>
      ))}
    </>
  )
}
