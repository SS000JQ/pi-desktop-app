import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'

import { isPathInsideAllowedRoots } from '../../src/main/path-utils'
import { listWorkspaceDirectory } from '../../src/main/workspace-files'

describe('file IPC path boundaries', () => {
  const tempRoots: string[] = []

  afterEach(() => {
    while (tempRoots.length > 0) {
      const root = tempRoots.pop()
      if (root) rmSync(root, { recursive: true, force: true })
    }
  })

  it('allows paths inside configured roots', () => {
    expect(isPathInsideAllowedRoots('D:/work/project/report.md', ['D:/work/project'])).toBe(true)
    expect(isPathInsideAllowedRoots('D:/work/project', ['D:/work/project'])).toBe(true)
  })

  it('rejects sibling paths with a shared prefix', () => {
    expect(isPathInsideAllowedRoots('D:/work/project-secret/report.md', ['D:/work/project'])).toBe(false)
  })

  it('rejects empty paths and paths outside configured roots', () => {
    expect(isPathInsideAllowedRoots('', ['D:/work/project'])).toBe(false)
    expect(isPathInsideAllowedRoots('C:/Users/Alice/.ssh/id_rsa', ['D:/work/project'])).toBe(false)
  })

  it('bounds large workspace directory listings', () => {
    const root = mkdtempSync(join(tmpdir(), 'pi-workspace-large-'))
    tempRoots.push(root)
    mkdirSync(join(root, 'folder'))
    for (let index = 0; index < 5; index += 1) {
      writeFileSync(join(root, `file-${index}.txt`), 'x')
    }

    const result = listWorkspaceDirectory(root, { maxEntries: 3 })

    expect(result.entries).toHaveLength(3)
    expect(result.truncated).toBe(true)
    expect(result.totalEntries).toBe(6)
  })
})
