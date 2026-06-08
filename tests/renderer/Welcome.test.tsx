import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Welcome from '../../src/renderer/src/screens/Welcome'

function setupPiDesktopMock() {
  const configSet = vi.fn().mockResolvedValue({ success: true })
  const pickDirectory = vi.fn().mockResolvedValue({ success: true, data: 'D:/OSS/Pi-Sessions' })
  window.piDesktop = {
    config: {
      get: vi.fn().mockResolvedValue({ success: true, data: null }),
      set: configSet,
    },
    files: {
      pickDirectory,
    },
    providers: {
      catalog: vi.fn().mockResolvedValue({
        success: true,
        data: [
          {
            providerId: 'openai',
            displayName: 'OpenAI',
            apiType: 'openai-responses',
            authType: 'apiKey',
            baseUrl: 'https://api.openai.com/v1',
            allowCustomBaseUrl: false,
          },
        ],
      }),
      add: vi.fn().mockResolvedValue({ success: true }),
      test: vi.fn().mockResolvedValue({
        success: true,
        data: {
          success: true,
          message: 'Connection successful',
          detectedModels: [{ id: 'gpt-4o-mini', name: 'GPT-4o mini', runtimeKey: 'openai/gpt-4o-mini', providerId: 'openai', input: ['text'], reasoning: false, isDefault: true }],
        },
      }),
      discoverModels: vi.fn().mockResolvedValue({
        success: true,
        data: [{ id: 'gpt-4o-mini', name: 'GPT-4o mini', runtimeKey: 'openai/gpt-4o-mini', providerId: 'openai', input: ['text'], reasoning: false, isDefault: true }],
      }),
    },
    desktop: {
      getEnvironmentStatus: vi.fn().mockResolvedValue({
        success: true,
        data: {
          overallStatus: 'warning',
          generatedAt: new Date().toISOString(),
          items: [
            { id: 'pi-core', label: 'Pi Core', status: 'ok', summary: 'Pi Core is ready.' },
            { id: 'git', label: 'Git', status: 'missing', summary: 'Git is optional.', actionValue: 'winget install --id Git.Git -e --source winget' },
          ],
        },
      }),
    },
  } as never
  return { configSet, pickDirectory }
}

describe('Welcome', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('saves the selected directory as defaultSessionDirectory instead of workingDirectory', async () => {
    const { configSet } = setupPiDesktopMock()
    render(<Welcome onComplete={() => {}} />)

    fireEvent.click(screen.getByText('Continue'))
    fireEvent.click(await screen.findByText('OpenAI'))
    fireEvent.click(screen.getByText('Continue'))
    fireEvent.change(await screen.findByPlaceholderText('sk-...'), { target: { value: 'sk-test' } })
    fireEvent.click(screen.getByText('Continue'))
    fireEvent.click(screen.getByText('Continue'))
    fireEvent.click(screen.getByText('Browse'))
    expect(await screen.findByDisplayValue('D:/OSS/Pi-Sessions')).toBeTruthy()
    fireEvent.click(screen.getByText('Continue'))
    expect(await screen.findByText('Environment Check')).toBeTruthy()
    fireEvent.click(screen.getByText('Continue'))
    fireEvent.click(screen.getByText('Start Using Pi Desktop'))

    await waitFor(() => {
      expect(configSet).toHaveBeenCalledWith('defaultSessionDirectory', 'D:/OSS/Pi-Sessions')
    })
    expect(configSet).not.toHaveBeenCalledWith('workingDirectory', expect.anything())
  })

  it('shows environment checks and treats missing Git as optional', async () => {
    setupPiDesktopMock()
    render(<Welcome onComplete={() => {}} />)

    fireEvent.click(screen.getByText('Continue'))
    fireEvent.click(await screen.findByText('OpenAI'))
    fireEvent.click(screen.getByText('Continue'))
    expect(await screen.findByPlaceholderText('sk-...')).toBeTruthy()
    fireEvent.click(screen.getByText('Continue'))
    fireEvent.click(screen.getByText('Continue'))
    expect(await screen.findByText('Default File Address')).toBeTruthy()
    fireEvent.click(screen.getByText('Continue'))

    expect(await screen.findByText('Environment Check')).toBeTruthy()
    expect(screen.getByText('Pi Core')).toBeTruthy()
    expect(screen.getByText('Git')).toBeTruthy()
    expect(screen.getByText('Re-check')).toBeTruthy()
    expect(screen.getByText('Continue')).toBeTruthy()
  })
})
