import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  searchSkills,
  setSkillModelInvocation,
} from '../../src/main/skills-manager'

const tempDirs: string[] = []

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('skills manager', () => {
  it('toggles disable-model-invocation while preserving the rest of SKILL frontmatter', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pi-skill-toggle-'))
    tempDirs.push(dir)
    const filePath = join(dir, 'SKILL.md')
    writeFileSync(filePath, [
      '---',
      'name: pdf',
      'description: Read PDFs',
      'license: MIT',
      '---',
      '',
      '# PDF',
    ].join('\n'), 'utf-8')

    setSkillModelInvocation(filePath, true)
    expect(readFileSync(filePath, 'utf-8')).toContain('disable-model-invocation: true')
    expect(readFileSync(filePath, 'utf-8')).toContain('license: MIT')

    setSkillModelInvocation(filePath, false)
    expect(readFileSync(filePath, 'utf-8')).not.toContain('disable-model-invocation')
    expect(readFileSync(filePath, 'utf-8')).toContain('description: Read PDFs')
  })

  it('searches skills.sh and normalizes search results', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        skills: [
          { id: 'pdf-tools', name: 'pdf', source: 'owner/repo', installs: 1234 },
        ],
      }),
    })

    await expect(searchSkills({ query: 'pdf', fetchImpl: fetchMock as any })).resolves.toEqual([
      {
        packageName: 'owner/repo@pdf',
        name: 'pdf',
        installs: '1.2K installs',
        url: 'https://skills.sh/pdf-tools',
      },
    ])
  })
})
