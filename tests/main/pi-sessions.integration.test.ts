import { afterEach, describe, expect, it } from 'vitest'
import { dirname, join } from 'path'
import { existsSync, mkdirSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { createPiSession, openPiSession } from '../../src/main/pi-sessions'

const cleanupTargets = new Set<string>()

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
}

afterEach(() => {
  for (const target of cleanupTargets) {
    try {
      rmSync(target, { recursive: true, force: true })
    } catch {
      // Best-effort cleanup for integration artifacts.
    }
  }
  cleanupTargets.clear()
})

describe('createPiSession integration', () => {
  it('persists a new session file so reopening preserves the requested cwd', async () => {
    const targetCwd = join(tmpdir(), 'pi-desktop-new-session-cwd')
    mkdirSync(targetCwd, { recursive: true })

    const created = await createPiSession(targetCwd)
    cleanupTargets.add(dirname(created.sessionPath))

    expect(existsSync(created.sessionPath)).toBe(true)

    const reopened = await openPiSession(created.sessionPath)
    expect(normalizePath(reopened.cwd)).toBe(normalizePath(targetCwd))
  }, 30000)
})
