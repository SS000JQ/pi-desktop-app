import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join, basename, extname } from 'path'
import { homedir } from 'os'

export type ArtifactStatus = 'draft' | 'ready' | 'failed' | 'refreshing'
export type ArtifactType = 'report' | 'summary' | 'table' | 'slides' | 'tracker' | 'brief' | 'file'
export type ArtifactSourceKind = 'local_file' | 'pi_generated' | 'manual'

export interface ArtifactVersionRecord {
  id: string
  artifactId: string
  createdAt: string
  summary: string
  sourcePath?: string
  snapshot?: string
}

export interface ArtifactRecord {
  id: string
  sessionId: string
  title: string
  artifactType: ArtifactType
  sourceKind: ArtifactSourceKind
  status: ArtifactStatus
  createdAt: string
  updatedAt: string
  sourcePath?: string
  snapshot?: string
  metadata: {
    pinned?: boolean
    primary?: boolean
    actionLabel?: string
    errorSummary?: string
  }
  versions: ArtifactVersionRecord[]
}

interface ArtifactStoreFile {
  artifacts: ArtifactRecord[]
}

const artifactStorePath = join(homedir(), 'AppData', 'Roaming', 'pi-desktop', 'pi-desktop', 'artifacts.json')

function ensureArtifactStoreDir(): void {
  mkdirSync(dirname(artifactStorePath), { recursive: true })
}

function readStore(): ArtifactStoreFile {
  ensureArtifactStoreDir()
  if (!existsSync(artifactStorePath)) {
    return { artifacts: [] }
  }

  try {
    const raw = readFileSync(artifactStorePath, 'utf-8')
    const parsed = JSON.parse(raw) as ArtifactStoreFile
    return {
      artifacts: Array.isArray(parsed.artifacts) ? parsed.artifacts : [],
    }
  } catch {
    return { artifacts: [] }
  }
}

function writeStore(store: ArtifactStoreFile): void {
  ensureArtifactStoreDir()
  writeFileSync(artifactStorePath, JSON.stringify(store, null, 2), 'utf-8')
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function detectArtifactType(path?: string): ArtifactType {
  const ext = extname(path || '').toLowerCase()
  if (ext === '.md') return 'report'
  if (ext === '.csv' || ext === '.xlsx') return 'table'
  if (ext === '.ppt' || ext === '.pptx') return 'slides'
  if (ext === '.txt') return 'summary'
  return 'file'
}

function summarizeArtifact(type: ArtifactType, title: string, status: ArtifactStatus): string {
  if (status === 'failed') return `Failed to update ${title}`
  switch (type) {
    case 'report':
      return `Updated report ${title}`
    case 'summary':
      return `Updated summary ${title}`
    case 'table':
      return `Updated table ${title}`
    case 'slides':
      return `Updated slides ${title}`
    case 'tracker':
      return `Updated tracker ${title}`
    case 'brief':
      return `Updated brief ${title}`
    default:
      return `Updated file ${title}`
  }
}

export function listArtifacts(sessionId?: string): ArtifactRecord[] {
  const store = readStore()
  const filtered = sessionId
    ? store.artifacts.filter((artifact) => artifact.sessionId === sessionId)
    : store.artifacts
  return [...filtered].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

export function getArtifact(artifactId: string): ArtifactRecord | null {
  return readStore().artifacts.find((artifact) => artifact.id === artifactId) || null
}

export function upsertArtifactFromPath(input: {
  sessionId: string
  path: string
  status: ArtifactStatus
  sourceKind?: ArtifactSourceKind
  snapshot?: string
  errorSummary?: string
}): ArtifactRecord {
  const store = readStore()
  const now = new Date().toISOString()
  const title = basename(input.path)
  const artifactType = detectArtifactType(input.path)
  const existing = store.artifacts.find(
    (artifact) => artifact.sessionId === input.sessionId && artifact.sourcePath === input.path,
  )

  if (existing) {
    existing.status = input.status
    existing.updatedAt = now
    existing.snapshot = input.snapshot ?? existing.snapshot
    existing.metadata = {
      ...existing.metadata,
      errorSummary: input.errorSummary,
      actionLabel: summarizeArtifact(artifactType, title, input.status),
    }
    existing.versions.unshift({
      id: generateId('artifact-version'),
      artifactId: existing.id,
      createdAt: now,
      summary: summarizeArtifact(artifactType, title, input.status),
      sourcePath: input.path,
      snapshot: input.snapshot,
    })
    writeStore(store)
    return existing
  }

  const artifact: ArtifactRecord = {
    id: generateId('artifact'),
    sessionId: input.sessionId,
    title,
    artifactType,
    sourceKind: input.sourceKind || 'pi_generated',
    status: input.status,
    createdAt: now,
    updatedAt: now,
    sourcePath: input.path,
    snapshot: input.snapshot,
    metadata: {
      pinned: false,
      primary: false,
      actionLabel: summarizeArtifact(artifactType, title, input.status),
      errorSummary: input.errorSummary,
    },
    versions: [
      {
        id: generateId('artifact-version'),
        artifactId: '',
        createdAt: now,
        summary: summarizeArtifact(artifactType, title, input.status),
        sourcePath: input.path,
        snapshot: input.snapshot,
      },
    ],
  }
  artifact.versions[0].artifactId = artifact.id
  store.artifacts.push(artifact)
  writeStore(store)
  return artifact
}

export function pinArtifact(artifactId: string, pinned: boolean): ArtifactRecord | null {
  const store = readStore()
  const artifact = store.artifacts.find((entry) => entry.id === artifactId)
  if (!artifact) return null
  artifact.metadata = {
    ...artifact.metadata,
    pinned,
  }
  artifact.updatedAt = new Date().toISOString()
  writeStore(store)
  return artifact
}

export function markArtifactPrimary(artifactId: string): ArtifactRecord | null {
  const store = readStore()
  const artifact = store.artifacts.find((entry) => entry.id === artifactId)
  if (!artifact) return null
  for (const entry of store.artifacts) {
    if (entry.sessionId === artifact.sessionId) {
      entry.metadata = {
        ...entry.metadata,
        primary: entry.id === artifactId,
      }
    }
  }
  artifact.updatedAt = new Date().toISOString()
  writeStore(store)
  return artifact
}

export function recordManualArtifactView(input: {
  sessionId: string
  path: string
  snapshot?: string
}): ArtifactRecord {
  return upsertArtifactFromPath({
    sessionId: input.sessionId,
    path: input.path,
    status: 'ready',
    sourceKind: 'manual',
    snapshot: input.snapshot,
  })
}

export function artifactHistory(artifactId: string): ArtifactVersionRecord[] {
  return getArtifact(artifactId)?.versions || []
}

export function refreshArtifact(artifactId: string): ArtifactRecord | null {
  const store = readStore()
  const artifact = store.artifacts.find((entry) => entry.id === artifactId)
  if (!artifact) return null
  artifact.status = 'refreshing'
  artifact.updatedAt = new Date().toISOString()
  writeStore(store)
  return artifact
}
