import { readFileSync, appendFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

const SESSIONS_DIR = join(app.getPath('userData'), 'pi-desktop', 'sessions')

export function ensureSessionsDir(): void {
  mkdirSync(SESSIONS_DIR, { recursive: true })
}

export function appendMessage(sessionId: string, message: unknown): void {
  const line =
    JSON.stringify({ ...(message as Record<string, unknown>), timestamp: new Date().toISOString() }) +
    '\n'
  appendFileSync(join(SESSIONS_DIR, `${sessionId}.jsonl`), line, 'utf-8')
}

export function readMessages(sessionId: string): unknown[] {
  try {
    const content = readFileSync(join(SESSIONS_DIR, `${sessionId}.jsonl`), 'utf-8').trim()
    if (!content) return []
    return content.split('\n').map((line) => JSON.parse(line))
  } catch {
    return []
  }
}

export function clearMessages(sessionId: string): void {
  writeFileSync(join(SESSIONS_DIR, `${sessionId}.jsonl`), '', 'utf-8')
}
