import { useState } from 'react'

interface WelcomeProps {
  onComplete: () => void
}

const STEPS = [
  { title: 'Welcome', description: 'Welcome to Pi Desktop — a desktop GUI for the Pi Agent Toolkit.' },
  { title: 'Provider', description: 'Choose an AI provider to get started.' },
  { title: 'API Key', description: 'Enter your API key for the selected provider.' },
  { title: 'Model', description: 'Select your default model.' },
  { title: 'Directory', description: 'Choose a default working directory.' },
  { title: 'Ready', description: 'You\'re all set!' },
]

const BUILTIN_PROVIDERS = [
  { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1' },
  { name: 'Anthropic', baseUrl: 'https://api.anthropic.com/v1' },
  { name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1' },
  { name: 'Google (Gemini)', baseUrl: 'https://generativelanguage.googleapis.com/v1beta' },
  { name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1' },
]

export default function Welcome({ onComplete }: WelcomeProps) {
  const [step, setStep] = useState(0)
  const [provider, setProvider] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('')
  const [workDir, setWorkDir] = useState('')
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')

  async function handleTest() {
    if (!baseUrl || !apiKey) return
    setTestStatus('testing')
    const res = await window.piDesktop.providers.test({ baseUrl, apiKey })
    setTestStatus(res.success ? 'success' : 'error')
  }

  async function handleFinish() {
    if (provider && baseUrl && apiKey) {
      await window.piDesktop.providers.add(
        { name: provider, baseUrl, models: model ? [model] : [], isDefault: true },
        apiKey,
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
          {STEPS.map((s, i) => (
            <div key={i} className={`step-dot ${i <= step ? 'active' : ''}`} />
          ))}
        </div>

        <div className="wiz-card">
          {step === 0 && (
            <div className="wiz-center">
              <div className="wiz-icon">🚀</div>
              <h1 className="wiz-h1">Welcome to Pi Desktop</h1>
              <p className="wiz-p">
                A desktop GUI for the Pi Agent Toolkit. Chat with AI models, manage files, preview documents, and more.
              </p>
            </div>
          )}

          {step === 1 && (
            <div>
              <h2 className="wiz-h2">Choose a Provider</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {BUILTIN_PROVIDERS.map(p => (
                  <button
                    key={p.name}
                    onClick={() => { setProvider(p.name); setBaseUrl(p.baseUrl) }}
                    className={`prov-btn ${provider === p.name ? 'active' : ''}`}
                  >
                    <span style={{ fontWeight: 500 }}>{p.name}</span>
                    <span className="prov-url">{p.baseUrl}</span>
                  </button>
                ))}
                <button
                  onClick={() => { setProvider('Custom'); setBaseUrl('') }}
                  className="prov-btn"
                  style={{ color: 'var(--text2)' }}
                >
                  + Custom OpenAI-compatible endpoint
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h2 className="wiz-h2">{provider}</h2>
              <p className="wiz-p" style={{ marginBottom: '10px' }}>Enter your API key</p>
              <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} className="fi" style={{ marginBottom: '10px' }} placeholder="sk-..." />
              <button onClick={handleTest} disabled={!apiKey || testStatus === 'testing'} className="bs">
                {testStatus === 'testing' ? 'Testing...' : 'Test Connection'}
              </button>
              {testStatus !== 'idle' && (
                <div className={testStatus === 'success' ? 'ts-success' : 'ts-error'} style={{ fontSize: '11px', marginTop: '6px' }}>
                  {testStatus === 'success' ? '✓ Connection successful' : '✗ Connection failed'}
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div>
              <h2 className="wiz-h2">Default Model</h2>
              <p className="wiz-p" style={{ marginBottom: '10px' }}>Choose your default model</p>
              <input value={model} onChange={e => setModel(e.target.value)} className="fi" placeholder="gpt-4, claude-3-opus, etc." />
            </div>
          )}

          {step === 4 && (
            <div>
              <h2 className="wiz-h2">Working Directory</h2>
              <p className="wiz-p" style={{ marginBottom: '10px' }}>Default folder for your projects (optional)</p>
              <input value={workDir} onChange={e => setWorkDir(e.target.value)} className="fi" placeholder="~/projects" />
            </div>
          )}

          {step === 5 && (
            <div className="wiz-center">
              <div className="wiz-icon">✨</div>
              <h1 className="wiz-h1">You're All Set!</h1>
              <p className="wiz-p" style={{ marginBottom: '4px' }}>Provider: <span style={{ color: 'var(--text)' }}>{provider || '(skipped)'}</span></p>
              {model && <p className="wiz-p" style={{ marginBottom: '4px' }}>Model: <span style={{ color: 'var(--text)' }}>{model}</span></p>}
              {workDir && <p className="wiz-p">Directory: <span style={{ color: 'var(--text)' }}>{workDir}</span></p>}
            </div>
          )}

          <div className="wiz-nav">
            <div>
              {step > 0 ? (
                <button onClick={() => setStep(step - 1)} className="bd">← Back</button>
              ) : (
                <button onClick={onComplete} className="bd">Skip</button>
              )}
            </div>
            {step < 5 ? (
              <button onClick={() => setStep(step + 1)} className="bp">Continue →</button>
            ) : (
              <button onClick={handleFinish} className="bp">Start Using Pi Desktop</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
