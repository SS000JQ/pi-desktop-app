import { beforeEach, describe, expect, it, vi } from 'vitest'

const buildSessionContext = vi.fn()
const getHeader = vi.fn()
const getSessionId = vi.fn()
const getCwd = vi.fn()
const getSessionName = vi.fn()

vi.mock('../../src/main/pi-sdk', () => ({
  loadPiCodingAgentModule: vi.fn(async () => ({
    SessionManager: {
      open: vi.fn(() => ({
        buildSessionContext,
        getHeader,
        getSessionId,
        getCwd,
        getSessionName,
      })),
    },
  })),
}))

vi.mock('../../src/main/providers', () => ({
  getProviderByModelKey: vi.fn(() => null),
}))

describe('openPiSession', () => {
  beforeEach(() => {
    vi.resetModules()
    buildSessionContext.mockReset()
    getHeader.mockReset()
    getSessionId.mockReset()
    getCwd.mockReset()
    getSessionName.mockReset()
  })

  it('keeps Pi-native non-chat messages that belong to the active context', async () => {
    buildSessionContext.mockReturnValue({
      messages: [
        { role: 'user', content: 'Summarize the repo' },
        { role: 'toolResult', toolName: 'read', toolCallId: 'tool-1', content: [{ type: 'text', text: 'README' }] },
        { role: 'branchSummary', summary: 'Returned from a side branch', fromId: 'leaf-1', timestamp: Date.now() },
        { role: 'compactionSummary', summary: 'Earlier context condensed', tokensBefore: 4096, timestamp: Date.now() },
        { role: 'custom', customType: 'note', content: [{ type: 'text', text: 'Pinned context' }], display: true, timestamp: Date.now() },
        { role: 'custom', customType: 'hidden', content: [{ type: 'text', text: 'Hidden' }], display: false, timestamp: Date.now() },
      ],
      thinkingLevel: 'high',
      model: { provider: 'openai', modelId: 'gpt-4o-mini' },
    })
    getHeader.mockReturnValue({ cwd: 'D:/PI/app' })
    getSessionId.mockReturnValue('session-1')
    getCwd.mockReturnValue('D:/PI/app')
    getSessionName.mockReturnValue('Real Session')

    const { openPiSession } = await import('../../src/main/pi-sessions')
    const detail = await openPiSession('C:/Users/test/.pi/agent/sessions/project/session-1.jsonl')

    expect(detail.messages).toHaveLength(5)
    expect(detail.messages.map((message) => message.role)).toEqual([
      'user',
      'toolResult',
      'branchSummary',
      'compactionSummary',
      'custom',
    ])
  })
})
