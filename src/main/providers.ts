import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { app, safeStorage } from 'electron'

const PROVIDERS_PATH = join(app.getPath('userData'), 'pi-desktop', 'providers.json')

export interface ProviderConfig {
  id: string
  name: string
  baseUrl: string
  apiKeyEncrypted?: string
  models: string[]
  isDefault: boolean
  createdAt: string
}

export function loadProviders(): ProviderConfig[] {
  try {
    if (!existsSync(PROVIDERS_PATH)) return []
    return JSON.parse(readFileSync(PROVIDERS_PATH, 'utf-8'))
  } catch {
    return []
  }
}

function saveProviders(providers: ProviderConfig[]): void {
  const dir = join(app.getPath('userData'), 'pi-desktop')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(PROVIDERS_PATH, JSON.stringify(providers, null, 2), 'utf-8')
}

function encryptKey(apiKey: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    return safeStorage.encryptString(apiKey).toString('base64')
  }
  // Fallback: base64 encode (not secure, but better than plaintext)
  return Buffer.from(apiKey).toString('base64')
}

function decryptKey(encrypted: string): string {
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
    }
    return Buffer.from(encrypted, 'base64').toString('utf-8')
  } catch {
    return ''
  }
}

export function addProvider(
  config: Omit<ProviderConfig, 'id' | 'createdAt' | 'apiKeyEncrypted'>,
  apiKey?: string
): ProviderConfig {
  const providers = loadProviders()
  const id = `prov-${Date.now()}`
  const provider: ProviderConfig = {
    ...config,
    id,
    createdAt: new Date().toISOString(),
    apiKeyEncrypted: apiKey ? encryptKey(apiKey) : undefined
  }
  providers.push(provider)
  saveProviders(providers)
  return provider
}

export function updateProvider(
  id: string,
  updates: Partial<ProviderConfig> & { apiKey?: string }
): ProviderConfig | null {
  const providers = loadProviders()
  const idx = providers.findIndex((p) => p.id === id)
  if (idx === -1) return null
  const { apiKey, ...rest } = updates
  Object.assign(providers[idx], rest)
  if (apiKey !== undefined) {
    providers[idx].apiKeyEncrypted = apiKey ? encryptKey(apiKey) : undefined
  }
  saveProviders(providers)
  return providers[idx]
}

export function deleteProvider(id: string): boolean {
  const providers = loadProviders()
  const filtered = providers.filter((p) => p.id !== id)
  if (filtered.length === providers.length) return false
  saveProviders(filtered)
  return true
}

export function getDecryptedApiKey(id: string): string | null {
  const provider = loadProviders().find((p) => p.id === id)
  if (!provider?.apiKeyEncrypted) return null
  return decryptKey(provider.apiKeyEncrypted)
}

export async function testConnection(provider: {
  baseUrl: string
  apiKey: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(
      `${provider.baseUrl.replace(/\/+$/, '')}/models`,
      {
        headers: { Authorization: `Bearer ${provider.apiKey}` }
      }
    )
    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`
      }
    }
    return { success: true }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Connection failed'
    }
  }
}
