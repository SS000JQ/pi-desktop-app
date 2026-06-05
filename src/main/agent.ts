import { streamSimple, getModel } from '@earendil-works/pi-ai'
import {
  getDecryptedApiKey,
  getDefaultProvider,
  getDefaultModel,
  getProviderByModelKey,
  loadProviders,
} from './providers'
import { overwriteMessages } from './session-store'

const sessions = new Map<string, any[]>()
const abortControllers = new Map<string, AbortController>()

export function getSessionMessages(sessionId: string): any[] {
  return sessions.get(sessionId) || []
}

export function addUserMessage(sessionId: string, text: string): void {
  const messages = sessions.get(sessionId) || []
  messages.push({ role: 'user', content: [{ type: 'text', text }] })
  sessions.set(sessionId, messages)
  overwriteMessages(sessionId, messages)
}

function resolveStructuredModel(modelId?: string): { model: any; apiKey?: string } | null {
  const providers = loadProviders()
  const matched = modelId ? getProviderByModelKey(modelId) : null

  if (matched) {
    const { provider, model } = matched
    const apiKey = getDecryptedApiKey(provider.id) || undefined

    try {
      const builtInModel = getModel(provider.providerId as any, model.id as any)
      return { model: builtInModel, apiKey }
    } catch {
      return {
        model: {
          api: provider.apiType,
          id: model.id,
          provider: provider.providerId,
          baseUrl: provider.baseUrl,
          name: model.name,
          input: model.input,
        },
        apiKey,
      }
    }
  }

  if (modelId) {
    const parts = modelId.split('/')
    if (parts.length >= 2) {
      const providerId = parts[0]
      const joinedModelId = parts.slice(1).join('/')

      try {
        const builtInModel = getModel(providerId as any, joinedModelId as any)
        const configuredProvider = providers.find((provider) => provider.providerId === providerId)
        const apiKey = configuredProvider ? getDecryptedApiKey(configuredProvider.id) || undefined : undefined
        return { model: builtInModel, apiKey }
      } catch {
        // fall through to default provider
      }
    }
  }

  const defaultProvider = getDefaultProvider()
  if (!defaultProvider) return null

  const defaultModel = getDefaultModel(defaultProvider)
  if (!defaultModel) return null

  const apiKey = getDecryptedApiKey(defaultProvider.id) || undefined
  try {
    return {
      model: getModel(defaultProvider.providerId as any, defaultModel.id as any),
      apiKey,
    }
  } catch {
    return {
      model: {
        api: defaultProvider.apiType,
        id: defaultModel.id,
        provider: defaultProvider.providerId,
        baseUrl: defaultProvider.baseUrl,
        name: defaultModel.name,
        input: defaultModel.input,
      },
      apiKey,
    }
  }
}

export async function* streamResponse(
  sessionId: string,
  modelId?: string,
): AsyncGenerator<{ type: 'token'; text: string } | { type: 'done' } | { type: 'error'; error: string }> {
  const messages = sessions.get(sessionId) || []
  if (messages.length === 0) {
    yield { type: 'error', error: 'No messages in session' }
    return
  }

  const resolved = resolveStructuredModel(modelId)
  if (!resolved) {
    yield { type: 'error', error: 'No configured model available. Set one in Provider Manager.' }
    return
  }

  const abortController = new AbortController()
  abortControllers.set(sessionId, abortController)

  let fullResponse = ''
  try {
    const stream = streamSimple(
      resolved.model,
      { messages },
      { apiKey: resolved.apiKey, signal: abortController.signal },
    )

    for await (const event of stream) {
      if (event.type === 'text_delta') {
        fullResponse += event.delta
        yield { type: 'token', text: event.delta }
      } else if (event.type === 'done') {
        const nextMessages = sessions.get(sessionId) || []
        nextMessages.push(event.message)
        sessions.set(sessionId, nextMessages)
        overwriteMessages(sessionId, nextMessages)
        yield { type: 'done' }
        return
      } else if (event.type === 'error') {
        yield { type: 'error', error: event.error?.errorMessage || 'Stream error' }
        return
      }
    }

    yield { type: 'done' }
  } catch (error: unknown) {
    yield { type: 'error', error: error instanceof Error ? error.message : 'Unknown error' }
  } finally {
    abortControllers.delete(sessionId)
  }
}

export function abortSession(sessionId: string): void {
  const abortController = abortControllers.get(sessionId)
  if (abortController) {
    abortController.abort()
    abortControllers.delete(sessionId)
  }
}

export function clearSession(sessionId: string): void {
  sessions.delete(sessionId)
}
