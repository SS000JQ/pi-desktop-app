import { getModel } from '@earendil-works/pi-ai'
import { readdirSync, statSync } from 'fs'
import { extname, join } from 'path'
import { homedir } from 'os'
import { getConfigValue } from './config-store'
import { openPiSession } from './pi-sessions'
import { loadPiCodingAgentModule } from './pi-sdk'
import { createPiResourceLoader } from './pi-resources'
import { resolveOptionalExistingDirectory, resolveRuntimeDirectory } from './path-utils'
import {
  getDefaultModel,
  getDefaultProvider,
  getDecryptedApiKey,
  getProviderByModelKey,
  type ProviderConfig,
  type ProviderModelConfig,
} from './providers'
import type {
  AgentSession,
  AgentSessionEvent,
} from '@earendil-works/pi-coding-agent'

const ARTIFACT_SCAN_MAX_DEPTH = 8
const ARTIFACT_SCAN_MAX_FILES = 5000

export interface PiBridgeEvent {
  type:
    | 'run_started'
    | 'assistant_token'
    | 'assistant_thinking'
    | 'assistant_message'
    | 'tool_started'
    | 'tool_finished'
    | 'tool_failed'
    | 'artifact_created'
    | 'run_aborted'
    | 'run_failed'
    | 'session_state_changed'
    | 'warning'
  sessionId: string
  text?: string
  error?: string
  toolName?: string
  args?: unknown
  path?: string
}

interface SessionBinding {
  sessionId: string
  session: AgentSession
  resourceLoader?: { reload: () => Promise<unknown> | unknown }
  unsubscribe?: () => void
  cwd: string
  modelKey?: string
  thinkingLevel?: string
  sessionPath: string
}

interface ResolvedRuntimeModel {
  provider: ProviderConfig
  modelConfig: ProviderModelConfig
  apiKey?: string
}

export class PiBridge {
  private bindings = new Map<string, SessionBinding>()

  async sendMessage(
    sessionId: string,
    sessionPath: string,
    text: string,
    modelKey: string | undefined,
    thinkingLevel: string | undefined,
    emit: (event: PiBridgeEvent) => void,
  ): Promise<void> {
    const binding = await this.ensureSession(sessionId, sessionPath, modelKey, thinkingLevel, emit)
    const beforeFiles = this.snapshotFiles(binding.cwd)
    emit({ type: 'run_started', sessionId })

    try {
      await binding.session.prompt(text)
      for (const artifactPath of this.detectArtifacts(binding.cwd, beforeFiles)) {
        emit({ type: 'artifact_created', sessionId, path: artifactPath })
      }
      emit({ type: 'session_state_changed', sessionId })
    } catch (error: unknown) {
      emit({
        type: 'run_failed',
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown Pi runtime error',
      })
      throw error
    }
  }

  async abort(sessionKey: string, emit: (event: PiBridgeEvent) => void): Promise<void> {
    const binding = this.resolveBinding(sessionKey)
    if (!binding) return
    await binding.session.abort()
    emit({ type: 'run_aborted', sessionId: binding.sessionId })
  }

  async compact(sessionKey: string, customInstructions?: string): Promise<unknown> {
    const binding = this.requireBinding(sessionKey)
    const session = binding.session as AgentSession & {
      compact?: (customInstructions?: string) => Promise<unknown>
    }
    if (typeof session.compact !== 'function') {
      throw new Error('Pi runtime compact is not available for this session')
    }
    return session.compact(customInstructions)
  }

  async getTools(sessionKey: string): Promise<Array<{ name: string; description: string; active: boolean; source?: string }>> {
    const binding = this.requireBinding(sessionKey)
    const session = binding.session as AgentSession & {
      getAllTools?: () => Array<{ name: string; description?: string; sourceInfo?: unknown }>
      getActiveToolNames?: () => string[]
    }
    if (typeof session.getAllTools !== 'function') return []

    const activeNames = typeof session.getActiveToolNames === 'function'
      ? new Set(session.getActiveToolNames())
      : new Set<string>()
    return session.getAllTools().map((tool) => ({
      name: tool.name,
      description: tool.description || '',
      active: activeNames.has(tool.name),
      source: this.sourceFromInfo(tool.sourceInfo),
    }))
  }

  async setTools(sessionKey: string, toolNames: string[]): Promise<void> {
    const binding = this.requireBinding(sessionKey)
    const session = binding.session as AgentSession & {
      setActiveToolsByName?: (toolNames: string[]) => Promise<void> | void
    }
    if (typeof session.setActiveToolsByName !== 'function') {
      throw new Error('Pi runtime tool selection is not available for this session')
    }
    await session.setActiveToolsByName(toolNames)
  }

