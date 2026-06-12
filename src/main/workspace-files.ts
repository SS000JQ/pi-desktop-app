import { readdirSync, statSync } from 'fs'
import { join } from 'path'

export interface WorkspaceDirectoryEntry {
  name: string
  path: string
  isDir: boolean
  size: number
  modifiedAt: string
}

export interface WorkspaceDirectoryListing {
  entries: WorkspaceDirectoryEntry[]
  truncated: boolean
  totalEntries: number
  maxEntries: number
}

export function listWorkspaceDirectory(dirPath: string, options: { maxEntries?: number } = {}): WorkspaceDirectoryListing {
  const maxEntries = options.maxEntries ?? 1000
  const names = readdirSync(dirPath)
  const entries = names
    .slice(0, maxEntries)
    .map((name) => {
      const fullPath = join(dirPath, name)
      try {
        const st = statSync(fullPath)
        return {
          name,
          path: fullPath,
          isDir: st.isDirectory(),
          size: st.size,
          modifiedAt: st.mtime.toISOString(),
        }
      } catch {
        return null
      }
    })
    .filter((entry): entry is WorkspaceDirectoryEntry => Boolean(entry))

  return {
    entries,
    truncated: names.length > maxEntries,
    totalEntries: names.length,
    maxEntries,
  }
}
