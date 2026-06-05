import { useEffect, useState } from 'react'
import type { ProviderCatalogEntry, ProviderModel, ProviderSummary } from '../types/chat'

interface ProviderManagerProps {
  onClose: () => void
}

export default function ProviderManager({ onClose }: ProviderManagerProps) {
  const [catalog, setCatalog] = useState<ProviderCatalogEntry[]>([])
  const [providers, setProviders] = useState<ProviderSummary[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [selectedCatalog, setSelectedCatalog] = useState<ProviderCatalogEntry | null>(null)
  const [formDisplayName, setFormDisplayName] = useState('')
  const [formUrl, setFormUrl] = useState('')
  const [formApiKey, setFormApiKey] = useState('')
  const [formModels, setFormModels] = useState<ProviderModel[]>([])
  const [formIsDefault, setFormIsDefault] = useState(false)
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [testMessage, setTestMessage] = useState('')

  useEffect(() => {
    void Promise.all([loadCatalog(), loadProviders()])
  }, [])

  async function loadCatalog(): Promise<void> {
    const response = await window.piDesktop.providers.catalog()
    if (response.success && response.data) {
      setCatalog(response.data)
    }
  }

  async function loadProviders(): Promise<void> {
    const response = await window.piDesktop.providers.list()
    if (response.success && response.data) {
      setProviders(response.data)
    }
  }

  function startAdd(selected?: ProviderCatalogEntry): void {
    setSelectedCatalog(selected || null)
    setFormDisplayName(selected?.displayName || '')
    setFormUrl(selected?.baseUrl || '')
    setFormApiKey('')
    setFormModels([])
    setFormIsDefault(false)
    setTestStatus('idle')
    setTestMessage('')
    setShowAddForm(true)
  }

  async function handleDiscoverModels(): Promise<void> {
    const providerId = selectedCatalog?.providerId || 'custom'
    const response = await window.piDesktop.providers.discoverModels({
      providerId,
      displayName: formDisplayName,
      baseUrl: formUrl,
      apiType: selectedCatalog?.apiType || 'openai-completions',
    })

    if (response.success && response.data) {
      setFormModels(response.data)
    }
  }

  async function handleTest(): Promise<void> {
    setTestStatus('testing')
    setTestMessage('')

    const response = await window.piDesktop.providers.test({
      providerId: selectedCatalog?.providerId || 'custom',
      displayName: formDisplayName,
      baseUrl: formUrl,
      apiKey: formApiKey || undefined,
      apiType: selectedCatalog?.apiType || 'openai-completions',
    })

    const result = response.success ? response.data : undefined
    setTestStatus(result?.success ? 'success' : 'error')
    setTestMessage(result?.message || result?.error || response.error || 'Connection failed')
    if (result?.detectedModels?.length) {
      setFormModels(result.detectedModels)
    }
  }

  async function handleSave(): Promise<void> {
    if (!formDisplayName || !formUrl) return

    await window.piDesktop.providers.add(
      {
        providerId: selectedCatalog?.providerId || 'custom',
        displayName: formDisplayName,
        kind: selectedCatalog ? 'builtin' : 'custom',
        authType: selectedCatalog?.authType || 'apiKey',
        apiType: selectedCatalog?.apiType || 'openai-completions',
        baseUrl: formUrl,
        models: formModels,
        isDefault: formIsDefault,
      },
      formApiKey || undefined,
    )

    setShowAddForm(false)
    await loadProviders()
  }

  async function handleDelete(id: string): Promise<void> {
    await window.piDesktop.providers.delete(id)
    await loadProviders()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" style={{ width: '620px', maxHeight: '80vh' }} onClick={(event) => event.stopPropagation()}>
        <div className="modal-hdr">
          <h2 className="modal-title">Provider Manager</h2>
          <button onClick={onClose} className="modal-x">×</button>
        </div>

        <div className="modal-body">
          {providers.map((provider) => (
            <div key={provider.id} className="ci">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="flex items-center gap-2">
                  <span className="cit">{provider.displayName}</span>
                  {provider.isDefault && <span className="cib">default</span>}
                </div>
                <div className="cim truncate">{provider.baseUrl}</div>
                {provider.models.length > 0 && (
                  <div className="cim" style={{ marginTop: '2px' }}>
                    {provider.models.map((model) => `${provider.displayName} / ${model.name}`).join(', ')}
                  </div>
                )}
              </div>
              <button onClick={() => handleDelete(provider.id)} className="cix">×</button>
            </div>
          ))}

          {showAddForm && (
            <div className="ci" style={{ display: 'block', padding: '14px' }}>
              <div style={{ marginBottom: '10px' }}>
                <label className="fl">Provider</label>
                <div className="prov-grid">
                  {catalog.map((provider) => (
                    <button
                      key={provider.providerId}
                      onClick={() => {
                        setSelectedCatalog(provider)
                        setFormDisplayName(provider.displayName)
                        setFormUrl(provider.baseUrl)
                      }}
                      className={`prov-pill ${selectedCatalog?.providerId === provider.providerId ? 'active' : ''}`}
                    >
                      {provider.displayName}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setSelectedCatalog(null)
                      setFormDisplayName('Custom')
                      setFormUrl('')
                    }}
                    className={`prov-pill ${selectedCatalog === null && formDisplayName === 'Custom' ? 'active' : ''}`}
                  >
                    Custom
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '10px' }}>
                <label className="fl">Name</label>
                <input value={formDisplayName} onChange={(event) => setFormDisplayName(event.target.value)} className="fi" placeholder="My Provider" />
              </div>

              <div style={{ marginBottom: '10px' }}>
                <label className="fl">Base URL</label>
                <input value={formUrl} onChange={(event) => setFormUrl(event.target.value)} className="fi" placeholder="https://api.openai.com/v1" />
              </div>

              <div style={{ marginBottom: '10px' }}>
                <label className="fl">API Key</label>
                <div className="flex" style={{ gap: '6px' }}>
                  <input type="password" value={formApiKey} onChange={(event) => setFormApiKey(event.target.value)} className="fi" style={{ flex: 1 }} placeholder="sk-..." />
                  <button onClick={handleTest} disabled={!formUrl || testStatus === 'testing'} className="bs">
                    {testStatus === 'testing' ? '...' : 'Test'}
                  </button>
                  <button onClick={handleDiscoverModels} disabled={!formUrl} className="bs">Models</button>
                </div>
                {testStatus !== 'idle' && (
                  <div className={testStatus === 'success' ? 'ts-success' : 'ts-error'} style={{ fontSize: '10px', marginTop: '4px' }}>
                    {testMessage}
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '10px' }}>
                <label className="fl">Models</label>
                {formModels.length === 0 ? (
                  <div className="cim">No models discovered yet. Use Models to load defaults.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {formModels.map((model, index) => (
                      <label key={model.id} className="flex items-center" style={{ gap: '6px', fontSize: '11px', color: 'var(--text2)', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="defaultModel"
                          checked={model.isDefault}
                          onChange={() => {
                            setFormModels((previous) =>
                              previous.map((entry, entryIndex) => ({ ...entry, isDefault: entryIndex === index })),
                            )
                          }}
                          className="fchk"
                        />
                        <span>{model.name}</span>
                        <span className="cim">{model.runtimeKey}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <label className="flex items-center" style={{ gap: '6px', fontSize: '11px', color: 'var(--text2)', cursor: 'pointer', marginBottom: '10px' }}>
                <input type="checkbox" checked={formIsDefault} onChange={(event) => setFormIsDefault(event.target.checked)} className="fchk" />
                Set as default provider
              </label>

              <div className="flex" style={{ gap: '6px' }}>
                <button onClick={handleSave} disabled={!formDisplayName || !formUrl} className="bp">Save</button>
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
