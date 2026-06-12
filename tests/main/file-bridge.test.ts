import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'

import { openInExternalEditor } from '../../src/main/file-bridge'

describe('openInExternalEditor', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop()
      if (dir) rmSync(dir, { recursive: true, force: true })
    }
  })

  it('treats shell.openPath error strings as failed opens', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'pi-open-file-'))
    tempDirs.push(tempDir)
    const filePath = join(tempDir, 'report.pptx')
    writeFileSync(filePath, 'fake pptx')

    await expect(
      openInExternalEditor(filePath, {
        openPath: async () => 'No application is associated with the specified file for this operation.',
        openExternal: async () => undefined,
      }),
    ).rejects.toThrow('No application is associated')
  })
})
