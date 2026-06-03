interface DropZoneProps {
  visible: boolean
}

export default function DropZone({ visible }: DropZoneProps) {
  if (!visible) return null
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 25,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,122,255,0.04)',
      border: '2px dashed rgba(0,122,255,0.2)',
      borderRadius: 3, pointerEvents: 'none',
    }}>
      <span style={{ fontSize: 13, color: 'rgba(0,122,255,0.3)', fontFamily: "'JetBrains Mono', monospace" }}>
        Drop files here
      </span>
    </div>
  )
}
