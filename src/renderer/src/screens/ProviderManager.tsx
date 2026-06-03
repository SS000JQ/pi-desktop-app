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
  { name: 'Google (Gemini)', baseUrl: 'https://generativelanguage.googleapis.com/v1beta' },
  { name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1' },
  { name: 'Custom', baseUrl: '' },
]

interface ProviderManagerProps {
  onClose: () => void
}

export default function ProviderManager({ onClose }: ProviderManagerProps) {
  const [providers, setProviders] = useState<ProviderConfig[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formUrl, setFormUrl] = useState('')
  const [formApiKey, setFormApiKey] = useState('')
  const [formModels, setFormModels] = useState('')
  const [formIsDefault, setFormIsDefault] = useState(false)
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [testMessage, setTestMessage] = useState('')

  useEffect(() => { loadProviders() }, [])

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
        models: formModels.split(',').map((s) => s.trim()).filter(Boolean),
        isDefault: formIsDefault,
        apiKey: formApiKey || undefined,
      })
    } else {
      await window.piDesktop.providers.add(
        {
          name: formName,
          baseUrl: formUrl,
          models: formModels.split(',').map((s) => s.trim()).filter(Boolean),
          isDefault: formIsDefault,
        },
        formApiKey || undefined,
      )
    }
    setShowAddForm(false)
    loadProviders()
  }

  async function handleTest(): Promise<void> {
    setTestStatus('testing')
    setTestMessage('')
    const res = await window.piDesktop.providers.test({ baseUrl: formUrl, apiKey: formApiKey })
    setTestStatus(res.success ? 'success' : 'error')
    setTestMessage(res.error || 'Connection successful')
  }

  async function handleDelete(id: string): Promise<void> {
    await window.piDesktop.providers.delete(id)
    loadProviders()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ width: '540px', maxHeight: '80vh' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-hdr">
          <h2 className="modal-title">Provider Manager</h2>
          <button onClick={onClose} className="modal-x">✕</button>
        </div>

        <div className="modal-body">
          {providers.map((p) => (
            <div key={p.id} className="ci">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="flex items-center gap-2">
                  <span className="cit">{p.name}</span>
                  {p.isDefault && <span className="cib">default</span>}
                </div>
                <div className="cim truncate">{p.baseUrl}</div>
                {p.models.length > 0 && <div className="cim" style={{ marginTop: '2px' }}>{p.models.join(', ')}</div>}
              </div>
              <button onClick={() => handleDelete(p.id)} className="cix">✕</button>
            </div>
          ))}

          {showAddForm && (
            <div className="ci" style={{ display: 'block', padding: '14px' }}>
              <div style={{ marginBottom: '10px' }}>
                <label className="fl">Provider</label>
                <div className="prov-grid">
                  {BUILTIN_PROVIDERS.map((pr) => (
                    <button
                      key={pr.name}
                      onClick={() => { setFormName(pr.name); setFormUrl(pr.baseUrl) }}
                      className={`prov-pill ${formName === pr.name ? 'active' : ''}`}
                    >
                      {pr.name}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: '10px' }}>
                <label className="fl">Name</label>
                <input value={formName} onChange={(e) => setFormName(e.target.value)} className="fi" placeholder="My Provider" />
              </div>
              <div style={{ marginBottom: '10px' }}>
                <label className="fl">Base URL</label>
                <input value={formUrl} onChange={(e) => setFormUrl(e.target.value)} className="fi" placeholder="https://api.openai.com/v1" />
              </div>
              <div style={{ marginBottom: '10px' }}>
                <label className="fl">API Key</label>
                <div className="flex" style={{ gap: '6px' }}>
                  <input type="password" value={formApiKey} onChange={(e) => setFormApiKey(e.target.value)} className="fi" style={{ flex: 1 }} placeholder="sk-..." />
                  <button onClick={handleTest} disabled={!formUrl || !formApiKey || testStatus === 'testing'} className="bs">
                    {testStatus === 'testing' ? '...' : 'Test'}
                  </button>
                </div>
                {testStatus !== 'idle' && (
                  <div className={testStatus === 'success' ? 'ts-success' : 'ts-error'} style={{ fontSize: '10px', marginTop: '4px' }}>
                    {testMessage}
                  </div>
                )}
              </div>
              <div style={{ marginBottom: '10px' }}>
                <label className="fl">Models (comma separated)</label>
                <input value={formModels} onChange={(e) => setFormModels(e.target.value)} className="fi" placeholder="gpt-4, gpt-3.5-turbo" />
              </div>
              <label className="flex items-center" style={{ gap: '6px', fontSize: '11px', color: 'var(--text2)', cursor: 'pointer', marginBottom: '10px' }}>
                <input type="checkbox" checked={formIsDefault} onChange={(e) => setFormIsDefault(e.target.checked)} className="fchk" />
                Set as default provider
              </label>
              <div className="flex" style={{ gap: '6px' }}>
                <button onClick={handleSave} disabled={!formName || !formUrl} className="bp">Save</button>
                <button onClick={() => setShowAddForm(false)} className="bs">Cancel</button>
              </div>
            </div>
          )}
        </div>

        {!showAddForm && (
          <div className="modal-ftr">
            <button onClick={() => startAdd()} className="bt">+ Add Provider</button>
          </div>
        )}
      </div>
    </div>
  )
}
