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
                scope: 'global',
                disableModelInvocation: false,
                status: 'active',
              },
            ],
            prompts: [],
            extensions: [],
            extensionCommands: [],
            diagnostics: [],
          },
        }),
      },
      skills: {
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
    expect(screen.getByText('global')).toBeTruthy()

    fireEvent.click(screen.getByText('Hide from model'))
    await waitFor(() => {
      expect(window.piDesktop.skills.setModelInvocation).toHaveBeenCalledWith({
        filePath: 'C:/Users/test/.pi/agent/skills/pdf/SKILL.md',
        disabled: true,
      })
    })

    fireEvent.change(screen.getByPlaceholderText(/Search skills/), { target: { value: 'pdf' } })
    fireEvent.click(screen.getByText('Search'))

    expect(await screen.findByText('owner/repo@pdf')).toBeTruthy()
  })
})
