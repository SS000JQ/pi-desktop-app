import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'

import { buildReleaseDiagnostics, formatReleaseDiagnostics } from '../../src/main/diagnostics'

describe('release diagnostics', () => {
  const tempRoots: string[] = []

  afterEach(() => {
    while (tempRoots.length > 0) {
      const root = tempRoots.pop()
      if (root) rmSync(root, { recursive: true, force: true })
    }
  })

  it('reports packaged asset existence without exposing provider secrets', () => {
    const resourcesPath = mkdtempSync(join(tmpdir(), 'pi-resources-'))
    tempRoots.push(resourcesPath)
    mkdirSync(join(resourcesPath, 'pdfjs', 'cmaps'), { recursive: true })
    mkdirSync(join(resourcesPath, 'pdfjs', 'standard_fonts'), { recursive: true })
    mkdirSync(join(resourcesPath, 'pdfjs', 'wasm'), { recursive: true })
    writeFileSync(join(resourcesPath, 'pdfjs', 'pdf.worker.mjs'), 'worker')

    const diagnostics = buildReleaseDiagnostics({
      appVersion: '9.9.9',
      electronVersion: '39.0.0',
      platform: 'win32',
      arch: 'x64',
      packaged: true,
      userDataPath: 'C:/Users/Alice/AppData/Roaming/Pi Desktop',
      resourcesPath,
      currentWorkspace: 'D:/work/project',
      defaultSessionDirectory: 'D:/sessions',
      providers: [
        {
          id: 'openai',
          displayName: 'OpenAI',
          providerId: 'openai',
          hasAuth: true,
          authType: 'apiKey',
          apiType: 'openai-responses',
          baseUrl: 'https://api.openai.com/v1',
          models: [{ id: 'gpt-4.1', name: 'GPT', providerId: 'openai', runtimeKey: 'openai/gpt-4.1', input: ['text'], reasoning: true, isDefault: true }],
          isDefault: true,
          kind: 'builtin',
          createdAt: 'now',
          updatedAt: 'now',
          authHeader: 'sk-secret-should-not-leak',
        },
      ],
    })

    const text = formatReleaseDiagnostics(diagnostics)

    expect(diagnostics.assets.pdfWorker.exists).toBe(true)
    expect(diagnostics.assets.pdfCMaps.exists).toBe(true)
    expect(diagnostics.providers[0]).toMatchObject({
      displayName: 'OpenAI',
      hasAuth: true,
      modelCount: 1,
    })
    expect(text).not.toContain('sk-secret-should-not-leak')
    expect(text).not.toContain('api key')
  })
})
