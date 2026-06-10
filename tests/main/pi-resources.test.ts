import { describe, expect, it, vi } from 'vitest'
import { buildPiResources, buildSlashCommands } from '../../src/main/pi-resources'

describe('pi resources', () => {
  it('maps SDK skills and prompt templates into desktop resources', async () => {
    const resources = await buildPiResources({
      cwd: 'D:/project',
      createLoader: () => ({
        reload: vi.fn().mockResolvedValue(undefined),
        getSkills: () => ({
          skills: [
            {
                name: 'pdf',
                description: 'Read and create PDFs',
                filePath: 'C:/Users/test/.pi/agent/skills/pdf/SKILL.md',
                baseDir: 'C:/Users/test/.pi/agent/skills/pdf',
                disableModelInvocation: false,
                sourceInfo: { source: 'user', scope: 'user', path: 'C:/Users/test/.pi/agent/skills/pdf/SKILL.md' },
              },
            ],
          diagnostics: [],
        }),
        getPrompts: () => ({
          prompts: [
            {
              name: 'review',
              description: 'Review current changes',
              argumentHint: '[scope]',
              filePath: 'D:/project/.pi/prompts/review.md',
            },
          ],
          diagnostics: [],
        }),
        getExtensions: () => ({
          extensions: [{ name: 'git-tools', sourceInfo: { path: 'D:/project/.pi/extensions/git-tools.ts' } }],
          errors: [],
          runtime: { getCommands: () => [{ name: 'hello', description: 'Say hello' }] },
        }),
      }),
    })

    expect(resources.skills).toEqual([
      {
        name: 'pdf',
        description: 'Read and create PDFs',
        source: 'C:/Users/test/.pi/agent/skills/pdf/SKILL.md',
        filePath: 'C:/Users/test/.pi/agent/skills/pdf/SKILL.md',
        baseDir: 'C:/Users/test/.pi/agent/skills/pdf',
        scope: 'global',
        disableModelInvocation: false,
        status: 'active',
      },
    ])
    expect(resources.prompts[0]).toMatchObject({
      name: 'review',
      description: 'Review current changes',
      argumentHint: '[scope]',
      source: 'D:/project/.pi/prompts/review.md',
    })
    expect(resources.extensions[0]).toMatchObject({
      name: 'git-tools',
      source: 'D:/project/.pi/extensions/git-tools.ts',
      status: 'active',
    })
    expect(resources.extensionCommands).toEqual([
      {
        name: 'hello',
        description: 'Say hello',
        source: 'extension',
      },
    ])
  })

  it('builds stable slash commands with explicit execution semantics', () => {
    const commands = buildSlashCommands({
      skills: [{ name: 'pdf', description: 'Read PDFs', source: 'skill', filePath: 'skill', baseDir: 'base', scope: 'global', disableModelInvocation: false, status: 'active' }],
      prompts: [{ name: 'review', description: 'Review changes', source: 'prompt', argumentHint: '[scope]' }],
      extensions: [],
      extensionCommands: [{ name: 'hello', description: 'Say hello', source: 'extension' }],
      diagnostics: [],
    })

    expect(commands.map((command) => command.command)).toEqual(expect.arrayContaining([
      '/new',
      '/compact',
      '/skill:pdf',
      '/review',
      '/hello',
    ]))
    expect(commands.find((command) => command.command === '/compact')).toMatchObject({
      kind: 'pi_runtime',
      execution: 'runtime',
    })
    expect(commands.find((command) => command.command === '/export')).toMatchObject({
      execution: 'disabled',
      disabledReason: expect.any(String),
    })
    expect(commands.find((command) => command.command === '/skill:pdf')).toMatchObject({
      kind: 'skill',
      execution: 'prompt',
      source: 'skill',
    })
    expect(commands.find((command) => command.command === '/review')).toMatchObject({
      kind: 'prompt',
      execution: 'prompt',
      argumentHint: '[scope]',
    })
  })
})
