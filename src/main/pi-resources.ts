import { homedir } from 'os'
import { join } from 'path'
import { getCliAgentPaths } from './providers'
import { loadPiCodingAgentModule } from './pi-sdk'
import type {
  DefaultResourceLoader,
  ResourceLoader,
  ResourceDiagnostic,
} from '@earendil-works/pi-coding-agent'

export type SlashCommandKind = 'desktop' | 'pi_runtime' | 'skill' | 'prompt' | 'extension' | 'context' | 'unsupported'
export type SlashCommandExecution = 'desktop' | 'runtime' | 'prompt' | 'disabled'
export type SlashCommandGroup = 'Desktop' | 'Pi Runtime' | 'Skills' | 'Prompts' | 'Extensions' | 'Context' | 'Unsupported'
export type PiResourceStatus = 'active' | 'inactive' | 'error'
export type PiResourceScope = 'global' | 'project' | 'settings' | 'package' | 'other'

export interface PiSkillResource {
  name: string
  description: string
  source: string
  filePath: string
  baseDir: string
  scope: PiResourceScope
  disableModelInvocation: boolean
  status: PiResourceStatus
  diagnostics?: string[]
}

export interface PiPromptResource {
  name: string
  description: string
  source: string
  argumentHint?: string
}

export interface PiExtensionResource {
  name: string
  source: string
  status: PiResourceStatus
  diagnostics?: string[]
}

export interface PiExtensionCommandResource {
  name: string
  description: string
  source: string
}

export interface PiResourcesResult {
  skills: PiSkillResource[]
  prompts: PiPromptResource[]
  extensions: PiExtensionResource[]
  extensionCommands: PiExtensionCommandResource[]
  diagnostics: string[]
}

export interface SlashCommand {
  id: string
  command: string
  label: string
  description: string
  kind: SlashCommandKind
  source: string
  execution: SlashCommandExecution
  group?: SlashCommandGroup
  argumentHint?: string
  requiresIdle?: boolean
  disabledReason?: string
}

type ResourceLoaderLike = Pick<DefaultResourceLoader, 'reload' | 'getSkills' | 'getPrompts' | 'getExtensions'>

interface BuildPiResourcesOptions {
  cwd?: string | null
  agentDir?: string
  createLoader?: () => ResourceLoaderLike
}

const DESKTOP_COMMANDS: SlashCommand[] = [
  {
    id: 'desktop:new',
    command: '/new',
    label: 'New session',
    description: 'Create a new Pi session',
    kind: 'desktop',
    source: 'Pi Desktop',
    execution: 'desktop',
    group: 'Desktop',
  },
  {
    id: 'desktop:settings',
    command: '/settings',
    label: 'Settings',
    description: 'Open Pi Desktop settings',
    kind: 'desktop',
    source: 'Pi Desktop',
    execution: 'desktop',
    group: 'Desktop',
  },
  {
    id: 'desktop:model',
    command: '/model',
    label: 'Model',
    description: 'Open model selection',
    kind: 'desktop',
    source: 'Pi Desktop',
    execution: 'desktop',
    group: 'Desktop',
  },
  {
    id: 'desktop:skills',
    command: '/skills',
    label: 'Skills',
    description: 'Open discovered Pi resources',
    kind: 'desktop',
    source: 'Pi Desktop',
    execution: 'desktop',
    group: 'Desktop',
  },
  {
    id: 'desktop:workspace',
    command: '/workspace',
    label: 'Workspace',
    description: 'Choose or inspect the current workspace',
    kind: 'desktop',
    source: 'Pi Desktop',
    execution: 'desktop',
    group: 'Desktop',
  },
  {
    id: 'desktop:tools',
    command: '/tools',
    label: 'Tools',
    description: 'Open Pi runtime tool controls',
    kind: 'desktop',
    source: 'Pi Desktop',
    execution: 'desktop',
    group: 'Desktop',
  },
  {
    id: 'desktop:help',
    command: '/help',
    label: 'Help',
    description: 'Show common Pi Desktop commands',
    kind: 'desktop',
    source: 'Pi Desktop',
    execution: 'desktop',
    group: 'Desktop',
  },
]

const PI_RUNTIME_COMMANDS: SlashCommand[] = [
  {
    id: 'runtime:compact',
    command: '/compact',
    label: 'Compact',
    description: 'Compact older context, optionally with custom instructions',
    kind: 'pi_runtime',
    source: 'Pi',
    execution: 'runtime',
    group: 'Pi Runtime',
    requiresIdle: true,
  },
  {
    id: 'runtime:reload',
    command: '/reload',
    label: 'Reload',
    description: 'Reload keybindings, extensions, skills, prompts, and context files',
    kind: 'pi_runtime',
    source: 'Pi',
    execution: 'runtime',
    group: 'Pi Runtime',
    requiresIdle: true,
  },
  {
    id: 'runtime:session',
    command: '/session',
    label: 'Session',
    description: 'Show the current session file and ID',
    kind: 'pi_runtime',
    source: 'Pi',
    execution: 'runtime',
    group: 'Pi Runtime',
  },
]

