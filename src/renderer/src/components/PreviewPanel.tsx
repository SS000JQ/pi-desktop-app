import { useState, useRef, useEffect } from 'react'
import * as XLSX from 'xlsx'
import mammoth from 'mammoth'
import hljs from 'highlight.js'

interface PreviewPanelProps {
  collapsed: boolean
  onToggleCollapse: () => void
  panelWidth: number
  onResize: (w: number) => void
}

interface ArtifactFile {
  name: string
  ext: string // 'md' | 'pptx' | 'xlsx' | 'img' | 'code'
  size?: string
}

const mockArtifacts: ArtifactFile[] = [
  { name: '大纲.md', ext: 'md', size: '1.2kb' },
  { name: 'AI数据.xlsx', ext: 'xlsx', size: '8kb' },
  { name: '演讲稿.md', ext: 'md', size: '3.4kb' },
  { name: 'App.tsx', ext: 'code', size: '4.2kb' },
  { name: 'slide-01.png', ext: 'img', size: '124kb' },
]

export default function PreviewPanel({ collapsed, onToggleCollapse, panelWidth, onResize }: PreviewPanelProps) {
  const [view, setView] = useState<'cowork' | 'preview'>('cowork')
  const [previewMode, setPreviewMode] = useState<'preview' | 'source'>('preview')
  const [currentFile, setCurrentFile] = useState<ArtifactFile | null>(null)
  const isDraggingRight = useRef(false)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRight.current) return
      const newWidth = Math.min(Math.max(window.innerWidth - e.clientX, 260), 550)
      onResize(newWidth)
    }
    const handleMouseUp = () => { isDraggingRight.current = false }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [onResize])

  // highlight code when source mode is active
  useEffect(() => {
    if (currentFile?.ext === 'code' || previewMode === 'source') {
      // highlight.js would be applied to the code block
      // For now the CSS handles basic styling
    }
  }, [currentFile, previewMode])

  function openPreview(file: ArtifactFile) {
    setCurrentFile(file)
    setPreviewMode('preview')
    setView('preview')
  }

  function closePreview() {
    setView('cowork')
    setCurrentFile(null)
  }

  function togglePreviewMode() {
    setPreviewMode(prev => prev === 'preview' ? 'source' : 'preview')
  }

  if (collapsed) {
    return (
      <div style={{ width: 32, flexShrink: 0, borderLeft: '1px solid rgba(255,255,255,0.04)', background: '#1a1919', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 12 }}>
        <button onClick={onToggleCollapse} style={{ writingMode: 'vertical-lr', letterSpacing: '2px', fontSize: 10, color: 'rgba(255,255,255,0.15)', cursor: 'pointer', background: 'none', border: 'none', fontFamily: "'JetBrains Mono', monospace", padding: '12px 0' }}>
          PREVIEW
        </button>
      </div>
    )
  }

  const hasPreviewToggle = currentFile?.ext === 'md'

  return (
    <div className="prev" style={{ width: panelWidth, position: 'relative', overflow: 'hidden' }}>
      <div className="resize-h" style={{ left: -2 }}
        onMouseDown={(e) => { e.preventDefault(); isDraggingRight.current = true }} />

      {/* Cowork Sidebar */}
      {view === 'cowork' && (
        <div className="cs">
          <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'flex-end', padding: '4px 6px' }}>
            <button onClick={onToggleCollapse} className="pv-op" title="Hide panel" style={{ width: 22, height: 20, fontSize: 10 }}>›</button>
          </div>
          <div className="c-sec">
            <div className="c-hdr"><span className="c-hl">Progress</span><span className="c-hc">3/5</span></div>
            <div className="c-bd">
              <div className="t-bar"><div className="t-bar-in" style={{ width: '60%' }}></div></div>
              <div className="t"><span className="s d">✓</span><span className="l d">搜索数据</span></div>
              <div className="t"><span className="s d">✓</span><span className="l d">整理结构</span></div>
              <div className="t"><span className="s r">●</span><span className="l r">生成内容</span></div>
              <div className="t"><span className="s w">○</span><span className="l w">演讲稿</span></div>
            </div>
          </div>
          <div className="c-sec" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div className="c-hdr"><span className="c-hl">Files</span></div>
            <div className="c-bd" style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
              <div className="ft ft-dd"><span className="i">📁</span><span className="n">ppt-demo/</span></div>
              <div className="ft ft-fl ft-in"><span className="i">📄</span><span className="n">大纲.md</span></div>
              <div className="ft ft-fl ft-in"><span className="i">📊</span><span className="n">数据.xlsx</span></div>
              <div className="ft ft-dd ft-in"><span className="i">📁</span><span className="n">assets/</span></div>
            </div>
          </div>
          <div className="c-sec">
            <div className="c-hdr"><span className="c-hl">Artifacts</span><span className="c-hc">{mockArtifacts.length}</span></div>
            <div className="c-bd">
              {mockArtifacts.map(f => (
                <div key={f.name} className="art" onClick={() => openPreview(f)}>
                  <span className="i">
                    {f.ext === 'md' ? '📄' : f.ext === 'xlsx' ? '📊' : f.ext === 'img' ? '🖼' : '📄'}
                  </span>
                  <span className="n">{f.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Preview Mode */}
      {view === 'preview' && currentFile && (
        <div className="cs">
          <div className="pv-tb">
            <button className="pv-back" onClick={closePreview}>←</button>
            <span className="pv-name">{currentFile.name}</span>
            <span className="pv-tag">{currentFile.ext.toUpperCase()}</span>
            <div className="pv-ops">
              {hasPreviewToggle && (
                <button className="pv-op a" onClick={togglePreviewMode} title="Toggle preview/source">
                  {previewMode === 'preview' ? '👁' : '📝'}
                </button>
              )}
              {previewMode === 'source' && hasPreviewToggle && (
                <button className="pv-op a" title="Save">💾</button>
              )}
              <button className="pv-op a" title="Copy">📋</button>
            </div>
          </div>

          <div className="pv-body">
            {/* .md preview */}
            {currentFile.ext === 'md' && previewMode === 'preview' && (
              <div className="pv-md">
                <h1>AI 发展历程 · PPT 大纲</h1>
                <hr/>
                <p>基于数据分析整理出的核心结构框架。</p>
                <ol>
                  <li><strong>🏛️ 人工智能的起源</strong> — 1950s 图灵测试·达特茅斯</li>
                  <li><strong>⚙️ 寒冬与重生</strong> — 1980s 专家系统·两次 AI 寒冬</li>
                  <li><strong>📈 机器学习的崛起</strong> — 2000s SVM·Random Forest</li>
                  <li><strong>🧠 深度学习革命</strong> — 2012 AlexNet·Transformer</li>
                  <li><strong>🤖 大模型时代</strong> — 2020 GPT·Claude</li>
                </ol>
              </div>
            )}
            {/* .md source */}
            {currentFile.ext === 'md' && previewMode === 'source' && (
              <div className="pv-src">
                <textarea defaultValue={`## AI 发展历程 · PPT 大纲\n\n---\n\n1. 🏛️ 人工智能的起源 (1950s)\n2. ⚙️ 寒冬与重生 (1980s)\n3. 📈 机器学习的崛起 (2000s)\n4. 🧠 深度学习革命 (2012)\n5. 🤖 大模型时代 (2020)`} />
              </div>
            )}
            {/* .code preview */}
            {currentFile.ext === 'code' && previewMode === 'preview' && (
              <div className="pv-src" style={{ padding: 0 }}>
                <pre style={{ margin: 0, padding: '16px 20px', fontSize: 12, lineHeight: 1.8, color: 'rgba(255,255,255,0.4)', overflow: 'auto', fontFamily: "'JetBrains Mono', monospace" }}>
                  <code dangerouslySetInnerHTML={{
                    __html: hljs.highlight(`// ${currentFile.name}
import { useState } from 'react'

export default function App() {
  const [count, setCount] = useState(0)
  return <div>{count}</div>
}`, { language: 'typescript' }).value
                  }} />
                </pre>
              </div>
            )}
            {/* .xlsx */}
            {currentFile.ext === 'xlsx' && (
              <div className="pv-slides" style={{ justifyContent: 'flex-start', alignItems: 'stretch', display: 'flex' }}>
                <div style={{ padding: 12 }}>
                  <div style={{ color: 'rgba(255,255,255,0.15)', fontSize: 11, marginBottom: 8 }}>📊 Sheet preview (first 20 rows)</div>
                  <table style={{ borderCollapse: 'collapse', fontSize: 11, color: 'rgba(255,255,255,0.35)', width: '100%' }}>
                    <tbody>
                      {[
                        ['Year', 'AI Milestone', 'Impact'],
                        ['1950', 'Turing Test', 'Foundation'],
                        ['1956', 'Dartmouth', 'Birth of AI'],
                        ['2012', 'AlexNet', 'Deep Learning'],
                        ['2017', 'Transformer', 'Modern LLMs'],
                        ['2020', 'GPT-3', 'Scaling'],
                      ].map((row, ri) => (
                        <tr key={ri} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          {row.map((cell, ci) => (
                            <td key={ci} style={{ padding: '4px 8px', fontWeight: ri === 0 ? 500 : 400, color: ri === 0 ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.18)' }}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {/* .img */}
            {currentFile.ext === 'img' && (
              <div className="pv-img">🖼 {currentFile.name}</div>
            )}
            {/* .pptx */}
            {currentFile.ext === 'pptx' && (
              <div className="pv-slides">
                <div className="pv-slide" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                    <span style={{ display: 'inline-block', width: 22, height: 14, background: '#007aff', borderRadius: 2, fontSize: 8, color: 'white', textAlign: 'center', lineHeight: '14px' }}>1</span>
                    <span className="st">AI 发展历程</span>
                  </div>
                  <div className="si">从图灵测试到大模型时代</div>
                </div>
                <div className="pv-slide">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                    <span style={{ display: 'inline-block', width: 22, height: 14, background: '#007aff', borderRadius: 2, fontSize: 8, color: 'white', textAlign: 'center', lineHeight: '14px' }}>2</span>
                    <span className="st">🏛️ 人工智能的起源</span>
                  </div>
                  <div className="si">1950: 图灵测试 · 1956: 达特茅斯</div>
                </div>
                <div className="pv-slide">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                    <span style={{ display: 'inline-block', width: 22, height: 14, background: '#007aff', borderRadius: 2, fontSize: 8, color: 'white', textAlign: 'center', lineHeight: '14px' }}>3</span>
                    <span className="st">⚙️ 寒冬与重生</span>
                  </div>
                  <div className="si">专家系统 · 两次 AI 寒冬</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
