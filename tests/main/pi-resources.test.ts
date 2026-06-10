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
              sourceInfo: {
                source: 'auto',
                scope: 'user',
                origin: 'top-level',
                path: 'C:/Users/test/.pi/agent/skills/pdf/SKILL.md',
                baseDir: 'C:/Users/test/.pi/agent',
              },
            },
            {
              name: 'embedded-core',
              description: 'Embedded systems',
              filePath: 'C:/Users/test/.agents/skills/embedded-core/SKILL.md',
              baseDir: 'C:/Users/test/.agents/skills/embedded-core',
              disableModelInvocation: false,
              sourceInfo: {
                source: 'auto',
                scope: 'user',
                origin: 'top-level',
                path: 'C:/Users/test/.agents/skills/embedded-core/SKILL.md',
                baseDir: 'C:/Users/test/.agents',
              },
            },
            {
              name: 'project-review',
              description: 'Review this project',
              filePath: 'D:/project/.pi/skills/project-review/SKILL.md',
              baseDir: 'D:/project/.pi/skills/project-review',
              disableModelInvocation: true,
              sourceInfo: {
                source: 'auto',
                scope: 'project',
                origin: 'top-level',
                path: 'D:/project/.pi/skills/project-review/SKILL.md',
                baseDir: 'D:/project/.pi',
              },
            },
            {
              name: 'subagents',
              description: 'Delegate work',
              filePath: 'C:/Users/test/.pi/agent/npm/node_modules/pi-subagents/skills/pi-subagents/SKILL.md',
              baseDir: 'C:/Users/test/.pi/agent/npm/node_modules/pi-subagents/skills/pi-subagents',
              disableModelInvocation: false,
              sourceInfo: {
                source: 'npm:pi-subagents',
                scope: 'user',
                origin: 'package',
                path: 'C:/Users/test/.pi/agent/npm/node_modules/pi-subagents/skills/pi-subagents/SKILL.md',
                baseDir: 'C:/Users/test/.pi/agent/npm/node_modules/pi-subagents',
              },
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

    expect(resources.summary).toMatchObject({
      cwd: 'D:/project',
      totalSkills: 4,
      countsByScope: {
        pi_global: 1,
        shared_global: 1,
        project: 1,
        package: 1,
      },
    })
    expect(resources.skills).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'pdf',
        description: 'Read and create PDFs',
        source: 'C:/Users/test/.pi/agent/skills/pdf/SKILL.md',
        filePath: 'C:/Users/test/.pi/agent/skills/pdf/SKILL.md',
        baseDir: 'C:/Users/test/.pi/agent/skills/pdf',
        scope: 'pi_global',
        sourceLabel: 'Pi Global',
        disableModelInvocation: false,
        disabled: false,
        status: 'active',
      }),
      expect.objectContaining({
        name: 'embedded-core',
        scope: 'shared_global',
        sourceLabel: 'Shared Global',
      }),
      expect.objectContaining({
        name: 'project-review',
        scope: 'project',
        sourceLabel: 'Project',
        disableModelInvocation: true,
      }),
      expect.objectContaining({
        name: 'subagents',
        scope: 'package',
        sourceLabel: 'Package',
      }),
    ]))
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
      skills: [{ name: 'pdf', description: 'Read PDFs', source: 'skill', filePath: 'skill', baseDir: 'base', scope: 'pi_global', sourceLabel: 'Pi Global', disabled: false, disableModelInvocation: false, status: 'active' }],
      prompts: [{ name: 'review', description: 'Review changes', source: 'prompt', argumentHint: '[scope]' }],
      extensions: [],
      extensionCommands: [{ name: 'hello', description: 'Say hello', source: 'extension' }],
      diagnostics: [],
      additionalSkillPaths: [],
      disabledSkillPaths: [],
      summary: {
        cwd: null,
        agentDir: null,
        totalSkills: 1,
        countsByScope: { pi_global: 1, shared_global: 0, project: 0, settings: 0, package: 0, other: 0 },
      },
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

  it('filters disabled skills out of resources and slash commands', async () => {
    const disabledPath = 'C:/Users/test/.agents/skills/embedded-core/SKILL.md'
    const resources = await buildPiResources({
      cwd: 'D:/project',
      disabledSkillPaths: [disabledPath],
      createLoader: () => ({
        reload: vi.fn().mockResolvedValue(undefined),
        getSkills: () => ({
          skills: [
            {
              name: 'embedded-core',
              description: 'Embedded systems',
              filePath: disabledPath,
              baseDir: 'C:/Users/test/.agents/skills/embedded-core',
              sourceInfo: { source: 'auto', scope: 'user', origin: 'top-level', baseDir: 'C:/Users/test/.agents', path: disabledPath },
              disableModelInvocation: false,
            },
            {
              name: 'pdf',
              description: 'Read PDFs',
              filePath: 'C:/Users/test/.pi/agent/skills/pdf/SKILL.md',
              baseDir: 'C:/Users/test/.pi/agent/skills/pdf',
              sourceInfo: { source: 'auto', scope: 'user', origin: 'top-level', baseDir: 'C:/Users/test/.pi/agent', path: 'C:/Users/test/.pi/agent/skills/pdf/SKILL.md' },
              disableModelInvocation: false,
            },
          ],
          diagnostics: [],
        }),
        getPrompts: () => ({ prompts: [], diagnostics: [] }),
        getExtensions: () => ({ extensions: [], errors: [] }),
      }),
    })

    expect(resources.skills.map((skill) => skill.name)).toEqual(['pdf'])
    expect(resources.disabledSkillPaths).toEqual([disabledPath])
    expect(buildSlashCommands(resources).map((command) => command.command)).not.toContain('/skill:embedded-core')
  })
})