const UNSUPPORTED_COMMANDS: SlashCommand[] = ([
  ['/login', 'Login', 'Manage OAuth credentials'],
  ['/logout', 'Logout', 'Remove or switch credentials'],
  ['/scoped-models', 'Scoped models', 'Configure scoped model routing'],
  ['/export', 'Export', 'Export a session'],
  ['/import', 'Import', 'Import a session'],
  ['/share', 'Share', 'Share a session'],
  ['/copy', 'Copy', 'Copy session content'],
  ['/name', 'Name', 'Rename a session'],
  ['/changelog', 'Changelog', 'Show Pi changelog'],
  ['/hotkeys', 'Hotkeys', 'Show Pi hotkeys'],
  ['/clone', 'Clone', 'Duplicate the current active branch into a new session file'],
  ['/trust', 'Trust', 'Save a project trust decision for future sessions'],
  ['/fork', 'Fork', 'Fork the current session'],
  ['/tree', 'Tree', 'Show session branch tree'],
  ['/resume', 'Resume', 'Resume a session'],
  ['/quit', 'Quit', 'Quit Pi'],
] as const).map(([command, label, description]) => ({
  id: `unsupported:${command.slice(1)}`,
  command,
  label,
  description,
  kind: 'unsupported' as const,
  source: 'Pi',
  execution: 'disabled' as const,
  group: 'Unsupported' as const,
  disabledReason: 'Not implemented in Pi Desktop yet. Use the Pi CLI for this command for now.',
}))

function diagnosticToString(diagnostic: unknown): string {
  if (!diagnostic) return ''
  if (typeof diagnostic === 'string') return diagnostic
  if (diagnostic instanceof Error) return diagnostic.message
  if (typeof diagnostic === 'object') {
    const record = diagnostic as Record<string, unknown>
    return String(record.message || record.detail || record.reason || JSON.stringify(record))
  }
  return String(diagnostic)
}

function sourcePathFromInfo(sourceInfo: unknown, fallback = 'Pi resource loader'): string {
  if (sourceInfo && typeof sourceInfo === 'object') {
    const record = sourceInfo as Record<string, unknown>
    const value = record.path || record.filePath || record.source || record.name
    if (typeof value === 'string' && value.trim()) return value
  }
  return fallback
}

function parentDirectory(filePath: string): string {
  return filePath.replace(/[\\/][^\\/]*$/, '')
}

function scopeFromInfo(sourceInfo: unknown, filePath: string): PiResourceScope {
  const sourceText = [
    typeof filePath === 'string' ? filePath : '',
    sourceInfo && typeof sourceInfo === 'object' ? JSON.stringify(sourceInfo) : '',
  ].join(' ').toLowerCase()

  if (sourceText.includes('"user"') || sourceText.includes('"global"') || sourceText.includes('/.pi/agent/') || sourceText.includes('\\.pi\\agent\\')) {
    return 'global'
  }
  if (sourceText.includes('"project"') || sourceText.includes('/.pi/skills') || sourceText.includes('\\.pi\\skills')) {
    return 'project'
  }
  if (sourceText.includes('"package"') || sourceText.includes('node_modules')) {
    return 'package'
  }
  if (sourceText.includes('"settings"')) {
    return 'settings'
  }
  return 'other'
}

function normalizeCommandName(name: unknown): string | null {
  if (typeof name !== 'string') return null
  const trimmed = name.trim().replace(/^\/+/, '')
  return trimmed ? trimmed : null
}

