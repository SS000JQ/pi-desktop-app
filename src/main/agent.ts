import { streamSimple, getModel } from '@earendil-works/pi-ai'
import type { Message } from '@earendil-works/pi-ai'
import { getDecryptedApiKey } from './providers'

const sessions = new Map<string, Message[]>()
const abortControllers = new Map<string, AbortController>()

export function getSessionMessages(sessionId: string): Message[] {
  return sessions.get(sessionId) || []
}

export function addUserMessage(sessionId: string, text: string): void {
  const msgs = sessions.get(sessionId) || []
  msgs.push({
    role: 'user',
    content: [{ type: 'text', text: text }],
  } as Message)
  sessions.set(sessionId, msgs)
}

export function getMessagesForLlm(sessionId: string): Message[] {
  return sessions.get(sessionId) || []
}

// Resolve a provider+model string to pi-ai's Model + API key
function resolveModel(modelId: string): { model: any; apiKey?: string } | null {
  // Try pi-ai's built-in model registry first
  // Format: "provider/modelId" e.g. "openai/gpt-4", "anthropic/claude-sonnet-4-20250514"
  const parts = modelId.split('/')
  if (parts.length === 2) {
    try {
      const model = getModel(parts[0] as any, parts[1] as any)
      // Get API key from our provider config
      const config = require('./providers').loadProviders()
      const provider = config.find((p: any) =>
        p.name.toLowerCase() === parts[0].toLowerCase() ||
        p.baseUrl.includes(parts[0])
      )
      if (provider) {
        const apiKey = getDecryptedApiKey(provider.id)
        if (apiKey) return { model, apiKey }
      }
      // Fallback: try env var
      const envKey = process.env[`${parts[0].toUpperCase()}_API_KEY`] || process.env.OPENAI_API_KEY
      return { model, apiKey: envKey }
    } catch {
      // Fall through to custom model handling
    }
  }

  // Custom OpenAI-compatible model (set up in Provider Manager)
  // Try to find any provider whose models list includes this modelId
  const config = require('./providers').loadProviders()
  const provider = config.find((p: any) =>
    p.models.includes(modelId) || p.models.some((m: string) => m.includes(modelId))
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

  const resolved = resolveModel(modelId)
  if (!resolved) {
    // Try using modelId as a direct API key for OpenAI-compatible endpoint
    yield { type: 'error', error: `Model "${modelId}" not configured. Add it in Provider Manager or set OPENAI_API_KEY.` }
    return
  }

  const ac = new AbortController()
  abortControllers.set(sessionId, ac)

  let fullResponse = ''

  try {
    const stream = streamSimple(
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
        msgs.push(event.message as Message)
        sessions.set(sessionId, msgs)
        yield { type: 'done' }
        return
      } else if (event.type === 'error') {
        yield { type: 'error', error: event.error.errorMessage || 'Stream error' }
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
  if (ac) {
    ac.abort()
    abortControllers.delete(sessionId)
  }
  sessions.delete(sessionId)
}

export function clearSession(sessionId: string): void {
  sessions.delete(sessionId)
}
