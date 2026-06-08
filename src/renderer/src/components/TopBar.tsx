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
  onBrowseDirectory?: () => void
  tokenCount?: number
  tokenLimit?: number | null
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
  onBrowseDirectory,
  tokenCount = 0,
  tokenLimit = null,
}: TopBarProps) {
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [showDirPicker, setShowDirPicker] = useState(false)
  const [showThinkingPicker, setShowThinkingPicker] = useState(false)
  const currentDirLabel = currentDir || 'Choose workspace...'

  return (
    <div className="topbar drag-region">
      <span className="topbar-title">Pi Desktop</span>

      <div className="topbar-path-wrap">
        <button
          className="topbar-path-btn no-drag"
          title={currentDirLabel}
          onClick={() => setShowDirPicker((state) => !state)}
        >
          {currentDirLabel}
        </button>
        {showDirPicker && (
          <div className="topbar-menu topbar-menu-left no-drag">
            {directoryOptions.length === 0 ? (
              <div className="topbar-menu-empty">No directories available yet</div>
            ) : (
              <>
                {directoryOptions.map((dir) => (
                  <button
                    key={dir}
                    className={`topbar-menu-item ${dir === currentDir ? 'active' : ''}`}
                    title={dir}
                    onClick={() => {
                      onDirectoryChange?.(dir)
                      setShowDirPicker(false)
                    }}
                  >
                    {dir}
                  </button>
                ))}
              </>
            )}
            <button
              className="topbar-menu-item"
              onClick={() => {
                onBrowseDirectory?.()
                setShowDirPicker(false)
              }}
            >
              Browse folders...
            </button>
          </div>
        )}
      </div>

      <div className="topbar-right no-drag">
        <div className="relative">
          <button
            className="mbadge"
            aria-label="Current model"
            title={currentModelLabel || currentModel || 'No models configured'}
            onClick={() => setShowModelPicker((state) => !state)}
          >
            {currentModelLabel || currentModel || 'No models configured'}
          </button>
          {showModelPicker && (
            <div className="topbar-menu topbar-menu-right">
              {modelOptions.length === 0 ? (
                <div className="topbar-menu-empty">No models configured</div>
              ) : (
                modelOptions.map((model) => (
                  <button
                    key={model.id}
                    className={`topbar-menu-item ${model.id === currentModel ? 'active' : ''}`}
                    onClick={() => {
                      onModelChange?.(model.id)
                      setShowModelPicker(false)
                    }}
                  >
                    {model.label}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="relative">
          <button className="mbadge" aria-label="Current thinking level" onClick={() => setShowThinkingPicker((state) => !state)}>
            Thinking: {thinkingLevel}
          </button>
          {showThinkingPicker && (
            <div className="topbar-menu topbar-menu-right">
              {THINKING_LEVELS.map((level) => (
                <button
                  key={level}
                  className={`topbar-menu-item ${level === thinkingLevel ? 'active' : ''}`}
                  onClick={() => {
                    onThinkingLevelChange?.(level)
                    setShowThinkingPicker(false)
                  }}
                >
                  {level}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="tk" title={tokenLimit ? 'Estimated context usage' : 'Historical tokens recorded for this session'}>
          {tokenLimit ? (
            <><span>{tokenCount.toLocaleString()}</span> / {tokenLimit.toLocaleString()}</>
          ) : (
            <><span>History tokens:</span> {tokenCount.toLocaleString()}</>
          )}
        </div>
      </div>
    </div>
  )
}
