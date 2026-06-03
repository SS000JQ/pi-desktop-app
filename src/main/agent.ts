// Dynamic ESM import for @earendil-works/pi-ai (pure ESM, can't be require'd from CJS)
let piAi: any = null
async function getPiAi() {
  if (!piAi) {
    piAi = await import('@earendil-works/pi-ai')
  }
  return piAi
}

import { getDecryptedApiKey } from './providers'

const sessions = new Map<string, any[]>()
const abortControllers = new Map<string, AbortController>()

export function getSessionMessages(sessionId: string): any[] {
  return sessions.get(sessionId) || []
}

export function addUserMessage(sessionId: string, text: string): void {
  const msgs = sessions.get(sessionId) || []
  msgs.push({
    role: 'user',
    content: [{ type: 'text', text }],
  })
  sessions.set(sessionId, msgs)
}

// Resolve model string to pi-ai Model + API key
async function resolveModel(modelId: string): Promise<{ model: any; apiKey?: string } | null> {
  const pi = await getPiAi()
  const parts = modelId.split('/')
  if (parts.length === 2) {
    try {
      const model = pi.getModel(parts[0], parts[1])
      const { loadProviders } = require('./providers')
      const config = loadProviders()
      const provider = config.find((p: any) =>
        p.name.toLowerCase() === parts[0].toLowerCase() ||
        p.baseUrl?.includes(parts[0])
      )
      if (provider) {
        const apiKey = getDecryptedApiKey(provider.id)
        if (apiKey) return { model, apiKey }
      }
      const envKey = process.env[`${parts[0].toUpperCase()}_API_KEY`] || process.env.OPENAI_API_KEY
      return { model, apiKey: envKey }
    } catch {
      // fall through
    }
  }

  // Custom OpenAI-compatible model
  const { loadProviders } = require('./providers')
  const config = loadProviders()
  const provider = config.find((p: any) =>
    p.models?.includes(modelId) || p.models?.some((m: string) => m.includes(modelId))
  )
  if (provider) {
    const apiKey = getDecryptedApiKey(provider.id)
    return {
      model: {
        api: 'openai-completions',
        id: modelId,
        provider: provider.name.toLowerCase(),
        baseUrl: provider.baseUrl,
        name: modelId,
        input: ['text'],
      },
      apiKey: apiKey || undefined,
    }
  }

  return null
}

export async function* streamResponse(
  sessionId: string,
  modelId: string = 'openai/gpt-4',
): AsyncGenerator<
  { type: 'token'; text: string } | { type: 'done' } | { type: 'error'; error: string }
> {
  const messages = sessions.get(sessionId) || []
  if (messages.length === 0) {
    yield { type: 'error', error: 'No messages in session' }
    return
  }

  const resolved = await resolveModel(modelId)
  if (!resolved) {
    yield { type: 'error', error: `Model "${modelId}" not configured. Add it in Provider Manager or set OPENAI_API_KEY env var.` }
    return
  }

  const pi = await getPiAi()
  const ac = new AbortController()
  abortControllers.set(sessionId, ac)

  let fullResponse = ''

  try {
    const stream = pi.streamSimple(
      resolved.model,
      { messages },
      { apiKey: resolved.apiKey || undefined, signal: ac.signal },
    )

    for await (const event of stream) {
      if (event.type === 'text_delta') {
        fullResponse += event.delta
        yield { type: 'token', text: event.delta }
      } else if (event.type === 'done') {
        const msgs = sessions.get(sessionId) || []
        msgs.push(event.message)
        sessions.set(sessionId, msgs)
        yield { type: 'done' }
        return
      } else if (event.type === 'error') {
        yield { type: 'error', error: event.error?.errorMessage || 'Stream error' }
        return
      }
    }

    yield { type: 'done' }
  } catch (err: unknown) {
    if (ac.signal.aborted) {
      yield { type: 'done' }
    } else {
      yield { type: 'error', error: err instanceof Error ? err.message : 'Unknown error' }
    }
  } finally {
    abortControllers.delete(sessionId)
  }
}

export function abortSession(sessionId: string): void {
  const ac = abortControllers.get(sessionId)
  if (ac) { ac.abort(); abortControllers.delete(sessionId) }
  sessions.delete(sessionId)
}

export function clearSession(sessionId: string): void {
  sessions.delete(sessionId)
}
