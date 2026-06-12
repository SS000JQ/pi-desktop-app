import { existsSync, mkdirSync, statSync } from 'fs'
import { homedir } from 'os'
import { isAbsolute, join, relative, resolve } from 'path'

function isDirectory(path: string): boolean {
  try {
    return existsSync(path) && statSync(path).isDirectory()
  } catch {
    return false
  }
}

export function repairUserHomePath(path: string): string {
  if (!path || isDirectory(path)) return path

  const home = homedir()
  const homeParts = home.split(/[\\/]/).filter(Boolean)
  const pathParts = path.split(/[\\/]/).filter(Boolean)
  if (homeParts.length < 3 || pathParts.length < 3) return path

  const sameDrive = homeParts[0].toLowerCase() === pathParts[0].toLowerCase()
  const sameUsersRoot = homeParts[1].toLowerCase() === pathParts[1].toLowerCase()
  if (!sameDrive || !sameUsersRoot) return path

  const candidate = join(home, ...pathParts.slice(3))
  return isDirectory(candidate) ? candidate : path
}

export function resolveExistingDirectory(path: string | null | undefined, fallback: string): string {
  const candidate = repairUserHomePath(path?.trim() || '')
  if (candidate && isDirectory(candidate)) return candidate
  return isDirectory(fallback) ? fallback : process.cwd()
}

export function resolveOptionalExistingDirectory(path: string | null | undefined): string | null {
  const candidate = repairUserHomePath(path?.trim() || '')
  return candidate && isDirectory(candidate) ? candidate : null
}

function ensureDirectory(path: string): string | null {
  try {
    if (!isDirectory(path)) {
      mkdirSync(path, { recursive: true })
    }
    return isDirectory(path) ? path : null
  } catch {
    return null
  }
}

export function resolveRuntimeDirectory(path: string | null | undefined, fallback: string): string {
  const candidate = resolveOptionalExistingDirectory(path)
  if (candidate) return candidate

  const fallbackCandidate = repairUserHomePath(fallback)
  return ensureDirectory(fallbackCandidate) || homedir()
}

export function isPathInsideAllowedRoots(path: string, allowedRoots: Array<string | null | undefined>): boolean {
  const trimmedPath = path.trim()
  if (!trimmedPath || !isAbsolute(trimmedPath)) return false

  const resolvedPath = resolve(trimmedPath)
  return allowedRoots.some((root) => {
    const trimmedRoot = root?.trim()
    if (!trimmedRoot || !isAbsolute(trimmedRoot)) return false

    const resolvedRoot = resolve(trimmedRoot)
    const relation = relative(resolvedRoot, resolvedPath)
    return relation === '' || (!relation.startsWith('..') && !isAbsolute(relation))
  })
}
