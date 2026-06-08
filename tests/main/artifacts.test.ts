import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'

const tempHomes: string[] = []

async function loadArtifactsModule() {
  const home = mkdtempSync(join(tmpdir(), 'pi-artifacts-home-'))
  tempHomes.push(home)
  vi.resetModules()
  vi.doMock('os', async () => {
    const actual = await vi.importActual<typeof import('os')>('os')
    return {
      ...actual,
      homedir: () => home,
    }
  })
  return import('../../src/main/artifacts')
}

describe('artifacts', () => {
  afterEach(() => {
    vi.doUnmock('os')
    vi.resetModules()
    for (const home of tempHomes.splice(0)) {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('keeps artifacts with duplicate Pi session ids separated by session path', async () => {
    const { listArtifacts, upsertArtifactFromPath } = await loadArtifactsModule()
    const firstPath = 'C:/Users/test/.pi/agent/sessions/first/session.jsonl'
    const secondPath = 'C:/Users/test/.pi/agent/sessions/second/session.jsonl'

    upsertArtifactFromPath({
      sessionId: 'duplicate-id',
      sessionPath: firstPath,
      path: 'D:/PI/first/first.md',
      status: 'ready',
    })
    upsertArtifactFromPath({
      sessionId: 'duplicate-id',
      sessionPath: secondPath,
      path: 'D:/PI/second/second.md',
      status: 'ready',
    })

    expect(listArtifacts(firstPath).map((artifact) => artifact.title)).toEqual(['first.md'])
    expect(listArtifacts(secondPath).map((artifact) => artifact.title)).toEqual(['second.md'])
  })

  it('marks primary artifacts within the matching session path only', async () => {
    const { listArtifacts, markArtifactPrimary, upsertArtifactFromPath } = await loadArtifactsModule()
    const firstPath = 'C:/Users/test/.pi/agent/sessions/first/session.jsonl'
    const secondPath = 'C:/Users/test/.pi/agent/sessions/second/session.jsonl'

    const first = upsertArtifactFromPath({
      sessionId: 'duplicate-id',
      sessionPath: firstPath,
      path: 'D:/PI/first/first.md',
      status: 'ready',
    })
    const second = upsertArtifactFromPath({
      sessionId: 'duplicate-id',
      sessionPath: secondPath,
      path: 'D:/PI/second/second.md',
      status: 'ready',
    })

    markArtifactPrimary(first.id)
    markArtifactPrimary(second.id)

    expect(listArtifacts(firstPath).find((artifact) => artifact.id === first.id)?.metadata.primary).toBe(true)
    expect(listArtifacts(secondPath).find((artifact) => artifact.id === second.id)?.metadata.primary).toBe(true)
  })
})