export async function buildPiResources(options: BuildPiResourcesOptions = {}): Promise<PiResourcesResult> {
  const diagnostics: string[] = []
  try {
    const loader = options.createLoader ? options.createLoader() : await createDefaultResourceLoader(options)
    await loader.reload()

    const skillResult = loader.getSkills()
    const promptResult = loader.getPrompts()
    const extensionResult = loader.getExtensions()
    const extensionErrors = Array.isArray((extensionResult as any).errors) ? (extensionResult as any).errors : []

    diagnostics.push(
      ...((skillResult.diagnostics || []) as ResourceDiagnostic[]).map(diagnosticToString).filter(Boolean),
      ...((promptResult.diagnostics || []) as ResourceDiagnostic[]).map(diagnosticToString).filter(Boolean),
      ...extensionErrors.map(diagnosticToString).filter(Boolean),
    )

    const extensionCommands = getExtensionCommands(extensionResult)

    return {
      skills: (skillResult.skills || []).map((skill: any) => {
        const filePath = String(skill.filePath || sourcePathFromInfo(skill.sourceInfo))
        const baseDir = String(skill.baseDir || parentDirectory(filePath))
        return {
          name: String(skill.name || ''),
          description: String(skill.description || ''),
          source: filePath,
          filePath,
          baseDir,
          scope: scopeFromInfo(skill.sourceInfo, filePath),
          disableModelInvocation: Boolean(skill.disableModelInvocation),
          status: 'active',
          diagnostics: Array.isArray(skill.diagnostics)
            ? skill.diagnostics.map(diagnosticToString).filter(Boolean)
            : undefined,
        }
      }),
      prompts: (promptResult.prompts || []).map((prompt: any) => ({
        name: String(prompt.name || ''),
        description: String(prompt.description || ''),
        source: String(prompt.filePath || sourcePathFromInfo(prompt.sourceInfo)),
        argumentHint: typeof prompt.argumentHint === 'string' ? prompt.argumentHint : undefined,
      })),
      extensions: ((extensionResult as any).extensions || []).map((extension: any, index: number) => ({
        name: String(extension.name || extension.id || `extension-${index + 1}`),
        source: sourcePathFromInfo(extension.sourceInfo, extension.path || 'Pi extension'),
        status: 'active',
      })),
      extensionCommands,
      diagnostics,
    }
  } catch (error) {
    return {
      skills: [],
      prompts: [],
      extensions: [],
      extensionCommands: [],
      diagnostics: [error instanceof Error ? error.message : 'Failed to load Pi resources'],
    }
  }
}

export async function createPiResourceLoader(cwd?: string | null, agentDirOverride?: string): Promise<ResourceLoader> {
  const { DefaultResourceLoader, getAgentDir } = await loadPiCodingAgentModule()
  const agentDir = agentDirOverride || getAgentDir?.() || getCliAgentPaths().agentDir
  return new DefaultResourceLoader({
    cwd: cwd || join(homedir(), 'Pi-Desktop-Session'),
    agentDir,
  })
}

async function createDefaultResourceLoader(options: BuildPiResourcesOptions): Promise<ResourceLoaderLike> {
  return createPiResourceLoader(options.cwd, options.agentDir)
}

function getExtensionCommands(extensionResult: unknown): PiExtensionCommandResource[] {
  const runtime = extensionResult && typeof extensionResult === 'object'
    ? (extensionResult as Record<string, unknown>).runtime
    : null
  const getCommands = runtime && typeof runtime === 'object'
    ? (runtime as Record<string, unknown>).getCommands
    : null
  if (typeof getCommands !== 'function') return []

  try {
    const commands = getCommands.call(runtime)
    if (!Array.isArray(commands)) return []
    return commands
      .map((command) => {
        const record = command as Record<string, unknown>
        const name = normalizeCommandName(record.name)
        if (!name) return null
        return {
          name,
          description: String(record.description || ''),
          source: sourcePathFromInfo(record.sourceInfo, 'extension'),
        }
      })
      .filter((command): command is PiExtensionCommandResource => Boolean(command))
  } catch {
    return []
  }
}

export function buildSlashCommands(resources: PiResourcesResult): SlashCommand[] {
  const commands = [
    ...DESKTOP_COMMANDS,
    ...PI_RUNTIME_COMMANDS,
    ...resources.skills.map((skill): SlashCommand => ({
      id: `skill:${skill.name}`,
      command: `/skill:${skill.name}`,
      label: skill.name,
      description: skill.description || 'Invoke this Pi skill explicitly',
      kind: 'skill',
      source: skill.source,
      execution: 'prompt',
      group: 'Skills',
    })),
    ...resources.prompts.map((prompt): SlashCommand => ({
      id: `prompt:${prompt.name}`,
      command: `/${prompt.name}`,
      label: prompt.name,
      description: prompt.description || 'Expand this prompt template',
      kind: 'prompt',
      source: prompt.source,
      execution: 'prompt',
      group: 'Prompts',
      argumentHint: prompt.argumentHint,
    })),
    ...resources.extensionCommands.map((command): SlashCommand => ({
      id: `extension:${command.name}`,
      command: `/${command.name}`,
      label: command.name,
      description: command.description || 'Run this extension command',
      kind: 'extension',
      source: command.source,
      execution: 'prompt',
      group: 'Extensions',
      requiresIdle: true,
    })),
    ...UNSUPPORTED_COMMANDS,
    {
      id: 'context:file',
      command: '@',
      label: 'File reference',
      description: 'Search workspace files and insert an @file reference',
      kind: 'context' as const,
      source: 'Pi Desktop',
      execution: 'desktop' as const,
      group: 'Context' as const,
    },
  ]

  const seen = new Set<string>()
  return commands.filter((command) => {
    const key = command.command.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export async function getPiResources(cwd?: string | null): Promise<PiResourcesResult> {
  return buildPiResources({ cwd })
}

export async function getSlashCommands(cwd?: string | null): Promise<SlashCommand[]> {
  return buildSlashCommands(await getPiResources(cwd))
}
