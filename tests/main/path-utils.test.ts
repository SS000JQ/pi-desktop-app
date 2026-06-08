import { describe, expect, it } from 'vitest'
import { join } from 'path'
import { homedir } from 'os'
import { repairUserHomePath, resolveExistingDirectory, resolveOptionalExistingDirectory } from '../../src/main/path-utils'

describe('path-utils', () => {
  it('repairs mojibake Windows user home paths when the equivalent real home path exists', () => {
    const repaired = repairUserHomePath('C:\\Users\\瀹嬫睙榻怽\\Downloads')

    expect(repaired).toBe(join(homedir(), 'Downloads'))
  })

  it('falls back when a directory does not exist after repair', () => {
    const fallback = process.cwd()

    expect(resolveExistingDirectory('C:\\Users\\瀹嬫睙榻怽\\definitely-missing-folder', fallback)).toBe(fallback)
  })
  it('returns null for a missing optional working directory instead of falling back to the app cwd', () => {
    expect(resolveOptionalExistingDirectory('Z:\\definitely\\missing\\pi-desktop-workspace')).toBeNull()
    expect(resolveOptionalExistingDirectory(null)).toBeNull()
  })
})
