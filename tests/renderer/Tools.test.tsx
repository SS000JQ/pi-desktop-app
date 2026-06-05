import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import Tools from '../../src/renderer/src/screens/Tools'

describe('Tools', () => {
  it('shows real desktop capabilities instead of mock tool toggles', () => {
    render(
      <Tools
        onClose={() => {}}
        sessionCount={3}
        providerCount={2}
        currentDir="D:/PI/app"
        currentModelLabel="OpenAI / GPT-4o Mini"
        activeSessionTitle="Real Pi Session"
      />,
    )

    expect(screen.getByText('Desktop Capabilities')).toBeTruthy()
    expect(screen.getByText('Pi native sessions')).toBeTruthy()
    expect(screen.getByText(/3 Pi sessions currently visible/)).toBeTruthy()
    expect(screen.getByText(/Branch tree visualization is not implemented yet/)).toBeTruthy()
    expect(screen.queryByText('Web Search')).toBeNull()
  })
})
