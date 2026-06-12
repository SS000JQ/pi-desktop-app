import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { verifyReleaseArtifacts } = require('../../scripts/verify-release.js') as {
  verifyReleaseArtifacts: (options: {
    releaseDir: string
    packageJsonPath: string
    listAsarEntries: (asarPath: string) => string[]
  }) => { ok: boolean; errors: string[]; warnings: string[] }
}

function createReleaseFixture(entries: string[], options: { includeExtraPdfResources?: boolean; friendlyInstallerName?: boolean } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'pi-release-'))
  const releaseDir = join(root, 'release')
  const resourcesDir = join(releaseDir, 'win-unpacked', 'resources')
  mkdirSync(resourcesDir, { recursive: true })
  writeFileSync(join(resourcesDir, 'app.asar'), 'fake asar')
  if (options.includeExtraPdfResources) {
    mkdirSync(join(resourcesDir, 'pdfjs', 'cmaps'), { recursive: true })
    mkdirSync(join(resourcesDir, 'pdfjs', 'standard_fonts'), { recursive: true })
    mkdirSync(join(resourcesDir, 'pdfjs', 'wasm'), { recursive: true })
    writeFileSync(join(resourcesDir, 'pdfjs', 'pdf.worker.mjs'), 'worker')
    writeFileSync(join(resourcesDir, 'pdfjs', 'cmaps', 'LICENSE'), 'license')
    writeFileSync(join(resourcesDir, 'pdfjs', 'standard_fonts', 'LiberationSans-Regular.ttf'), 'font')
    writeFileSync(join(resourcesDir, 'pdfjs', 'wasm', 'openjpeg.wasm'), 'wasm')
  }
  writeFileSync(join(releaseDir, 'latest.yml'), [
    'version: 9.9.9',
    'files:',
    '  - url: Pi-Desktop-Setup-9.9.9.exe',
    '    sha512: fake',
    '    size: 10',
    'path: Pi-Desktop-Setup-9.9.9.exe',
  ].join('\n'))
  writeFileSync(join(releaseDir, options.friendlyInstallerName ? 'Pi Desktop Setup 9.9.9.exe' : 'Pi-Desktop-Setup-9.9.9.exe'), 'installer')
  writeFileSync(join(root, 'package.json'), JSON.stringify({ version: '9.9.9' }))

  return {
    root,
    releaseDir,
    packageJsonPath: join(root, 'package.json'),
    listAsarEntries: () => entries,
  }
}

const requiredEntries = [
  '/out/renderer/index.html',
  '/out/renderer/pptx-viewer.html',
  '/out/renderer/assets/index-abc.js',
  '/out/renderer/assets/pdf-preview-abc.js',
  '/out/renderer/assets/pptx-viewer-abc.js',
  '/out/renderer/pdfjs/pdf.worker.mjs',
  '/out/renderer/pdfjs/cmaps/LICENSE',
  '/out/renderer/pdfjs/standard_fonts/LiberationSans-Regular.ttf',
  '/out/renderer/pdfjs/wasm/openjpeg.wasm',
]

describe('verifyReleaseArtifacts', () => {
  const tempRoots: string[] = []

  afterEach(() => {
    while (tempRoots.length > 0) {
      const root = tempRoots.pop()
      if (root) rmSync(root, { recursive: true, force: true })
    }
  })

  it('fails when packaged PDF.js renderer assets are missing from app.asar', () => {
    const fixture = createReleaseFixture([
      '/out/renderer/index.html',
      '/out/renderer/assets/index-abc.js',
    ])
    tempRoots.push(fixture.root)

    const result = verifyReleaseArtifacts(fixture)

    expect(result.ok).toBe(false)
    expect(result.errors).toContain('Missing app.asar entry matching /out/renderer/pdfjs/pdf.worker.mjs')
    expect(result.errors).toContain('Missing app.asar entry matching /out/renderer/pptx-viewer.html')
  })

  it('passes when required release files and packaged renderer assets are present', () => {
    const fixture = createReleaseFixture(requiredEntries, { includeExtraPdfResources: true })
    tempRoots.push(fixture.root)

    const result = verifyReleaseArtifacts(fixture)

    expect(result).toEqual({
      ok: true,
      errors: [],
      warnings: [],
    })
  })

  it('fails when unpacked PDF.js resources are missing for packaged runtime loading', () => {
    const fixture = createReleaseFixture(requiredEntries)
    tempRoots.push(fixture.root)

    const result = verifyReleaseArtifacts(fixture)

    expect(result.ok).toBe(false)
    expect(result.errors).toContain('Missing unpacked resource: win-unpacked/resources/pdfjs/pdf.worker.mjs')
  })

  it('fails when latest.yml points to a differently named installer', () => {
    const fixture = createReleaseFixture(requiredEntries, { includeExtraPdfResources: true, friendlyInstallerName: true })
    tempRoots.push(fixture.root)

    const result = verifyReleaseArtifacts(fixture)

    expect(result.ok).toBe(false)
    expect(result.errors).toContain('latest.yml points to missing installer: Pi-Desktop-Setup-9.9.9.exe')
  })

  it('fails when latest.yml does not point to the setup installer', () => {
    const fixture = createReleaseFixture(requiredEntries, { includeExtraPdfResources: true })
    tempRoots.push(fixture.root)
    writeFileSync(join(fixture.releaseDir, 'latest.yml'), [
      'version: 9.9.9',
      'files:',
      '  - url: Pi-Desktop-Portable-9.9.9.exe',
      '    sha512: fake',
      '    size: 10',
      'path: Pi-Desktop-Portable-9.9.9.exe',
    ].join('\n'))
    writeFileSync(join(fixture.releaseDir, 'Pi-Desktop-Portable-9.9.9.exe'), 'portable')

    const result = verifyReleaseArtifacts(fixture)

    expect(result.ok).toBe(false)
    expect(result.errors).toContain('latest.yml must point to the setup installer, got: Pi-Desktop-Portable-9.9.9.exe')
  })
})
