import { getModel } from '@earendil-works/pi-ai'
import { readdirSync, statSync } from 'fs'
import { join } from 'path'
import { getConfigValue } from './config-store'
import { openPiSession } from './pi-sessions'
import { loadPiCodingAgentModule } from './pi-sdk'
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

export interface PiBridgeEvent {
  type:
    | 'run_started'
    | 'assistant_token'
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
  session: AgentSession
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
    const binding =
      this.bindings.get(sessionKey)
      || Array.from(this.bindings.values()).find((entry) => entry.sessionPath === sessionKey)
    if (!binding) return
    await binding.session.abort()
    emit({ type: 'run_aborted', sessionId: binding.sessionPath })
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
    const cwd = sessionDetails.cwd || this.getWorkingDirectory()
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
    const { session } = await createAgentSession({
      cwd,
      model: runtimeModel,
      thinkingLevel: (thinkingLevel as any) || undefined,
      authStorage,
      modelRegistry,
      sessionManager: SessionManager.open(sessionPath),
    })

    const unsubscribe = session.subscribe((event) => {
      this.forwardEvent(sessionId, event, emit)
    })

    const binding: SessionBinding = {
      session,
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
    return typeof configured === 'string' && configured ? configured : process.cwd()
  }

  private snapshotFiles(cwd: string): Map<string, number> {
    const files = new Map<string, number>()
    try {
      for (const name of readdirSync(cwd)) {
        const fullPath = join(cwd, name)
        try {
          const stat = statSync(fullPath)
          if (stat.isFile()) {
            files.set(fullPath, stat.mtimeMs)
          }
        } catch {
          // Skip unreadable entries.
        }
      }
    } catch {
      // Ignore unreadable cwd.
    }
    return files
  }

  private detectArtifacts(cwd: string, beforeFiles: Map<string, number>): string[] {
    const recent: string[] = []
    try {
      for (const name of readdirSync(cwd)) {
        const fullPath = join(cwd, name)
        try {
          const stat = statSync(fullPath)
          if (!stat.isFile()) continue

          const previousMtime = beforeFiles.get(fullPath)
          if (previousMtime === undefined || stat.mtimeMs > previousMtime) {
            recent.push(fullPath)
          }
        } catch {
          // Skip unreadable entries.
        }
      }
    } catch {
      return []
    }

    return recent.slice(0, 5)
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
