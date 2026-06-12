import { shell } from 'electron'

import type { IpcResponse } from '../preload/api'

const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['https:', 'http:', 'mailto:'])

export type OpenExternalImpl = (url: string) => Promise<void>

export function normalizeExternalUrl(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  try {
    const parsed = new URL(trimmed)
    if (!ALLOWED_EXTERNAL_PROTOCOLS.has(parsed.protocol)) return null
    return parsed.toString()
  } catch {
    return null
  }
}

export function isAllowedExternalUrl(value: string): boolean {
  return normalizeExternalUrl(value) !== null
}

export async function openExternalUrl(
  value: string,
  openExternalImpl: OpenExternalImpl = shell.openExternal,
): Promise<IpcResponse> {
  const normalized = normalizeExternalUrl(value)
  if (!normalized) {
    return { success: false, error: 'Unsupported external URL.' }
  }

  try {
    await openExternalImpl(normalized)
    return { success: true }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}
