import { describe, expect, it, vi } from 'vitest'
import { buildEnvironmentStatus } from '../../src/main/environment'

describe('environment status', () => {
  it('reports Pi core as ok when the runtime module loads', async () => {
    const status = await buildEnvironmentStatus({
      loadPiCore: async () => ({ ok: true }),
      loadProviders: () => [],
      getConfigValue: () => null,
      getEffectiveDefaultSessionDirectory: () => 'C:/Users/test/Pi-Desktop-Session',
      pathExists: () => false,
      checkGitVersion: async () => null,
      checkGitRepository: async () => null,
      releaseReady: true,
    })

    expect(status.items.find((item) => item.id === 'pi-core')?.status).toBe('ok')
  })

  it('reports Pi core errors with readable details', async () => {
    const status = await buildEnvironmentStatus({
      loadPiCore: async () => {
        throw new Error('Cannot find module @earendil-works/pi-coding-agent')
      },
      loadProviders: () => [],
      getConfigValue: () => null,
      getEffectiveDefaultSessionDirectory: () => 'C:/Users/test/Pi-Desktop-Session',
      pathExists: () => false,
      checkGitVersion: async () => null,
      checkGitRepository: async () => null,
      releaseReady: true,
    })

    const item = status.items.find((entry) => entry.id === 'pi-core')
    expect(item?.status).toBe('error')
    expect(item?.summary).toMatch(/Pi Core failed to load/)
    expect(item?.detail).toMatch(/pi-coding-agent/)
  })

  it('distinguishes missing provider auth from runnable providers', async () => {
    const missing = await buildEnvironmentStatus({
      loadPiCore: async () => ({ ok: true }),
      loadProviders: () => [{ hasAuth: false, models: [{ id: 'model' }] }],
      getConfigValue: () => null,
      getEffectiveDefaultSessionDirectory: () => 'C:/Users/test/Pi-Desktop-Session',
      pathExists: () => false,
      checkGitVersion: async () => null,
      checkGitRepository: async () => null,
      releaseReady: true,
    })
    expect(missing.items.find((item) => item.id === 'ai-provider')?.status).toBe('missing')

    const ready = await buildEnvironmentStatus({
      loadPiCore: async () => ({ ok: true }),
      loadProviders: () => [{ hasAuth: true, models: [{ id: 'model' }] }],
      getConfigValue: () => 'C:/Users/test/Pi-Desktop-Session',
      getEffectiveDefaultSessionDirectory: () => 'C:/Users/test/Pi-Desktop-Session',
      pathExists: () => true,
      checkGitVersion: async () => 'git version 2.45.0',
      checkGitRepository: async () => true,
      releaseReady: true,
    })
    expect(ready.items.find((item) => item.id === 'ai-provider')?.status).toBe('ok')
  })

  it('warns when the default workspace has not been explicitly configured', async () => {
    const status = await buildEnvironmentStatus({
      loadPiCore: async () => ({ ok: true }),
      loadProviders: () => [],
      getConfigValue: () => null,
      getEffectiveDefaultSessionDirectory: () => 'C:/Users/test/Pi-Desktop-Session',
      pathExists: () => false,
      checkGitVersion: async () => null,
      checkGitRepository: async () => null,
      releaseReady: true,
    })

    const item = status.items.find((entry) => entry.id === 'default-workspace')
    expect(item?.status).toBe('warning')
    expect(item?.summary).toMatch(/Choose a default file address/)
  })

  it('treats missing Git as optional and exposes install guidance', async () => {
    const status = await buildEnvironmentStatus({
      loadPiCore: async () => ({ ok: true }),
      loadProviders: () => [],
      getConfigValue: () => 'C:/Users/test/Pi-Desktop-Session',
      getEffectiveDefaultSessionDirectory: () => 'C:/Users/test/Pi-Desktop-Session',
      pathExists: () => true,
      checkGitVersion: async () => null,
      checkGitRepository: async () => null,
      releaseReady: true,
    })

    const item = status.items.find((entry) => entry.id === 'git')
    expect(item?.status).toBe('missing')
    expect(item?.actionValue).toContain('winget install')
    expect(status.overallStatus).not.toBe('error')
  })
})
