import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import Skills from '../../src/renderer/src/screens/Skills'

describe('Skills', () => {
  beforeEach(() => {
    window.piDesktop = {
      ...(window.piDesktop || {}),
      desktop: {
        ...(window.piDesktop?.desktop || {}),
        getPiResources: vi.fn().mockResolvedValue({
          success: true,
          data: {
            skills: [
              {
                name: 'pdf',
                description: 'Read and inspect PDFs',
                source: 'C:/Users/test/.pi/agent/skills/pdf/SKILL.md',
                filePath: 'C:/Users/test/.pi/agent/skills/pdf/SKILL.md',
                baseDir: 'C:/Users/test/.pi/agent/skills/pdf',
                scope: 'pi_global',
                sourceLabel: 'Pi Global',
                disabled: false,
                disableModelInvocation: false,
                status: 'active',
              },
              {
                name: 'embedded-core',
                description: 'Embedded systems',
                source: 'C:/Users/test/.agents/skills/embedded-core/SKILL.md',
                filePath: 'C:/Users/test/.agents/skills/embedded-core/SKILL.md',
                baseDir: 'C:/Users/test/.agents/skills/embedded-core',
                scope: 'shared_global',
                sourceLabel: 'Shared Global',
                disabled: false,
                disableModelInvocation: false,
                status: 'active',
              },
            ],
            prompts: [],
            extensions: [],
            extensionCommands: [],
            diagnostics: [],
            additionalSkillPaths: [],
            disabledSkillPaths: [],
            summary: {
              cwd: 'D:/work/project',
              agentDir: 'C:/Users/test/.pi/agent',
              totalSkills: 2,
              countsByScope: {
                pi_global: 1,
                shared_global: 1,
                project: 0,
                settings: 0,
                package: 0,
                other: 0,
              },
            },
          },
        }),
      },
      skills: {
        getSettings: vi.fn().mockResolvedValue({
          success: true,
          data: {
            additionalSkillPaths: [],
            disabledSkillPaths: [],
            suggestedSkillPaths: ['C:/Users/test/.codex/skills', 'C:/Users/test/.claude/skills'],
          },
        }),
        setAdditionalPaths: vi.fn().mockResolvedValue({ success: true }),
        setDisabled: vi.fn().mockResolvedValue({ success: true }),
        search: vi.fn().mockResolvedValue({
          success: true,
          data: [
            {
              packageName: 'owner/repo@pdf',
              name: 'pdf',
              installs: '1.2K installs',
              url: 'https://skills.sh/pdf-tools',
            },
          ],
        }),
        install: vi.fn().mockResolvedValue({ success: true }),
        setModelInvocation: vi.fn().mockResolvedValue({ success: true }),
      },
    } as typeof window.piDesktop
  })

  it('loads Pi resources for the active workspace and session path', async () => {
    render(<Skills currentDir="D:/work/project" sessionPath="C:/Users/test/.pi/sessions/one.jsonl" onClose={() => {}} />)

    expect(screen.getByText('Loading Pi resources...')).toBeTruthy()

    await waitFor(() => {
      expect(window.piDesktop.desktop.getPiResources).toHaveBeenCalledWith(
        'D:/work/project',
        'C:/Users/test/.pi/sessions/one.jsonl',
      )
    })

    expect(await screen.findByText('/skill:pdf')).toBeTruthy()
    expect(screen.getByText('Read and inspect PDFs')).toBeTruthy()
  })

  it('can re-check resources without closing the panel', async () => {
    render(<Skills currentDir="D:/work/project" onClose={() => {}} />)

    await screen.findByText('/skill:pdf')
    fireEvent.click(screen.getByText('Re-check'))

    await waitFor(() => {
      expect(window.piDesktop.desktop.getPiResources).toHaveBeenCalledTimes(2)
    })
  })

  it('falls back to the legacy desktop state summary when the Pi resources API is unavailable', async () => {
    window.piDesktop = {
      ...(window.piDesktop || {}),
      desktop: {
        ...(window.piDesktop?.desktop || {}),
        getPiResources: undefined,
        getStateSummary: vi.fn().mockResolvedValue({
          success: true,
          data: {
            memory: [],
            skills: [
              {
                id: 'pdf',
                label: 'pdf',
                value: 'Read PDFs',
                source: 'legacy summary',
                status: 'active',
              },
            ],
            connectors: [],
          },
        }),
      },
    } as typeof window.piDesktop

    render(<Skills onClose={() => {}} />)

    expect(await screen.findByText('/skill:pdf')).toBeTruthy()
    expect(window.piDesktop.desktop.getStateSummary).toHaveBeenCalled()
  })

  it('shows skill management controls for discovered skills', async () => {
    render(<Skills currentDir="D:/work/project" onClose={() => {}} />)

    expect(await screen.findByText('/skill:pdf')).toBeTruthy()
    expect(screen.getByText('Pi Global')).toBeTruthy()
    expect(screen.getByText('Shared Global')).toBeTruthy()
    expect(screen.getByText('/skill:embedded-core')).toBeTruthy()
    expect(screen.getByText(/2 skills/)).toBeTruthy()
    expect(screen.getByText('Pi Global 1')).toBeTruthy()
    expect(screen.getByText('Shared Global 1')).toBeTruthy()
    expect(screen.getByTestId('skill-actions-pdf')).toBeTruthy()

    const pdfActions = screen.getByTestId('skill-actions-pdf')
    fireEvent.click(pdfActions.querySelector('button')!)
    await waitFor(() => {
      expect(window.piDesktop.skills.setModelInvocation).toHaveBeenCalledWith({
        filePath: 'C:/Users/test/.pi/agent/skills/pdf/SKILL.md',
        disabled: true,
      })
    })
    expect((await screen.findByRole('status')).textContent).toMatch(/hidden from model/i)

    fireEvent.click(screen.getAllByText('Disable skill')[0])
    await waitFor(() => {
      expect(window.piDesktop.skills.setDisabled).toHaveBeenCalledWith({
        filePath: 'C:/Users/test/.pi/agent/skills/pdf/SKILL.md',
        disabled: true,
      })
    })
    expect((await screen.findByRole('status')).textContent).toMatch(/disabled/i)

    fireEvent.change(screen.getByPlaceholderText(/Search skills/), { target: { value: 'pdf' } })
    fireEvent.click(screen.getByText('Search'))

    expect(await screen.findByText('owner/repo@pdf')).toBeTruthy()
    expect(screen.getByText(/Install from search is coming later/i)).toBeTruthy()
    expect(screen.queryByText('路')).toBeNull()
  })

  it('manages additional skill paths from suggested external agent directories', async () => {
    render(<Skills currentDir="D:/work/project" onClose={() => {}} />)

    expect(await screen.findByText('Additional skill paths')).toBeTruthy()
    expect(screen.getByText('External directories detected but not enabled')).toBeTruthy()
    expect(screen.getByText('C:/Users/test/.codex/skills')).toBeTruthy()

    fireEvent.click(screen.getByText('Add Codex skills'))
    await waitFor(() => {
      expect(window.piDesktop.skills.setAdditionalPaths).toHaveBeenCalledWith({
        paths: ['C:/Users/test/.codex/skills'],
      })
    })
    expect((await screen.findByRole('status')).textContent).toMatch(/saved/i)
  })

  it('keeps long skill descriptions collapsed until the row is opened', async () => {
    const longDescription = 'A'.repeat(180) + ' unique expanded detail'
    ;(window.piDesktop.desktop.getPiResources as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      success: true,
      data: {
        skills: [
          {
            name: 'long-skill',
            description: longDescription,
            source: 'C:/Users/test/.agents/skills/long-skill/SKILL.md',
            filePath: 'C:/Users/test/.agents/skills/long-skill/SKILL.md',
            baseDir: 'C:/Users/test/.agents/skills/long-skill',
            scope: 'shared_global',
            sourceLabel: 'Shared Global',
            disabled: false,
            disableModelInvocation: false,
            status: 'active',
          },
        ],
        prompts: [],
        extensions: [],
        extensionCommands: [],
        diagnostics: [],
        additionalSkillPaths: [],
        disabledSkillPaths: [],
        summary: {
          cwd: 'D:/work/project',
          agentDir: 'C:/Users/test/.pi/agent',
          totalSkills: 1,
          countsByScope: {
            pi_global: 0,
            shared_global: 1,
            project: 0,
            settings: 0,
            package: 0,
            other: 0,
          },
        },
      },
    })

    render(<Skills currentDir="D:/work/project" onClose={() => {}} />)

    expect(await screen.findByText('/skill:long-skill')).toBeTruthy()
    expect(screen.queryByText(/unique expanded detail/)).toBeNull()

    fireEvent.click(screen.getByText('/skill:long-skill'))

    expect(await screen.findByText(/unique expanded detail/)).toBeTruthy()
    expect(screen.getByText('C:/Users/test/.agents/skills/long-skill/SKILL.md')).toBeTruthy()
  })
})
