import { useState, useEffect } from 'react'

interface ProviderConfig {
  id: string
  name: string
  baseUrl: string
  models: string[]
  isDefault: boolean
  createdAt: string
}

const BUILTIN_PROVIDERS = [
  { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1' },
  { name: 'Anthropic', baseUrl: 'https://api.anthropic.com/v1' },
  { name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1' },
  {
    name: 'Google (Gemini)',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta'
  },
  { name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1' },
  { name: 'Custom', baseUrl: '' }
]

interface ProviderManagerProps {
  onClose: () => void
}

export default function ProviderManager({
  onClose
}: ProviderManagerProps) {
  const [providers, setProviders] = useState<ProviderConfig[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formUrl, setFormUrl] = useState('')
  const [formApiKey, setFormApiKey] = useState('')
  const [formModels, setFormModels] = useState('')
  const [formIsDefault, setFormIsDefault] = useState(false)
  const [testStatus, setTestStatus] = useState<
    'idle' | 'testing' | 'success' | 'error'
  >('idle')
  const [testMessage, setTestMessage] = useState('')

  useEffect(() => {
    loadProviders()
  }, [])

  async function loadProviders(): Promise<void> {
    const res = await window.piDesktop.providers.list()
    if (res.success && res.data) {
      setProviders(res.data as ProviderConfig[])
    }
  }

  function startAdd(selected?: { name: string; baseUrl: string }): void {
    setEditingId(null)
    setFormName(selected?.name || '')
    setFormUrl(selected?.baseUrl || '')
    setFormApiKey('')
    setFormModels('')
    setFormIsDefault(false)
    setTestStatus('idle')
    setShowAddForm(true)
  }

  async function handleSave(): Promise<void> {
    if (!formName || !formUrl) return
    if (editingId) {
      await window.piDesktop.providers.update(editingId, {
        name: formName,
        baseUrl: formUrl,
        models: formModels
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        isDefault: formIsDefault,
        apiKey: formApiKey || undefined
      })
    } else {
      await window.piDesktop.providers.add(
        {
          name: formName,
          baseUrl: formUrl,
          models: formModels
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          isDefault: formIsDefault
        },
        formApiKey || undefined
      )
    }
    setShowAddForm(false)
    loadProviders()
  }

  async function handleTest(): Promise<void> {
    setTestStatus('testing')
    setTestMessage('')
    const res = await window.piDesktop.providers.test({
      baseUrl: formUrl,
      apiKey: formApiKey
    })
    setTestStatus(res.success ? 'success' : 'error')
    setTestMessage(res.error || 'Connection successful')
  }

  async function handleDelete(id: string): Promise<void> {
    await window.piDesktop.providers.delete(id)
    loadProviders()
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-[#0F172A] border border-border rounded-lg w-[560px] max-h-[80vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#1E293B]">
          <h2 className="text-sm font-semibold">Provider Manager</h2>
          <button
            onClick={onClose}
            className="text-dim hover:text-muted text-sm"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {providers.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 bg-surface border border-border rounded-lg px-3 py-2.5"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{p.name}</span>
                  {p.isDefault && (
                    <span className="text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded">
                      default
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-muted truncate">
                  {p.baseUrl}
                </div>
                {p.models.length > 0 && (
                  <div className="text-[10px] text-dim mt-0.5">
                    {p.models.join(', ')}
                  </div>
                )}
              </div>
              <button
                onClick={() => handleDelete(p.id)}
                className="text-dim hover:text-error text-xs px-1"
              >
                ✕
              </button>
            </div>
          ))}

          {showAddForm && (
            <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
              <div>
                <label className="text-[11px] text-muted block mb-1">
                  Provider
                </label>
                <div className="flex gap-1 flex-wrap">
                  {BUILTIN_PROVIDERS.map((pr) => (
                    <button
                      key={pr.name}
                      onClick={() => {
                        setFormName(pr.name)
                        setFormUrl(pr.baseUrl)
                      }}
                      className={`text-[10px] px-2 py-1 rounded ${
                        formName === pr.name
                          ? 'bg-accent text-white'
                          : 'bg-[#1E293B] text-muted hover:text-[#F1F5F9]'
                      }`}
                    >
                      {pr.name}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[11px] text-muted block mb-1">
                  Name
                </label>
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-[#0F172A] border border-border rounded px-2 py-1.5 text-sm text-[#F1F5F9] outline-none focus:border-accent"
                  placeholder="My Provider"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted block mb-1">
                  Base URL
                </label>
                <input
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  className="w-full bg-[#0F172A] border border-border rounded px-2 py-1.5 text-sm text-[#F1F5F9] outline-none focus:border-accent"
                  placeholder="https://api.openai.com/v1"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted block mb-1">
                  API Key
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={formApiKey}
                    onChange={(e) => setFormApiKey(e.target.value)}
                    className="flex-1 bg-[#0F172A] border border-border rounded px-2 py-1.5 text-sm text-[#F1F5F9] outline-none focus:border-accent"
                    placeholder="sk-..."
                  />
                  <button
                    onClick={handleTest}
                    disabled={
                      !formUrl || !formApiKey || testStatus === 'testing'
                    }
                    className="px-2 py-1.5 text-[10px] bg-surface border border-border rounded text-muted hover:text-[#F1F5F9] disabled:opacity-40"
                  >
                    {testStatus === 'testing' ? '...' : 'Test'}
                  </button>
                </div>
                {testStatus !== 'idle' && (
                  <div
                    className={`text-[10px] mt-1 ${
                      testStatus === 'success' ? 'text-success' : 'text-error'
                    }`}
                  >
                    {testMessage}
                  </div>
                )}
              </div>
              <div>
                <label className="text-[11px] text-muted block mb-1">
                  Models (comma separated)
                </label>
                <input
                  value={formModels}
                  onChange={(e) => setFormModels(e.target.value)}
                  className="w-full bg-[#0F172A] border border-border rounded px-2 py-1.5 text-sm text-[#F1F5F9] outline-none focus:border-accent"
                  placeholder="gpt-4, gpt-3.5-turbo"
                />
              </div>
              <label className="flex items-center gap-2 text-[11px] text-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={formIsDefault}
                  onChange={(e) => setFormIsDefault(e.target.checked)}
                  className="rounded border-border"
                />
                Set as default provider
              </label>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSave}
                  disabled={!formName || !formUrl}
                  className="px-3 py-1.5 text-xs bg-accent text-white rounded hover:bg-accent-hover disabled:opacity-40"
                >
                  Save
                </button>
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 text-xs bg-surface text-muted rounded hover:text-[#F1F5F9]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {!showAddForm && (
          <div className="px-4 py-3 border-t border-[#1E293B]">
            <button
              onClick={() => startAdd()}
              className="text-xs text-accent hover:text-accent-hover"
            >
              + Add Provider
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
