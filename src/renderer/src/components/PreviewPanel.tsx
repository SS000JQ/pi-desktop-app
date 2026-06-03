import { useState } from 'react'

interface PreviewPanelProps {
  collapsed: boolean
  onToggleCollapse: () => void
}

export default function PreviewPanel({ collapsed, onToggleCollapse }: PreviewPanelProps) {
  const [activeTab, setActiveTab] = useState<string | null>('大纲.md')

  if (collapsed) {
    return (
      <div className="w-12 flex-shrink-0 bg-[#0F172A] border-l border-[#1E293B] flex items-start justify-center pt-4">
        <button onClick={onToggleCollapse} className="text-[10px] text-dim hover:text-muted" style={{ writingMode: 'vertical-lr', letterSpacing: '2px' }}>
          {'PREVIEW'}
        </button>
      </div>
    )
  }

  return (
    <div className="w-[260px] flex-shrink-0 bg-[#0F172A] border-l border-[#1E293B] flex flex-col">
      <div className="px-2.5 pt-1.5">
        <div className="flex gap-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('大纲.md')}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-t text-[10px] cursor-pointer whitespace-nowrap ${
              activeTab === '大纲.md' ? 'bg-surface text-[#F1F5F9]' : 'text-muted hover:text-[#94A3B8]'
            }`}
          >
            <span>📄</span> 大纲.md
          </button>
          <button
            onClick={() => setActiveTab('数据.xlsx')}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-t text-[10px] cursor-pointer whitespace-nowrap ${
              activeTab === '数据.xlsx' ? 'bg-surface text-[#F1F5F9]' : 'text-muted hover:text-[#94A3B8]'
            }`}
          >
            <span>📊</span> 数据.xlsx
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between px-2.5 py-1">
        <span className="text-[9px] uppercase tracking-wider text-dim font-semibold">Preview</span>
        <span className="text-dim cursor-pointer text-xs">↗</span>
      </div>

      <div className="flex-1 mx-2 mb-2 bg-surface rounded p-3 font-mono text-[11px] leading-relaxed overflow-y-auto">
        {activeTab === '大纲.md' ? (
          <div>
            <div className="text-success font-semibold text-sm mb-1">AI 发展历程 · 大纲</div>
            <div className="text-muted text-[10px] mb-2">────────────────</div>
            <div><span className="text-accent">1.</span> 🏛️ 人工智能的起源</div>
            <div><span className="text-accent">2.</span> ⚙️ 寒冬与重生</div>
            <div><span className="text-accent">3.</span> 📈 机器学习的崛起</div>
            <div><span className="text-accent">4.</span> 🧠 深度学习革命</div>
            <div><span className="text-accent">5.</span> 🤖 大模型时代</div>
          </div>
        ) : (
          <div className="text-muted text-[10px]">Sheet preview (Phase 3)</div>
        )}
      </div>

      <div className="flex gap-1 px-2 py-1.5 border-t border-[#1E293B]">
        <button className="px-1.5 py-0.5 rounded text-[10px] cursor-pointer bg-surface text-[#94A3B8] hover:bg-[#334155] transition-all">📂 Save</button>
        <button className="px-1.5 py-0.5 rounded text-[10px] cursor-pointer bg-accent text-white hover:bg-[#2563EB] transition-all">🔗 Open in WPS</button>
        <button className="px-1.5 py-0.5 rounded text-[10px] cursor-pointer bg-surface text-[#94A3B8] hover:bg-[#334155] transition-all">📋 Copy</button>
      </div>
    </div>
  )
}
