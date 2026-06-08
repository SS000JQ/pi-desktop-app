import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it, vi } from 'vitest'
import { PiBridge } from '../../src/main/pi-bridge'

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => join(tmpdir(), 'pi-desktop-test-user-data')),
  },
}))

describe('PiBridge artifact detection', () => {
  it('detects markdown artifacts created in nested workspace folders', () => {
    const root = mkdtempSync(join(tmpdir(), 'pi-bridge-artifacts-'))
    try {
      const bridge = new PiBridge() as any
      const before = bridge.snapshotFiles(root) as Map<string, number>
      const nested = join(root, 'reports')
      mkdirSync(nested)
      const artifactPath = join(nested, 'progress.md')
      writeFileSync(artifactPath, '# Progress\n', 'utf-8')

      expect(bridge.detectArtifacts(root, before)).toContain(artifactPath)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('detects markdown artifacts created deeper than the initial shallow scan', () => {
    const root = mkdtempSync(join(tmpdir(), 'pi-bridge-deep-artifacts-'))
    try {
      const bridge = new PiBridge() as any
      const before = bridge.snapshotFiles(root) as Map<string, number>
      const nested = ['a', 'b', 'c', 'd', 'e', 'f'].reduce((current, segment) => {
        const next = join(current, segment)
        mkdirSync(next)
        return next
      }, root)
      const artifactPath = join(nested, 'deep-report.md')
      writeFileSync(artifactPath, '# Deep Report\n', 'utf-8')

      expect(bridge.detectArtifacts(root, before)).toContain(artifactPath)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
