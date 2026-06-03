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
        apiKey
      )
    }
    if (workDir) {
      await window.piDesktop.config.set('workingDirectory', workDir)
    }
    await window.piDesktop.config.set('wizardCompleted', 'true')
    onComplete()
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#0F172A]">
      <div className="w-[480px]">
        {/* Step indicator */}
        <div className="flex justify-center gap-1 mb-8">
          {STEPS.map((s, i) => (
            <div key={i} className={`h-1 rounded-full transition-all ${i <= step ? 'w-8 bg-accent' : 'w-4 bg-[#1E293B]'}`} />
          ))}
        </div>

        <div className="bg-surface border border-border rounded-xl p-6">
          {/* Step 0: Welcome */}
          {step === 0 && (
            <div className="text-center">
              <div className="text-3xl mb-3">🚀</div>
              <h1 className="text-lg font-semibold mb-2">Welcome to Pi Desktop</h1>
              <p className="text-sm text-muted leading-relaxed">
                A desktop GUI for the Pi Agent Toolkit. Chat with AI models,
                manage files, preview documents, and more.
              </p>
            </div>
          )}

          {/* Step 1: Provider selection */}
          {step === 1 && (
            <div>
              <h2 className="text-sm font-semibold mb-3">Choose a Provider</h2>
              <div className="space-y-1.5">
                {BUILTIN_PROVIDERS.map(p => (
                  <button key={p.name} onClick={() => { setProvider(p.name); setBaseUrl(p.baseUrl) }} className={`w-full text-left px-3 py-2 rounded-lg text-sm border transition-all ${provider === p.name ? 'border-accent bg-accent/10' : 'border-border hover:border-muted'}`}>
                    <span className="font-medium">{p.name}</span>
                    <span className="text-muted text-[11px] ml-2">{p.baseUrl}</span>
                  </button>
                ))}
                <button onClick={() => { setProvider('Custom'); setBaseUrl('') }} className="w-full text-left px-3 py-2 rounded-lg text-sm border border-border text-muted hover:border-muted hover:text-[#F1F5F9]">
                  + Custom OpenAI-compatible endpoint
                </button>
              </div>
            </div>
          )}

          {/* Step 2: API Key */}
          {step === 2 && (
            <div>
              <h2 className="text-sm font-semibold mb-1">{provider}</h2>
              <p className="text-xs text-muted mb-3">Enter your API key</p>
              <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} className="w-full bg-[#0F172A] border border-border rounded px-3 py-2 text-sm text-[#F1F5F9] outline-none focus:border-accent mb-3" placeholder="sk-..." />
              <button onClick={handleTest} disabled={!apiKey || testStatus === 'testing'} className="px-3 py-1.5 text-xs bg-surface border border-border rounded text-muted hover:text-[#F1F5F9] disabled:opacity-40">
                {testStatus === 'testing' ? 'Testing...' : 'Test Connection'}
              </button>
              {testStatus !== 'idle' && (
                <div className={`text-xs mt-2 ${testStatus === 'success' ? 'text-success' : 'text-error'}`}>
                  {testStatus === 'success' ? '✓ Connection successful' : '✗ Connection failed'}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Model */}
          {step === 3 && (
            <div>
              <h2 className="text-sm font-semibold mb-1">Default Model</h2>
              <p className="text-xs text-muted mb-3">Choose your default model</p>
              <input value={model} onChange={e => setModel(e.target.value)} className="w-full bg-[#0F172A] border border-border rounded px-3 py-2 text-sm text-[#F1F5F9] outline-none focus:border-accent" placeholder="gpt-4, claude-3-opus, etc." />
            </div>
          )}

          {/* Step 4: Directory */}
          {step === 4 && (
            <div>
              <h2 className="text-sm font-semibold mb-1">Working Directory</h2>
              <p className="text-xs text-muted mb-3">Default folder for your projects (optional)</p>
              <input value={workDir} onChange={e => setWorkDir(e.target.value)} className="w-full bg-[#0F172A] border border-border rounded px-3 py-2 text-sm text-[#F1F5F9] outline-none focus:border-accent" placeholder="~/projects" />
            </div>
          )}

          {/* Step 5: Complete */}
          {step === 5 && (
            <div className="text-center">
              <div className="text-3xl mb-3">✨</div>
              <h1 className="text-lg font-semibold mb-2">You're All Set!</h1>
              <p className="text-sm text-muted mb-1">Provider: <span className="text-[#F1F5F9]">{provider || '(skipped)'}</span></p>
              {model && <p className="text-sm text-muted mb-1">Model: <span className="text-[#F1F5F9]">{model}</span></p>}
              {workDir && <p className="text-sm text-muted">Directory: <span className="text-[#F1F5F9]">{workDir}</span></p>}
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-6 pt-4 border-t border-[#1E293B]">
            <div>
              {step > 0 ? (
                <button onClick={() => setStep(step - 1)} className="text-xs text-muted hover:text-[#F1F5F9]">← Back</button>
              ) : (
                <button onClick={onComplete} className="text-xs text-dim hover:text-muted">Skip</button>
              )}
            </div>
            {step < 5 ? (
              <button onClick={() => setStep(step + 1)} className="px-4 py-1.5 text-xs bg-accent text-white rounded hover:bg-accent-hover">Continue →</button>
            ) : (
              <button onClick={handleFinish} className="px-4 py-1.5 text-xs bg-accent text-white rounded hover:bg-accent-hover">Start Using Pi Desktop</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
