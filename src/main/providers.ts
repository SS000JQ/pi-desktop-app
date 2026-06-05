import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { getModels, getProviders } from '@earendil-works/pi-ai'

export type ProviderKind = 'builtin' | 'custom'
export type ProviderAuthType = 'apiKey' | 'oauth' | 'none'
export type ProviderApiType =
  | 'openai-completions'
  | 'openai-responses'
  | 'anthropic-messages'
  | 'google-generative-ai'

export interface ProviderCatalogEntry {
  providerId: string
  displayName: string
  apiType: ProviderApiType
  authType: ProviderAuthType
  baseUrl: string
  allowCustomBaseUrl: boolean
}

export interface ProviderModelConfig {
  id: string
  name: string
  providerId: string
  runtimeKey: string
  input: string[]
  reasoning: boolean
  isDefault: boolean
}

export interface ProviderConfig {
  id: string
  providerId: string
  displayName: string
  kind: ProviderKind
  hasAuth: boolean
  authType: ProviderAuthType
  apiType: ProviderApiType
  baseUrl: string
  headers?: Record<string, string>
  authHeader?: string
  compat?: Record<string, unknown>
  models: ProviderModelConfig[]
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

interface CliSettings {
  defaultProvider?: string
  defaultModel?: string
  defaultThinkingLevel?: string
  [key: string]: unknown
}

interface CliAuthCredential {
  type: 'api_key' | 'oauth'
  key?: string
  [key: string]: unknown
}

type CliAuthData = Record<string, CliAuthCredential>

interface CliModelDefinition {
  id: string
  name?: string
  api?: string
  baseUrl?: string
  reasoning?: boolean
  input?: Array<'text' | 'image'>
  headers?: Record<string, string>
  compat?: Record<string, unknown>
}

interface CliModelOverride {
  name?: string
  reasoning?: boolean
  input?: Array<'text' | 'image'>
  headers?: Record<string, string>
  compat?: Record<string, unknown>
}

interface CliProviderDefinition {
  name?: string
  baseUrl?: string
  apiKey?: string
  api?: string
  headers?: Record<string, string>
  compat?: Record<string, unknown>
  authHeader?: boolean
  models?: CliModelDefinition[]
  modelOverrides?: Record<string, CliModelOverride>
}

interface CliModelsConfig {
  providers: Record<string, CliProviderDefinition>
}

const PI_AGENT_DIR = process.env.PI_AGENT_DIR || join(homedir(), '.pi', 'agent')
const SETTINGS_PATH = join(PI_AGENT_DIR, 'settings.json')
const AUTH_PATH = join(PI_AGENT_DIR, 'auth.json')
const MODELS_PATH = join(PI_AGENT_DIR, 'models.json')

const BUILTIN_PROVIDER_CATALOG_OVERRIDES: Record<string, ProviderCatalogEntry> = {
  openai: {
    providerId: 'openai',
    displayName: 'OpenAI',
    apiType: 'openai-responses',
    authType: 'apiKey',
    baseUrl: 'https://api.openai.com/v1',
    allowCustomBaseUrl: false,
  },
  anthropic: {
    providerId: 'anthropic',
    displayName: 'Anthropic',
    apiType: 'anthropic-messages',
    authType: 'apiKey',
    baseUrl: 'https://api.anthropic.com/v1',
    allowCustomBaseUrl: false,
  },
  google: {
    providerId: 'google',
    displayName: 'Google Gemini',
    apiType: 'google-generative-ai',
    authType: 'apiKey',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    allowCustomBaseUrl: false,
  },
  openrouter: {
    providerId: 'openrouter',
    displayName: 'OpenRouter',
    apiType: 'openai-completions',
    authType: 'apiKey',
    baseUrl: 'https://openrouter.ai/api/v1',
    allowCustomBaseUrl: false,
  },
  groq: {
    providerId: 'groq',
    displayName: 'Groq',
    apiType: 'openai-completions',
    authType: 'apiKey',
    baseUrl: 'https://api.groq.com/openai/v1',
    allowCustomBaseUrl: false,
  },
  mistral: {
    providerId: 'mistral',
    displayName: 'Mistral',
    apiType: 'openai-completions',
    authType: 'apiKey',
    baseUrl: 'https://api.mistral.ai/v1',
    allowCustomBaseUrl: false,
  },
  deepseek: {
    providerId: 'deepseek',
    displayName: 'DeepSeek',
    apiType: 'openai-completions',
    authType: 'apiKey',
    baseUrl: 'https://api.deepseek.com/v1',
    allowCustomBaseUrl: false,
  },
  xai: {
    providerId: 'xai',
    displayName: 'xAI',
    apiType: 'openai-completions',
    authType: 'apiKey',
    baseUrl: 'https://api.x.ai/v1',
    allowCustomBaseUrl: false,
  },
  'azure-openai-responses': {
    providerId: 'azure-openai-responses',
    displayName: 'Azure OpenAI',
    apiType: 'openai-responses',
    authType: 'apiKey',
    baseUrl: 'https://example-resource.openai.azure.com/openai/v1',
    allowCustomBaseUrl: true,
  },
  cerebras: {
    providerId: 'cerebras',
    displayName: 'Cerebras',
    apiType: 'openai-completions',
    authType: 'apiKey',
    baseUrl: 'https://api.cerebras.ai/v1',
    allowCustomBaseUrl: false,
  },
  'cloudflare-ai-gateway': {
    providerId: 'cloudflare-ai-gateway',
    displayName: 'Cloudflare AI Gateway',
    apiType: 'openai-completions',
    authType: 'apiKey',
    baseUrl: '',
    allowCustomBaseUrl: true,
  },
  'cloudflare-workers-ai': {
    providerId: 'cloudflare-workers-ai',
    displayName: 'Cloudflare Workers AI',
    apiType: 'openai-completions',
    authType: 'apiKey',
    baseUrl: 'https://api.cloudflare.com/client/v4/accounts/',
    allowCustomBaseUrl: true,
  },
  'vercel-ai-gateway': {
    providerId: 'vercel-ai-gateway',
    displayName: 'Vercel AI Gateway',
    apiType: 'openai-completions',
    authType: 'apiKey',
    baseUrl: 'https://ai-gateway.vercel.sh/v1',
    allowCustomBaseUrl: false,
  },
  together: {
    providerId: 'together',
    displayName: 'Together AI',
    apiType: 'openai-completions',
    authType: 'apiKey',
    baseUrl: 'https://api.together.xyz/v1',
    allowCustomBaseUrl: false,
  },
  'github-copilot': {
    providerId: 'github-copilot',
    displayName: 'GitHub Copilot',
    apiType: 'openai-completions',
    authType: 'oauth',
    baseUrl: '',
    allowCustomBaseUrl: false,
  },
  'openai-codex': {
    providerId: 'openai-codex',
    displayName: 'OpenAI Codex',
    apiType: 'openai-responses',
    authType: 'oauth',
    baseUrl: '',
    allowCustomBaseUrl: false,
  },
}

function ensureAgentDir(): void {
  if (!existsSync(PI_AGENT_DIR)) {
    mkdirSync(PI_AGENT_DIR, { recursive: true })
  }
}

function readJsonFile<T>(filePath: string, fallback: T): T {
  try {
    if (!existsSync(filePath)) return fallback
    return JSON.parse(readFileSync(filePath, 'utf-8')) as T
  } catch {
    return fallback
  }
}

function writeJsonFile(filePath: string, data: unknown): void {
  ensureAgentDir()
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

function readSettings(): CliSettings {
  return readJsonFile<CliSettings>(SETTINGS_PATH, {})
}

function writeSettings(settings: CliSettings): void {
  writeJsonFile(SETTINGS_PATH, settings)
}

function readAuthData(): CliAuthData {
  return readJsonFile<CliAuthData>(AUTH_PATH, {})
}

function writeAuthData(auth: CliAuthData): void {
  writeJsonFile(AUTH_PATH, auth)
}

function readModelsConfig(): CliModelsConfig {
  const raw = readJsonFile<Partial<CliModelsConfig>>(MODELS_PATH, { providers: {} })
  return { providers: raw.providers || {} }
}

function writeModelsConfig(modelsConfig: CliModelsConfig): void {
  writeJsonFile(MODELS_PATH, modelsConfig)
}

function fileTimestamp(filePath: string): string {
  try {
    return statSync(filePath).mtime.toISOString()
  } catch {
    return new Date(0).toISOString()
  }
}

function titleCaseProvider(providerId: string): string {
  return providerId
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function inferProviderCatalogEntry(providerId: string): ProviderCatalogEntry {
  return BUILTIN_PROVIDER_CATALOG_OVERRIDES[providerId] || {
    providerId,
    displayName: titleCaseProvider(providerId),
    apiType: 'openai-completions',
    authType: 'apiKey',
    baseUrl: '',
    allowCustomBaseUrl: true,
  }
}

function normalizeModelConfig(
  providerId: string,
  modelId: string,
  name?: string,
  reasoning = false,
  input: string[] = ['text'],
  isDefault = false,
): ProviderModelConfig {
  return {
    id: modelId,
    name: name || modelId,
    providerId,
    runtimeKey: `${providerId}/${modelId}`,
    input,
    reasoning,
    isDefault,
  }
}

function getBuiltInModels(providerId: string): ProviderModelConfig[] {
  try {
    return getModels(providerId as never).map((model, index) =>
      normalizeModelConfig(
        providerId,
        model.id,
        model.name,
        model.reasoning,
        model.input as string[] | undefined,
        index === 0,
      ),
    )
  } catch {
    return []
  }
}

function applyModelOverrides(
  providerId: string,
  models: ProviderModelConfig[],
  overrides: Record<string, CliModelOverride> | undefined,
): ProviderModelConfig[] {
  if (!overrides) return models

  return models.map((model) => {
    const override = overrides[model.id]
    if (!override) return model
    return normalizeModelConfig(
      providerId,
      model.id,
      override.name || model.name,
      override.reasoning ?? model.reasoning,
      override.input || model.input,
      model.isDefault,
    )
  })
}

function mergeProviderModels(
  providerId: string,
  providerConfig: CliProviderDefinition | undefined,
  settings: CliSettings,
): ProviderModelConfig[] {
  const builtInModels = applyModelOverrides(
    providerId,
    getBuiltInModels(providerId),
    providerConfig?.modelOverrides,
  )
  const modelMap = new Map<string, ProviderModelConfig>()

  for (const model of builtInModels) {
    modelMap.set(model.id, model)
  }

  for (const model of providerConfig?.models || []) {
    modelMap.set(
      model.id,
      normalizeModelConfig(
        providerId,
        model.id,
        model.name,
        model.reasoning ?? false,
        model.input || ['text'],
        false,
      ),
    )
  }

  const defaultModelId = settings.defaultProvider === providerId ? settings.defaultModel : undefined
  if (defaultModelId && !modelMap.has(defaultModelId)) {
    modelMap.set(defaultModelId, normalizeModelConfig(providerId, defaultModelId, defaultModelId, false, ['text'], false))
  }

  const models = Array.from(modelMap.values())
  if (models.length === 0) return []

  const selectedDefaultId =
    defaultModelId && models.some((model) => model.id === defaultModelId)
      ? defaultModelId
      : models[0].id

  return models.map((model) => ({ ...model, isDefault: model.id === selectedDefaultId }))
}

function listConfiguredProviderIds(
  settings: CliSettings,
  auth: CliAuthData,
  modelsConfig: CliModelsConfig,
): string[] {
  return Array.from(
    new Set([
      ...(settings.defaultProvider ? [settings.defaultProvider] : []),
      ...Object.keys(auth),
      ...Object.keys(modelsConfig.providers),
    ]),
  ).filter(Boolean)
}

function readAllCliState(): {
  settings: CliSettings
  auth: CliAuthData
  modelsConfig: CliModelsConfig
} {
  return {
    settings: readSettings(),
    auth: readAuthData(),
    modelsConfig: readModelsConfig(),
  }
}

function buildProviderConfig(
  providerId: string,
  settings: CliSettings,
  auth: CliAuthData,
  modelsConfig: CliModelsConfig,
): ProviderConfig {
  const providerCatalog = inferProviderCatalogEntry(providerId)
  const customProvider = modelsConfig.providers[providerId]
  const models = mergeProviderModels(providerId, customProvider, settings)
  const timestamps = [SETTINGS_PATH, AUTH_PATH, MODELS_PATH].map(fileTimestamp).sort()
  const timestamp = timestamps[timestamps.length - 1] || new Date(0).toISOString()

  return {
    id: providerId,
    providerId,
    displayName: customProvider?.name || providerCatalog.displayName,
    kind: BUILTIN_PROVIDER_CATALOG_OVERRIDES[providerId] ? 'builtin' : 'custom',
    hasAuth: Boolean(auth[providerId] || customProvider?.apiKey),
    authType: auth[providerId]?.type === 'oauth' ? 'oauth' : providerCatalog.authType,
    apiType: toProviderApiType(customProvider?.api) || providerCatalog.apiType,
    baseUrl: customProvider?.baseUrl || providerCatalog.baseUrl,
    headers: customProvider?.headers || {},
    authHeader: customProvider?.authHeader ? 'Authorization' : undefined,
    compat: customProvider?.compat,
    models,
    isDefault: settings.defaultProvider === providerId,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

function toProviderApiType(api?: string): ProviderApiType | undefined {
  switch (api) {
    case 'openai-completions':
    case 'openai-responses':
    case 'anthropic-messages':
    case 'google-generative-ai':
      return api
    default:
      return undefined
  }
}

function persistDefaultSelection(
  settings: CliSettings,
  providerId: string | undefined,
  models: ProviderModelConfig[],
  requestedDefaultModel?: string,
): CliSettings {
  const next = { ...settings }
  if (!providerId) return next

  next.defaultProvider = providerId
  const defaultModel =
    requestedDefaultModel
    || models.find((model) => model.isDefault)?.id
    || models[0]?.id
    || next.defaultModel

  if (defaultModel) {
    next.defaultModel = defaultModel
  }

  return next
}

function shouldPersistProviderConfig(
  config: Omit<ProviderConfig, 'id' | 'createdAt' | 'updatedAt'>,
): boolean {
  if (config.kind === 'custom') return true
  const catalog = inferProviderCatalogEntry(config.providerId)
  if (config.baseUrl && config.baseUrl !== catalog.baseUrl) return true
  if (config.headers && Object.keys(config.headers).length > 0) return true
  if (config.compat && Object.keys(config.compat).length > 0) return true

  const builtInModelIds = new Set(getBuiltInModels(config.providerId).map((model) => model.id))
  return config.models.some((model) => !builtInModelIds.has(model.id))
}

function toCliProviderDefinition(
  config: Omit<ProviderConfig, 'id' | 'createdAt' | 'updatedAt'>,
  apiKey?: string,
): CliProviderDefinition {
  const definition: CliProviderDefinition = {
    name: config.displayName,
    baseUrl: config.baseUrl || undefined,
    api: config.apiType,
    headers: config.headers,
    compat: config.compat,
    authHeader: config.authHeader === 'Authorization' ? true : undefined,
  }

  if (config.kind === 'custom') {
    definition.models = config.models.map((model) => ({
      id: model.id,
      name: model.name,
      baseUrl: config.baseUrl || undefined,
      api: config.apiType,
      reasoning: model.reasoning,
      input: model.input as Array<'text' | 'image'>,
    }))
    if (apiKey) {
      definition.apiKey = apiKey
    }
  } else {
    const builtInModelIds = new Set(getBuiltInModels(config.providerId).map((model) => model.id))
    const customModels = config.models.filter((model) => !builtInModelIds.has(model.id))
    if (customModels.length > 0) {
      definition.models = customModels.map((model) => ({
        id: model.id,
        name: model.name,
        baseUrl: config.baseUrl || undefined,
        api: config.apiType,
        reasoning: model.reasoning,
        input: model.input as Array<'text' | 'image'>,
      }))
    }
  }

  return definition
}

export function getProviderCatalog(): ProviderCatalogEntry[] {
  return Array.from(new Set([...getProviders(), ...Object.keys(BUILTIN_PROVIDER_CATALOG_OVERRIDES)]))
    .sort((left, right) => left.localeCompare(right))
    .map((providerId) => inferProviderCatalogEntry(providerId))
}

export function loadProviders(): ProviderConfig[] {
  const { settings, auth, modelsConfig } = readAllCliState()
  const providerIds = listConfiguredProviderIds(settings, auth, modelsConfig)
  const providers = providerIds.map((providerId) => buildProviderConfig(providerId, settings, auth, modelsConfig))

  if (providers.length === 0) return []
  if (providers.some((provider) => provider.isDefault)) return providers

  return providers.map((provider, index) => ({
    ...provider,
    isDefault: index === 0,
    models: provider.models.map((model, modelIndex) => ({ ...model, isDefault: index === 0 && modelIndex === 0 })),
  }))
}

export function addProvider(
  config: Omit<ProviderConfig, 'id' | 'createdAt' | 'updatedAt'>,
  apiKey?: string,
): ProviderConfig {
  const { settings, auth, modelsConfig } = readAllCliState()
  const providerId = config.providerId

  if (apiKey) {
    auth[providerId] = { type: 'api_key', key: apiKey }
    writeAuthData(auth)
  }

  if (shouldPersistProviderConfig(config)) {
    modelsConfig.providers[providerId] = toCliProviderDefinition(config, apiKey)
    writeModelsConfig(modelsConfig)
  }

  const nextSettings = config.isDefault
    ? persistDefaultSelection(settings, providerId, config.models)
    : settings
  writeSettings(nextSettings)

  return loadProviders().find((provider) => provider.providerId === providerId) || buildProviderConfig(providerId, nextSettings, auth, modelsConfig)
}

export function updateProvider(
  id: string,
  updates: Partial<ProviderConfig> & { apiKey?: string },
): ProviderConfig | null {
  const current = loadProviders().find((provider) => provider.id === id || provider.providerId === id)
  if (!current) return null

  const { apiKey, createdAt: _createdAt, updatedAt: _updatedAt, id: _providerRecordId, ...rest } = updates
  const nextModels = rest.models || current.models
  const merged: Omit<ProviderConfig, 'id' | 'createdAt' | 'updatedAt'> = {
    providerId: rest.providerId || current.providerId,
    displayName: rest.displayName || current.displayName,
    kind: rest.kind || current.kind,
    hasAuth: apiKey !== undefined ? Boolean(apiKey) : current.hasAuth,
    authType: rest.authType || current.authType,
    apiType: rest.apiType || current.apiType,
    baseUrl: rest.baseUrl ?? current.baseUrl,
    headers: rest.headers ?? current.headers,
    authHeader: rest.authHeader ?? current.authHeader,
    compat: rest.compat ?? current.compat,
    models: nextModels,
    isDefault: rest.isDefault ?? current.isDefault,
  }

  const { settings, auth, modelsConfig } = readAllCliState()

  if (apiKey !== undefined) {
    if (apiKey) {
      auth[merged.providerId] = { type: 'api_key', key: apiKey }
    } else {
      delete auth[merged.providerId]
    }
    writeAuthData(auth)
  }

  if (shouldPersistProviderConfig(merged)) {
    modelsConfig.providers[merged.providerId] = toCliProviderDefinition(merged, apiKey || getDecryptedApiKey(merged.providerId) || undefined)
  } else {
    delete modelsConfig.providers[merged.providerId]
  }
  writeModelsConfig(modelsConfig)

  const nextSettings = merged.isDefault
    ? persistDefaultSelection(settings, merged.providerId, merged.models)
    : settings.defaultProvider === merged.providerId && settings.defaultModel
      ? persistDefaultSelection(settings, merged.providerId, merged.models, settings.defaultModel)
      : settings
  writeSettings(nextSettings)

  return loadProviders().find((provider) => provider.providerId === merged.providerId) || null
}

export function deleteProvider(id: string): boolean {
  const { settings, auth, modelsConfig } = readAllCliState()
  const exists =
    Boolean(auth[id])
    || Boolean(modelsConfig.providers[id])
    || settings.defaultProvider === id

  if (!exists) return false

  delete auth[id]
  delete modelsConfig.providers[id]

  if (settings.defaultProvider === id) {
    delete settings.defaultProvider
    delete settings.defaultModel
  }

  writeAuthData(auth)
  writeModelsConfig(modelsConfig)
  writeSettings(settings)
  return true
}

export function getDecryptedApiKey(id: string): string | null {
  const auth = readAuthData()
  const credential = auth[id]
  return credential?.type === 'api_key' && typeof credential.key === 'string' ? credential.key : null
}

export function getDefaultModel(provider: ProviderConfig): ProviderModelConfig | null {
  return provider.models.find((model) => model.isDefault) || provider.models[0] || null
}

export function getDefaultProvider(): ProviderConfig | null {
  const providers = loadProviders()
  return providers.find((provider) => provider.isDefault) || providers[0] || null
}

export function getProviderByModelKey(modelKey: string): { provider: ProviderConfig; model: ProviderModelConfig } | null {
  const [providerId, ...modelIdParts] = modelKey.split('/')
  const modelId = modelIdParts.join('/')
  const providers = loadProviders()

  for (const provider of providers) {
    if (provider.providerId !== providerId && modelIdParts.length > 0) {
      continue
    }

    const model = provider.models.find((entry) =>
      entry.runtimeKey === modelKey
      || entry.id === modelKey
      || (providerId === provider.providerId && entry.id === modelId),
    )

    if (model) return { provider, model }
  }

  return null
}

export async function discoverModels(config: {
  providerId?: string
  displayName?: string
  baseUrl: string
  apiType?: ProviderApiType
}): Promise<ProviderModelConfig[]> {
  const providerId = config.providerId || config.displayName?.trim().toLowerCase().replace(/\s+/g, '-') || 'custom'
  const builtIn = getBuiltInModels(providerId)
  return builtIn
}

export async function testConnection(provider: {
  providerId?: string
  displayName?: string
  baseUrl: string
  apiKey?: string
  apiType?: ProviderApiType
}): Promise<{ success: boolean; message?: string; error?: string; detectedModels?: ProviderModelConfig[] }> {
  const providerId = provider.providerId || provider.displayName?.trim().toLowerCase().replace(/\s+/g, '-') || 'custom'
  const catalog = inferProviderCatalogEntry(providerId)
  const detectedModels = await discoverModels({
    providerId,
    displayName: provider.displayName,
    baseUrl: provider.baseUrl,
    apiType: provider.apiType,
  })

  if (!provider.baseUrl && !catalog.baseUrl && providerId !== 'github-copilot' && providerId !== 'openai-codex') {
    return {
      success: false,
      error: 'Base URL is required',
      detectedModels,
    }
  }

  return {
    success: true,
    message: provider.apiKey ? 'CLI provider settings look valid' : 'Provider metadata loaded from Pi CLI state',
    detectedModels,
  }
}

export function getCliAgentPaths(): {
  agentDir: string
  settingsPath: string
  authPath: string
  modelsPath: string
} {
  return {
    agentDir: PI_AGENT_DIR,
    settingsPath: SETTINGS_PATH,
    authPath: AUTH_PATH,
    modelsPath: MODELS_PATH,
  }
}

export function getCliProviderState(): {
  settings: CliSettings
  authProviders: string[]
  modelsProviders: string[]
} {
  const { settings, auth, modelsConfig } = readAllCliState()
  return {
    settings,
    authProviders: Object.keys(auth),
    modelsProviders: Object.keys(modelsConfig.providers),
  }
}
