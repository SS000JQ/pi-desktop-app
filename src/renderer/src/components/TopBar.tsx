interface TopBarProps {
  currentDir: string
  onOpenSettings?: () => void
  onOpenProfile?: () => void
}

export default function TopBar({ currentDir, onOpenSettings, onOpenProfile }: TopBarProps) {
  return (
    <div className="topbar drag-region">
      <span className="topbar-title">Pi Desktop</span>
      <span className="topbar-path">{currentDir}</span>
      <div className="topbar-right no-drag">
        <div className="mbadge">Sonnet 4.6</div>
        <div className="tk"><span>1,247</span> / 8,000</div>
        <button className="ibtn" title="Search">⌕</button>
        <button className="ibtn" onClick={onOpenProfile} title="Profile">P</button>
        <button className="ibtn" onClick={onOpenSettings} title="Settings">⚙</button>
      </div>
    </div>
  )
}
