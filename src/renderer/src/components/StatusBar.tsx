interface StatusBarProps {
  currentModel: string
  activeSessionCount: number
  currentDir?: string
}

export default function StatusBar({
  currentModel,
  activeSessionCount,
  currentDir,
}: StatusBarProps) {
  return (
    <div className="stb">
      <span className="sdot" style={{ background: 'rgba(48,209,88,0.4)' }} />
      <span>Pi session source</span>
      <span style={{ color: 'rgba(255,255,255,0.04)' }}>|</span>
      <span>{currentModel}</span>
      <span style={{ color: 'rgba(255,255,255,0.04)' }}>|</span>
      <span>{activeSessionCount} session{activeSessionCount === 1 ? '' : 's'}</span>
      <span className="ml-auto">
        {currentDir || 'No active directory'}
      </span>
    </div>
  )
}
