import { useState } from 'react'

interface PreviewPanelProps {
  collapsed: boolean
  onToggleCollapse: () => void
}

export default function PreviewPanel({ collapsed, onToggleCollapse }: PreviewPanelProps) {
  const [activeTab, setActiveTab] = useState<string | null>('大纲.md')

  if (collapsed) {
    return (
      <div className="prev items-start justify-center pt-4">
        <button onClick={onToggleCollapse} className="ibtn" style={{ width: 'auto', padding: '8px 0', writingMode: 'vertical-lr', letterSpacing: '2px' }}>
          PREVIEW
        </button>
      </div>
    )
  }

  return (
    <div className="prev">
      <div className="pft">
        <button
          onClick={() => setActiveTab('大纲.md')}
          className={`pf ${activeTab === '大纲.md' ? 'active' : ''}`}
        >
          <span>📄</span> 大纲.md
        </button>
        <button
          onClick={() => setActiveTab('数据.xlsx')}
          className={`pf ${activeTab === '数据.xlsx' ? 'active' : ''}`}
        >
          <span>📊</span> 数据.xlsx
        </button>
      </div>

      <div className="ph">
        <span className="phl">Preview</span>
        <span className="phl" style={{ cursor: 'pointer' }}>↗</span>
      </div>

      <div className="psc">
        {activeTab === '大纲.md' ? (
          <div className="ps">
            <div className="st" style={{ color: 'rgba(48,209,88,0.7)' }}>AI 发展历程 · 大纲</div>
            <div className="sn" style={{ marginTop: 0, marginBottom: '6px' }}>────────────────</div>
            <div className="si"><span style={{ color: 'var(--accent)' }}>1.</span> 🏛️ 人工智能的起源</div>
            <div className="si"><span style={{ color: 'var(--accent)' }}>2.</span> ⚙️ 寒冬与重生</div>
            <div className="si"><span style={{ color: 'var(--accent)' }}>3.</span> 📈 机器学习的崛起</div>
            <div className="si"><span style={{ color: 'var(--accent)' }}>4.</span> 🧠 深度学习革命</div>
            <div className="si"><span style={{ color: 'var(--accent)' }}>5.</span> 🤖 大模型时代</div>
          </div>
        ) : (
          <div className="ps" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(32,29,29,0.3)' }}>
            Sheet preview (Phase 3)
          </div>
        )}
      </div>

      <div className="pa">
        <button className="pab">📂 Save</button>
        <button className="pab p">🔗 Open in WPS</button>
        <button className="pab">📋 Copy</button>
      </div>
    </div>
  )
}
