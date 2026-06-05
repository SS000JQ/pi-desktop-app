import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import Files from '../../src/renderer/src/screens/Files'

describe('Files', () => {
  beforeEach(() => {
    window.piDesktop = {
      ...(window.piDesktop || {}),
      files: {
        ...(window.piDesktop?.files || {}),
        list: vi.fn().mockResolvedValue({ success: true, data: [] }),
        read: vi.fn().mockResolvedValue({ success: true, data: { type: 'text', content: '' } }),
        save: vi.fn().mockResolvedValue({ success: true }),
        open: vi.fn().mockResolvedValue({ success: true }),
      },
    } as Window['piDesktop']
  })

  it('starts from the provided working directory', async () => {
    render(<Files onClose={() => {}} initialDir="D:/PI/app" />)

    await waitFor(() => {
      expect(window.piDesktop.files.list).toHaveBeenCalledWith('D:/PI/app')
    })
  })
})
