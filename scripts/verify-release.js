#!/usr/bin/env node

const { existsSync, readFileSync } = require('fs')
const { join } = require('path')
const { execFileSync } = require('child_process')

const REQUIRED_ASAR_PATTERNS = [
  '/out/renderer/index.html',
  '/out/renderer/pptx-viewer.html',
  /^\/out\/renderer\/assets\/index-.+\.js$/,
  /^\/out\/renderer\/assets\/pdf-preview-.+\.js$/,
  /^\/out\/renderer\/assets\/pptx-viewer-.+\.js$/,
  '/out/renderer/pdfjs/pdf.worker.mjs',
  /^\/out\/renderer\/pdfjs\/cmaps\/.+$/,
  /^\/out\/renderer\/pdfjs\/standard_fonts\/.+$/,
  /^\/out\/renderer\/pdfjs\/wasm\/.+$/,
]

const REQUIRED_UNPACKED_RESOURCES = [
  'pdfjs/pdf.worker.mjs',
  'pdfjs/cmaps',
  'pdfjs/standard_fonts',
  'pdfjs/wasm',
]

function normalizeAsarEntry(entry) {
  return `/${String(entry).replace(/^[\\/]+/, '').replace(/\\/g, '/')}`
}

function entryMatches(entry, pattern) {
  if (pattern instanceof RegExp) return pattern.test(entry)
  return entry === pattern
}

function patternLabel(pattern) {
  return pattern instanceof RegExp ? pattern.toString() : pattern
}

function defaultListAsarEntries(asarPath) {
  const output = execFileSync(
    process.execPath,
    [require.resolve('@electron/asar/bin/asar.js'), 'list', asarPath],
    { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 },
  )
  return output.split(/\r?\n/).filter(Boolean)
}

function readPackageVersion(packageJsonPath) {
  try {
    return JSON.parse(readFileSync(packageJsonPath, 'utf-8')).version || null
  } catch {
    return null
  }
}

function verifyLatestYml(releaseDir, expectedVersion) {
  const errors = []
  const warnings = []
  const latestPath = join(releaseDir, 'latest.yml')
  if (!existsSync(latestPath)) {
    return { errors: ['Missing release/latest.yml'], warnings }
  }

  const latest = readFileSync(latestPath, 'utf-8')
  if (expectedVersion && !latest.includes(`version: ${expectedVersion}`)) {
    errors.push(`latest.yml does not reference package version ${expectedVersion}`)
  }

  const pathMatch = latest.match(/^path:\s*(.+)$/m)
  if (!pathMatch) {
    errors.push('latest.yml is missing a path entry')
    return { errors, warnings }
  }

  const installerName = pathMatch[1].trim().replace(/^['"]|['"]$/g, '')
  if (!/setup/i.test(installerName)) {
    errors.push(`latest.yml must point to the setup installer, got: ${installerName}`)
  }
  if (!existsSync(join(releaseDir, installerName))) {
    errors.push(`latest.yml points to missing installer: ${installerName}`)
  }
  return { errors, warnings }
}

function verifyReleaseArtifacts(options = {}) {
  const releaseDir = options.releaseDir || join(process.cwd(), 'release')
  const packageJsonPath = options.packageJsonPath || join(process.cwd(), 'package.json')
  const listAsarEntries = options.listAsarEntries || defaultListAsarEntries
  const errors = []
  const warnings = []

  const asarPath = join(releaseDir, 'win-unpacked', 'resources', 'app.asar')
  if (!existsSync(asarPath)) {
    errors.push(`Missing packaged app.asar at ${asarPath}`)
  }

  if (existsSync(asarPath)) {
    let entries = []
    try {
      entries = listAsarEntries(asarPath).map(normalizeAsarEntry)
    } catch (error) {
      errors.push(`Unable to list app.asar contents: ${error instanceof Error ? error.message : String(error)}`)
    }

    for (const pattern of REQUIRED_ASAR_PATTERNS) {
      if (!entries.some((entry) => entryMatches(entry, pattern))) {
        errors.push(`Missing app.asar entry matching ${patternLabel(pattern)}`)
      }
    }
  }

  const resourcesDir = join(releaseDir, 'win-unpacked', 'resources')
  for (const resourcePath of REQUIRED_UNPACKED_RESOURCES) {
    if (!existsSync(join(resourcesDir, resourcePath))) {
      errors.push(`Missing unpacked resource: win-unpacked/resources/${resourcePath.replace(/\\/g, '/')}`)
    }
  }

  const packageVersion = readPackageVersion(packageJsonPath)
  if (!packageVersion) {
    warnings.push('Unable to read package.json version')
  }
  const latestResult = verifyLatestYml(releaseDir, packageVersion)
  errors.push(...latestResult.errors)
  warnings.push(...latestResult.warnings)

  return {
    ok: errors.length === 0,
    errors,
    warnings,
  }
}

function runCli() {
  const result = verifyReleaseArtifacts()
  for (const warning of result.warnings) {
    console.warn(`WARN ${warning}`)
  }
  if (!result.ok) {
    for (const error of result.errors) {
      console.error(`ERROR ${error}`)
    }
    process.exitCode = 1
    return
  }
  console.log('Release verification passed.')
}

if (require.main === module) {
  runCli()
}

module.exports = {
  verifyReleaseArtifacts,
}