  async steer(sessionKey: string, message: string): Promise<void> {
    const binding = this.requireBinding(sessionKey)
    const session = binding.session as AgentSession & {
      steer?: (message: string) => Promise<void> | void
    }
    if (typeof session.steer !== 'function') {
      throw new Error('Pi runtime steering is not available for this session')
    }
    await session.steer(message)
  }

  async followUp(sessionKey: string, message: string): Promise<void> {
    const binding = this.requireBinding(sessionKey)
    const session = binding.session as AgentSession & {
      followUp?: (message: string) => Promise<void> | void
    }
    if (typeof session.followUp !== 'function') {
      throw new Error('Pi runtime follow-up is not available for this session')
    }
    await session.followUp(message)
  }

  async reloadResources(sessionKey: string): Promise<void> {
    const binding = this.requireBinding(sessionKey)
    if (!binding.resourceLoader) {
      throw new Error('No Pi resource loader is bound to this session')
    }
    await binding.resourceLoader.reload()
  }

  async dispose(): Promise<void> {
    for (const binding of Array.from(this.bindings.values())) {
      binding.unsubscribe?.()
      binding.session.dispose()
    }
    this.bindings.clear()
  }

  private async ensureSession(
    sessionId: string,
    sessionPath: string,
    modelKey: string | undefined,
    thinkingLevel: string | undefined,
    emit: (event: PiBridgeEvent) => void,
  ): Promise<SessionBinding> {
    const existing = this.bindings.get(sessionPath)
    if (
      existing
      && existing.modelKey === modelKey
      && existing.thinkingLevel === thinkingLevel
    ) {
      return existing
    }
    if (existing) {
      existing.unsubscribe?.()
      existing.session.dispose()
      this.bindings.delete(sessionPath)
    }

    const sessionDetails = await openPiSession(sessionPath)
    const cwd = resolveRuntimeDirectory(sessionDetails.cwd, this.getWorkingDirectory())
    const resolved = this.resolveModel(modelKey)
    if (!resolved) {
      throw new Error('No configured Pi model available')
    }

    const { AuthStorage, createAgentSession, ModelRegistry, SessionManager } =
      await loadPiCodingAgentModule()
    const authStorage = AuthStorage.create()
    if (resolved.apiKey) {
      authStorage.setRuntimeApiKey(resolved.provider.providerId, resolved.apiKey)
    }

    const modelRegistry = ModelRegistry.create(authStorage)
    const runtimeModel =
      modelRegistry.find(resolved.provider.providerId, resolved.modelConfig.id)
      || getModel(resolved.provider.providerId as any, resolved.modelConfig.id as any)
    const resourceLoader = await createPiResourceLoader(cwd)
    const { session } = await createAgentSession({
      cwd,
      model: runtimeModel,
      thinkingLevel: (thinkingLevel as any) || undefined,
      authStorage,
      modelRegistry,
      sessionManager: SessionManager.open(sessionPath),
      resourceLoader,
    })

    const unsubscribe = session.subscribe((event) => {
      this.forwardEvent(sessionId, event, emit)
    })

    const binding: SessionBinding = {
      sessionId,
      session,
      resourceLoader,
      unsubscribe,
      cwd,
      modelKey,
      thinkingLevel,
      sessionPath,
    }
    this.bindings.set(sessionPath, binding)
    return binding
  }

  private forwardEvent(
    sessionId: string,
    event: AgentSessionEvent,
    emit: (event: PiBridgeEvent) => void,
  ): void {
    switch (event.type) {
      case 'message_update':
        if (event.assistantMessageEvent.type === 'text_delta') {
          emit({ type: 'assistant_token', sessionId, text: event.assistantMessageEvent.delta })
        } else if (event.assistantMessageEvent.type === 'thinking_delta') {
          emit({ type: 'assistant_thinking', sessionId, text: event.assistantMessageEvent.delta })
        }
        break
      case 'message_end':
        if (event.message.role === 'assistant') {
          const text = Array.isArray(event.message.content)
            ? event.message.content
                .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
                .map((part) => part.text || '')
                .join('')
            : ''
          emit({ type: 'assistant_message', sessionId, text })
        }
        break
      case 'tool_execution_start':
        emit({
          type: 'tool_started',
          sessionId,
          toolName: event.toolName,
          args: event.args,
        })
        break
      case 'tool_execution_end':
        emit({
          type: event.isError ? 'tool_failed' : 'tool_finished',
          sessionId,
          toolName: event.toolName,
        })
        break
      default:
        break
    }
  }

