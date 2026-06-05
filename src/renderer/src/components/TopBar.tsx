import { useState } from 'react'
import type { ModelOption } from '../types/chat'

interface TopBarProps {
  currentDir: string
  directoryOptions?: string[]
  currentModelLabel?: string
  currentModel?: string
  modelOptions?: ModelOption[]
  onDirectoryChange?: (dir: string) => void
  onModelChange?: (model: string) => void
  thinkingLevel?: string
  onThinkingLevelChange?: (thinkingLevel: string) => void
  onOpenSettings?: () => void
  onOpenProfile?: () => void
  tokenCount?: number
  tokenLimit?: number
}

const THINKING_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh']

export default function TopBar({
  currentDir,
  directoryOptions = [],
  currentModelLabel,
  currentModel = '',
  onDirectoryChange,
  modelOptions = [],
  onModelChange,
  thinkingLevel = 'medium',
  onThinkingLevelChange,
  onOpenSettings,
  onOpenProfile,
  tokenCount = 0,
  tokenLimit = 8000,
}: TopBarProps) {
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [showDirPicker, setShowDirPicker] = useState(false)
  const [showThinkingPicker, setShowThinkingPicker] = useState(false)

  return (
    <div className="topbar drag-region">
      <span className="topbar-title">Pi Desktop</span>
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setShowDirPicker(!showDirPicker)}
          style={{ border: 'none', background: 'none', fontFamily: 'inherit', fontSize: 14, color: 'rgba(255,255,255,0.15)', cursor: 'pointer', padding: 0 }}
        >
          {currentDir}
        </button>
        {showDirPicker && (
          <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: '#1a1919', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 3, minWidth: 200, zIndex: 20, padding: 4 }}>
            {directoryOptions.length === 0 ? (
              <div style={{ padding: '8px 10px', fontSize: 10, color: 'rgba(255,255,255,0.15)' }}>
                No directories available
              </div>
            ) : directoryOptions.map((dir) => (
              <button
                key={dir}
                onClick={() => {
                  onDirectoryChange?.(dir)
                  setShowDirPicker(false)
                }}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '5px 8px',
                  border: 'none',
                  background: dir === currentDir ? 'rgba(255,255,255,0.06)' : 'transparent',
                  color: dir === currentDir ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.2)',
                  fontFamily: 'inherit',
                  fontSize: 12,
                  textAlign: 'left',
                  cursor: 'pointer',
                  borderRadius: 2,
                }}
              >
                {dir}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="topbar-right no-drag">
        <div className="relative">
          <div className="mbadge" onClick={() => setShowModelPicker(!showModelPicker)}>
            {currentModelLabel || currentModel || 'No models configured'}
          </div>
          {showModelPicker && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 4,
              background: '#1a1919', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 3, minWidth: 220, overflow: 'hidden', zIndex: 20
            }}>
              {modelOptions.length === 0 ? (
                <div style={{ padding: '8px 10px', fontSize: 10, color: 'rgba(255,255,255,0.15)' }}>
                  No models configured
                </div>
              ) : modelOptions.map((model) => (
                <button
                  key={model.id}
                  onClick={() => { onModelChange?.(model.id); setShowModelPicker(false) }}
                  style={{
                    display: 'block', width: '100%', padding: '6px 10px', border: 'none',
                    background: model.id === currentModel ? 'rgba(255,255,255,0.06)' : 'transparent',
                    color: model.id === currentModel ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.25)',
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
                    textAlign: 'left', cursor: 'pointer', transition: 'all 120ms'
                  }}
                >
                  {model.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="relative">
          <div className="mbadge" onClick={() => setShowThinkingPicker(!showThinkingPicker)}>
            Thinking: {thinkingLevel}
          </div>
          {showThinkingPicker && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, marginTop: 4,
              background: '#1a1919', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 3, minWidth: 140, overflow: 'hidden', zIndex: 20
            }}>
              {THINKING_LEVELS.map((level) => (
                <button
                  key={level}
                  onClick={() => { onThinkingLevelChange?.(level); setShowThinkingPicker(false) }}
                  style={{
                    display: 'block', width: '100%', padding: '6px 10px', border: 'none',
                    background: level === thinkingLevel ? 'rgba(255,255,255,0.06)' : 'transparent',
                    color: level === thinkingLevel ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.25)',
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
                    textAlign: 'left', cursor: 'pointer'
                  }}
                >
                  {level}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="tk"><span>{tokenCount.toLocaleString()}</span> / {tokenLimit.toLocaleString()}</div>
        <button className="ibtn" title="Search">⌕</button>
        <button className="ibtn" onClick={onOpenProfile} title="Profile">P</button>
        <button className="ibtn" onClick={onOpenSettings} title="Settings">⚙</button>
      </div>
    </div>
  )
}
