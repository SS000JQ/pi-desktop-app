import { describe, expect, it, vi } from 'vitest'
import { PiBridge } from '../../src/main/pi-bridge'

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => 'C:/Users/test/AppData/Roaming'),
  },
}))

describe('PiBridge runtime commands', () => {
  function bridgeWithMockSession() {
    const bridge = new PiBridge() as any
    const session = {
      compact: vi.fn().mockResolvedValue({ summary: 'compressed' }),
      getAllTools: vi.fn(() => [
        { name: 'read', description: 'Read files', sourceInfo: { source: 'builtin' } },
        { name: 'bash', description: 'Run shell', sourceInfo: { source: 'builtin' } },
      ]),
      getActiveToolNames: vi.fn(() => ['read']),
      setActiveToolsByName: vi.fn(),
      steer: vi.fn().mockResolvedValue(undefined),
      followUp: vi.fn().mockResolvedValue(undefined),
    }
    const resourceLoader = { reload: vi.fn().mockResolvedValue(undefined) }
    bridge.bindings.set('session.jsonl', {
      sessionId: 'sid',
      sessionPath: 'session.jsonl',
      session,
      resourceLoader,
      cwd: 'D:/project',
    })
    return { bridge: bridge as PiBridge, session, resourceLoader }
  }

  it('runs compact through the active AgentSession instead of prompt text', async () => {
    const { bridge, session } = bridgeWithMockSession()

    await bridge.compact('session.jsonl', 'Focus on code changes')

    expect(session.compact).toHaveBeenCalledWith('Focus on code changes')
  })

  it('reads and updates active tools for a session binding', async () => {
    const { bridge, session } = bridgeWithMockSession()

    await expect(bridge.getTools('session.jsonl')).resolves.toEqual([
      { name: 'read', description: 'Read files', active: true, source: 'builtin' },
      { name: 'bash', description: 'Run shell', active: false, source: 'builtin' },
    ])
    await bridge.setTools('session.jsonl', ['read', 'bash'])

    expect(session.setActiveToolsByName).toHaveBeenCalledWith(['read', 'bash'])
  })

  it('queues steer and follow-up messages through native session methods', async () => {
    const { bridge, session } = bridgeWithMockSession()

    await bridge.steer('session.jsonl', 'Change direction')
    await bridge.followUp('session.jsonl', 'Summarize when done')

    expect(session.steer).toHaveBeenCalledWith('Change direction')
    expect(session.followUp).toHaveBeenCalledWith('Summarize when done')
  })

  it('reloads the resource loader for the active binding', async () => {
    const { bridge, resourceLoader } = bridgeWithMockSession()

    await bridge.reloadResources('session.jsonl')

    expect(resourceLoader.reload).toHaveBeenCalled()
  })
})