  private getWorkingDirectory(): string {
    const configured = getConfigValue('workingDirectory')
    const defaultSessionDirectory = getConfigValue('defaultSessionDirectory')
    return resolveOptionalExistingDirectory(typeof configured === 'string' ? configured : null)
      || (typeof defaultSessionDirectory === 'string' && defaultSessionDirectory.trim())
      || join(homedir(), 'Pi-Desktop-Session')
  }

  private resolveBinding(sessionKey: string): SessionBinding | undefined {
    return this.bindings.get(sessionKey)
      || Array.from(this.bindings.values()).find((entry) => entry.sessionPath === sessionKey || entry.sessionId === sessionKey)
  }

  private requireBinding(sessionKey: string): SessionBinding {
    const binding = this.resolveBinding(sessionKey)
    if (!binding) {
      throw new Error('No active Pi runtime session is available for this command')
    }
    return binding
  }

  private sourceFromInfo(sourceInfo: unknown): string | undefined {
    if (!sourceInfo) return undefined
    if (typeof sourceInfo === 'string') return sourceInfo
    if (typeof sourceInfo === 'object') {
      const record = sourceInfo as Record<string, unknown>
      const value = record.source || record.name || record.path
      return typeof value === 'string' ? value : undefined
    }
    return undefined
  }

  private snapshotFiles(cwd: string): Map<string, number> {
    const files = new Map<string, number>()
    for (const file of this.listArtifactCandidateFiles(cwd)) {
      try {
        files.set(file, statSync(file).mtimeMs)
      } catch {
        // Skip unreadable entries.
      }
    }
    return files
  }

  private detectArtifacts(cwd: string, beforeFiles: Map<string, number>): string[] {
    const recent: string[] = []
    for (const fullPath of this.listArtifactCandidateFiles(cwd)) {
      try {
        const stat = statSync(fullPath)
        const previousMtime = beforeFiles.get(fullPath)
        if (previousMtime === undefined || stat.mtimeMs > previousMtime) {
          recent.push(fullPath)
        }
      } catch {
        // Skip unreadable entries.
      }
    }

    return recent.slice(0, 5)
  }

  private listArtifactCandidateFiles(cwd: string): string[] {
    const files: string[] = []
    const ignoredDirectories = new Set([
      '.git',
      '.next',
      '.nuxt',
      '.cache',
      '.turbo',
      '.vite',
      'coverage',
      'node_modules',
      'out',
      'dist',
      'build',
      'release',
      '.run-logs',
    ])
    const visit = (dir: string, depth: number): void => {
      if (depth > ARTIFACT_SCAN_MAX_DEPTH || files.length >= ARTIFACT_SCAN_MAX_FILES) return
      let entries: string[]
      try {
        entries = readdirSync(dir)
      } catch {
        return
      }

      for (const name of entries) {
        if (files.length >= ARTIFACT_SCAN_MAX_FILES) return
        const fullPath = join(dir, name)
        try {
          const stat = statSync(fullPath)
          if (stat.isDirectory()) {
            if (!ignoredDirectories.has(name)) {
              visit(fullPath, depth + 1)
            }
            continue
          }
          if (stat.isFile() && this.isArtifactCandidate(fullPath)) {
            files.push(fullPath)
          }
        } catch {
          // Skip unreadable entries.
        }
      }
    }

    visit(cwd, 0)
    return files
  }

  private isArtifactCandidate(path: string): boolean {
    return ['.md', '.txt', '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.pptm', '.csv', '.xlsx', '.html', '.htm'].includes(
      extname(path).toLowerCase(),
    )
  }

  private resolveModel(modelKey?: string): ResolvedRuntimeModel | null {
    const matched = modelKey ? getProviderByModelKey(modelKey) : null
    if (modelKey && !matched) {
      throw new Error(`Configured Pi model is unavailable: ${modelKey}`)
    }

    const provider = matched?.provider || getDefaultProvider()
    const modelConfig = matched?.model || (provider ? getDefaultModel(provider) : null)

    if (!provider || !modelConfig) return null

    const apiKey = getDecryptedApiKey(provider.id) || undefined

    return {
      provider,
      modelConfig,
      apiKey,
    }
  }
}

export const piBridge = new PiBridge()
