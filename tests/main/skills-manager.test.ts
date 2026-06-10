import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getSkillSettings,
  searchSkills,
  setAdditionalSkillPaths,
  setDisabledSkill,
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

  it('refuses to edit model invocation for paths outside discovered skills', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pi-skill-safe-toggle-'))
    tempDirs.push(dir)
    const filePath = join(dir, 'SKILL.md')
    writeFileSync(filePath, '---\nname: unsafe\n---\n# Unsafe', 'utf-8')

    expect(() => setSkillModelInvocation(filePath, true, {
      allowedSkillPaths: [join(dir, 'other', 'SKILL.md')],
    })).toThrow(/not a discovered skill/i)
  })

  it('stores disabled skills in desktop settings without modifying Pi settings', () => {
    const disabledPath = 'C:/Users/test/.agents/skills/embedded-core/SKILL.md'
    const settings = new Map<string, unknown>()

    setDisabledSkill(disabledPath, true, {
      getConfigValue: (key) => settings.get(key) as any,
      setConfigValue: (key, value) => settings.set(key, value),
      allowedSkillPaths: [disabledPath],
    })
    expect(settings.get('disabledSkillPaths')).toEqual([disabledPath])

    setDisabledSkill(disabledPath, false, {
      getConfigValue: (key) => settings.get(key) as any,
      setConfigValue: (key, value) => settings.set(key, value),
      allowedSkillPaths: [disabledPath],
    })
    expect(settings.get('disabledSkillPaths')).toEqual([])
  })

  it('updates Pi global settings skills paths while preserving other fields', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pi-skill-settings-'))
    tempDirs.push(dir)
    const settingsPath = join(dir, 'settings.json')
    const codexSkills = join(dir, 'codex-skills')
    mkdirSync(codexSkills)
    writeFileSync(settingsPath, JSON.stringify({ defaultProvider: 'openai', skills: ['old/path'] }, null, 2), 'utf-8')

    setAdditionalSkillPaths([codexSkills], {
      settingsPath,
      pathExists: () => true,
      isValidSkillPath: () => true,
    })

    const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'))
    expect(settings).toMatchObject({
      defaultProvider: 'openai',
      skills: [codexSkills],
    })
    expect(getSkillSettings({ settingsPath }).additionalSkillPaths).toEqual([codexSkills])
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
