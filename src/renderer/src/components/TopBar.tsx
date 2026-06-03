interface TopBarProps {
  currentDir: string
  onOpenSettings?: () => void
  onOpenProfile?: () => void
}

export default function TopBar({ currentDir, onOpenSettings, onOpenProfile }: TopBarProps) {
  return (
    <div className="drag-region flex items-center px-3 h-10 border-b border-[#1E293B] bg-[#0F172A] flex-shrink-0">
      <span className="font-semibold text-sm tracking-tight">Pi Desktop</span>
      <span className="ml-4 text-xs text-muted">{currentDir}</span>

      <div className="ml-auto flex items-center gap-2.5 no-drag">
        <div className="flex items-center gap-1 px-2 py-0.5 border border-border rounded-md text-xs text-[#94A3B8] font-medium cursor-pointer hover:border-accent transition-colors">
          Sonnet 4.6 <span className="text-[8px] text-muted ml-0.5">▾</span>
        </div>
        <span className="text-[10px] text-muted font-mono">
          <span className="text-[#94A3B8]">1,247</span> / 8,000
        </span>
        <button className="w-6 h-6 rounded-md flex items-center justify-center text-dim hover:text-[#F1F5F9] hover:bg-surface transition-all text-xs" title="Search">⌕</button>
        <button onClick={onOpenProfile} className="w-6 h-6 rounded-md flex items-center justify-center text-dim hover:text-[#F1F5F9] hover:bg-surface transition-all text-xs" title="Profile">P</button>
        <button onClick={onOpenSettings} className="w-6 h-6 rounded-md flex items-center justify-center text-dim hover:text-[#F1F5F9] hover:bg-surface transition-all text-xs" title="Settings">⚙</button>
      </div>
    </div>
  )
}
