import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TopBar from '../../src/renderer/src/components/TopBar'
import NewSessionDialog from '../../src/renderer/src/components/NewSessionDialog'
import Settings from '../../src/renderer/src/screens/Settings'

describe('TopBar settings simplification', () => {
  it('removes right-side placeholder and settings buttons', () => {
    render(
      <TopBar
        currentDir="D:/PI/app"
        currentModel="deepseek"
        currentModelLabel="DeepSeek"
        thinkingLevel="off"
        tokenCount={10}
      />,
    )

    expect(screen.queryByTitle('Settings')).toBeNull()
    expect(screen.queryByTitle('Search')).toBeNull()
    expect(screen.queryByTitle('Profile')).toBeNull()
  })
})

describe('Settings', () => {
  const configGetMock = vi.fn()
  const configSetMock = vi.fn()
  const pickDirectoryMock = vi.fn()
  let storedDefaultSessionDirectory: string

  beforeEach(() => {
    storedDefaultSessionDirectory = 'D:/Users/OpenSource/Pi-Desktop-Session'
    configGetMock.mockReset()
    configSetMock.mockReset()
    pickDirectoryMock.mockReset()
    configGetMock.mockImplementation(async (key: string) => {
      if (key === 'defaultSessionDirectory') return { success: true, data: storedDefaultSessionDirectory }
      if (key === 'theme') return { success: true, data: 'dark' }
      return { success: true, data: null }
    })
    configSetMock.mockImplementation(async (key: string, value: unknown) => {
      if (key === 'defaultSessionDirectory') storedDefaultSessionDirectory = String(value || '')
      return { success: true }
    })
    pickDirectoryMock.mockResolvedValue({ success: true, data: 'D:/OSS/Pi-Sessions' })

    window.piDesktop = {
      config: {
        get: configGetMock,
        set: configSetMock,
      },
      files: {
        pickDirectory: pickDirectoryMock,
      },
      desktop: {
        getEnvironmentStatus: vi.fn().mockResolvedValue({
          success: true,
          data: {
            overallStatus: 'warning',
            generatedAt: new Date().toISOString(),
            items: [
              { id: 'pi-core', label: 'Pi Core', status: 'ok', summary: 'Pi Core is ready.' },
              {
                id: 'git',
                label: 'Git',
                status: 'missing',
                summary: 'Git is optional.',
                detail: 'https://git-scm.com/download/win',
                actionLabel: 'Copy install command',
                actionKind: 'copy_command',
                actionValue: 'winget install --id Git.Git -e --source winget',
              },
            ],
          },
        }),
      },
    } as never
  })

  it('shows only default file address and theme settings', async () => {
    render(<Settings onClose={() => {}} />)

    expect(await screen.findByLabelText('Default file address')).toBeTruthy()
    expect(screen.getByText('Theme')).toBeTruthy()
    expect(await screen.findByText('Environment')).toBeTruthy()
    expect(screen.getByText('Pi Core')).toBeTruthy()
    expect(screen.getByText('Git')).toBeTruthy()
    expect(screen.getByText('Re-check')).toBeTruthy()
    expect(screen.getByText('Open Git')).toBeTruthy()
    expect(screen.queryByText('Restore')).toBeNull()
    expect(screen.queryByText('Font Size')).toBeNull()
    expect(screen.queryByText('Create Backup')).toBeNull()
    expect(screen.queryByText('Shortcuts')).toBeNull()
    expect(screen.queryByText('About')).toBeNull()
  })

  it('saves the default session directory used by the default new-session option', async () => {
    const onDefaultSessionDirectoryChange = vi.fn()
    render(<Settings onClose={() => {}} onDefaultSessionDirectoryChange={onDefaultSessionDirectoryChange} />)

    const input = await screen.findByLabelText('Default file address')
    fireEvent.change(input, { target: { value: 'D:/OSS/Pi-Sessions' } })
    fireEvent.click(screen.getByText('Save'))

    await waitFor(() => {
      expect(configSetMock).toHaveBeenCalledWith('defaultSessionDirectory', 'D:/OSS/Pi-Sessions')
    })
    expect(onDefaultSessionDirectoryChange).toHaveBeenCalledWith('D:/OSS/Pi-Sessions')
  })
})

describe('NewSessionDialog default folder display', () => {
  it('shows the configured default session directory for the fourth option', () => {
    render(
      <NewSessionDialog
        isOpen
        currentDir=""
        directoryOptions={[]}
        defaultSessionDirectory="D:/OSS/Pi-Sessions"
        onClose={() => {}}
        onCreate={() => {}}
      />,
    )

    expect(screen.getByText('Use Pi Desktop default folder')).toBeTruthy()
    expect(screen.getByText('D:/OSS/Pi-Sessions')).toBeTruthy()
  })
})
