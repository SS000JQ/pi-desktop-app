import { useEffect, useState } from 'react'
import type { ProviderCatalogEntry, ProviderModel } from '../types/chat'

interface WelcomeProps {
  onComplete: () => void
}

const STEPS = [
  { title: 'Welcome', description: 'Welcome to Pi Desktop, a desktop GUI for the Pi Agent Toolkit.' },
  { title: 'Provider', description: 'Choose an AI provider to get started.' },
  { title: 'API Key', description: 'Enter your API key for the selected provider.' },
  { title: 'Model', description: 'Select your default model.' },
  { title: 'Directory', description: 'Choose a default working directory.' },
  { title: 'Ready', description: 'You are all set.' },
]

export default function Welcome({ onComplete }: WelcomeProps) {
  const [step, setStep] = useState(0)
  const [catalog, setCatalog] = useState<ProviderCatalogEntry[]>([])
  const [selectedProvider, setSelectedProvider] = useState<ProviderCatalogEntry | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [models, setModels] = useState<ProviderModel[]>([])
  const [selectedModelId, setSelectedModelId] = useState('')
  const [workDir, setWorkDir] = useState('')
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
  const [testMessage, setTestMessage] = useState('')

  useEffect(() => {
    async function loadCatalog(): Promise<void> {
      const response = await window.piDesktop.providers.catalog()
      if (response.success && response.data) {
        setCatalog(response.data)
      }
    }

    void loadCatalog()
  }, [])

  async function handleTest(): Promise<void> {
    if (!selectedProvider || (selectedProvider.authType === 'apiKey' && !apiKey)) return

    setTestStatus('testing')
    const response = await window.piDesktop.providers.test({
      providerId: selectedProvider.providerId,
      displayName: selectedProvider.displayName,
      baseUrl: selectedProvider.baseUrl,
      apiKey: apiKey || undefined,
      apiType: selectedProvider.apiType,
    })

    const result = response.success ? response.data : undefined
    setTestStatus(result?.success ? 'success' : 'error')
    setTestMessage(result?.message || result?.error || response.error || 'Connection failed')

    const discovered = result?.detectedModels || []
    if (discovered.length > 0) {
      setModels(discovered)
      setSelectedModelId(discovered.find((model) => model.isDefault)?.id || discovered[0].id)
    }
  }

  async function handleContinueFromProvider(): Promise<void> {
    if (!selectedProvider) return

    const response = await window.piDesktop.providers.discoverModels({
      providerId: selectedProvider.providerId,
      displayName: selectedProvider.displayName,
      baseUrl: selectedProvider.baseUrl,
      apiType: selectedProvider.apiType,
    })

    const discovered = response.success && response.data ? response.data : []
    setModels(discovered)
    setSelectedModelId(discovered.find((model) => model.isDefault)?.id || discovered[0]?.id || '')
    setStep(2)
  }

  async function handleFinish(): Promise<void> {
    if (selectedProvider) {
      const selectedModel = models.find((model) => model.id === selectedModelId)
      await window.piDesktop.providers.add(
        {
          providerId: selectedProvider.providerId,
          displayName: selectedProvider.displayName,
          kind: 'builtin',
          authType: selectedProvider.authType,
          apiType: selectedProvider.apiType,
          baseUrl: selectedProvider.baseUrl,
          models: selectedModel ? [{ ...selectedModel, isDefault: true }] : [],
          isDefault: true,
        },
        apiKey || undefined,
      )
    }

    if (workDir) {
      await window.piDesktop.config.set('workingDirectory', workDir)
    }
    await window.piDesktop.config.set('wizardCompleted', 'true')
    onComplete()
  }

  return (
    <div className="wiz-full">
      <div className="wiz-box">
        <div className="steps">
          {STEPS.map((_, index) => (
            <div key={index} className={`step-dot ${index <= step ? 'active' : ''}`} />
          ))}
        </div>

        <div className="wiz-card">
          {step === 0 && (
            <div className="wiz-center">
              <div className="wiz-icon">Pi</div>
              <h1 className="wiz-h1">Welcome to Pi Desktop</h1>
              <p className="wiz-p">
                A desktop GUI for the Pi Agent Toolkit. Browse real Pi sessions, work with files, and continue coding
                from a desktop shell instead of the terminal alone.
              </p>
            </div>
          )}

          {step === 1 && (
            <div>
              <h2 className="wiz-h2">Choose a Provider</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {catalog.map((provider) => (
                  <button
                    key={provider.providerId}
                    onClick={() => setSelectedProvider(provider)}
                    className={`prov-btn ${selectedProvider?.providerId === provider.providerId ? 'active' : ''}`}
                  >
                    <span style={{ fontWeight: 500 }}>{provider.displayName}</span>
                    <span className="prov-url">{provider.baseUrl || provider.providerId}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && selectedProvider && (
            <div>
              <h2 className="wiz-h2">{selectedProvider.displayName}</h2>
              <p className="wiz-p" style={{ marginBottom: '10px' }}>
                {selectedProvider.authType === 'apiKey'
                  ? 'Enter your API key'
                  : 'This provider uses a non-key auth flow. You can continue and configure it later.'}
              </p>
              {selectedProvider.authType === 'apiKey' && (
                <input
                  type="password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  className="fi"
                  style={{ marginBottom: '10px' }}
                  placeholder="sk-..."
                />
              )}
              <button
                onClick={handleTest}
                disabled={selectedProvider.authType === 'apiKey' && !apiKey}
                className="bs"
              >
                {testStatus === 'testing' ? 'Testing...' : 'Test Connection'}
              </button>
              {testStatus !== 'idle' && (
                <div
                  className={testStatus === 'success' ? 'ts-success' : 'ts-error'}
                  style={{ fontSize: '11px', marginTop: '6px' }}
                >
                  {testMessage}
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="wiz-h2">Default Model</h2>
              <p className="wiz-p" style={{ marginBottom: '10px' }}>Choose your default model</p>
              {models.length === 0 ? (
                <input
                  value={selectedModelId}
                  onChange={(event) => setSelectedModelId(event.target.value)}
                  className="fi"
                  placeholder="gpt-4o-mini, claude-sonnet-4, etc."
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {models.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => setSelectedModelId(model.id)}
                      className={`prov-btn ${selectedModelId === model.id ? 'active' : ''}`}
                    >
                      <span style={{ fontWeight: 500 }}>{model.name}</span>
                      <span className="prov-url">{model.runtimeKey}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div>
              <h2 className="wiz-h2">Working Directory</h2>
              <p className="wiz-p" style={{ marginBottom: '10px' }}>Default folder for your projects (optional)</p>
              <input value={workDir} onChange={(event) => setWorkDir(event.target.value)} className="fi" placeholder="D:/PI/app" />
            </div>
          )}

          {step === 5 && (
            <div className="wiz-center">
              <div className="wiz-icon">OK</div>
              <h1 className="wiz-h1">You are all set</h1>
              <p className="wiz-p" style={{ marginBottom: '4px' }}>
                Provider: <span style={{ color: 'var(--text)' }}>{selectedProvider?.displayName || '(skipped)'}</span>
              </p>
              {selectedModelId && (
                <p className="wiz-p" style={{ marginBottom: '4px' }}>
                  Model: <span style={{ color: 'var(--text)' }}>{selectedModelId}</span>
                </p>
              )}
              {workDir && (
                <p className="wiz-p">
                  Directory: <span style={{ color: 'var(--text)' }}>{workDir}</span>
                </p>
              )}
            </div>
          )}

          <div className="wiz-nav">
            <div>
              {step > 0 ? (
                <button onClick={() => setStep(step - 1)} className="bd">Back</button>
              ) : (
                <button onClick={onComplete} className="bd">Skip</button>
              )}
            </div>
            {step === 0 && <button onClick={() => setStep(1)} className="bp">Continue</button>}
            {step === 1 && <button onClick={handleContinueFromProvider} disabled={!selectedProvider} className="bp">Continue</button>}
            {step === 2 && <button onClick={() => setStep(3)} className="bp">Continue</button>}
            {step === 3 && <button onClick={() => setStep(4)} className="bp">Continue</button>}
            {step === 4 && <button onClick={() => setStep(5)} className="bp">Continue</button>}
            {step === 5 && <button onClick={handleFinish} className="bp">Start Using Pi Desktop</button>}
          </div>
        </div>
      </div>
    </div>
  )
}
