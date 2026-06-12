import { existsSync } from 'fs'
import { join } from 'path'

import type { ProviderConfig } from './providers'

export interface ReleaseDiagnosticsInput {
  appVersion: string
  electronVersion: string
  platform: NodeJS.Platform | string
  arch: string
  packaged: boolean
  userDataPath: string
  resourcesPath: string
  currentWorkspace: string | null
  defaultSessionDirectory: string | null
  providers: ProviderConfig[]
}

export interface ReleaseDiagnostics {
  appVersion: string
  electronVersion: string
  platform: string
  arch: string
  packaged: boolean
  userDataPath: string
  resourcesPath: string
  currentWorkspace: string | null
  defaultSessionDirectory: string | null
  assets: Record<string, { path: string; exists: boolean }>
  providers: Array<{
    id: string
    providerId: string
    displayName: string
    apiType: string
    authType: string
    hasAuth: boolean
    isDefault: boolean
    modelCount: number
  }>
  generatedAt: string
}

function assetCheck(resourcesPath: string, relativePath: string): { path: string; exists: boolean } {
  const fullPath = join(resourcesPath, relativePath)
  return {
    path: fullPath,
    exists: existsSync(fullPath),
  }
}

export function buildReleaseDiagnostics(input: ReleaseDiagnosticsInput): ReleaseDiagnostics {
  return {
    appVersion: input.appVersion,
    electronVersion: input.electronVersion,
    platform: String(input.platform),
    arch: input.arch,
    packaged: input.packaged,
    userDataPath: input.userDataPath,
    resourcesPath: input.resourcesPath,
    currentWorkspace: input.currentWorkspace,
    defaultSessionDirectory: input.defaultSessionDirectory,
    assets: {
      pdfWorker: assetCheck(input.resourcesPath, 'pdfjs/pdf.worker.mjs'),
      pdfCMaps: assetCheck(input.resourcesPath, 'pdfjs/cmaps'),
      pdfStandardFonts: assetCheck(input.resourcesPath, 'pdfjs/standard_fonts'),
      pdfWasm: assetCheck(input.resourcesPath, 'pdfjs/wasm'),
    },
    providers: input.providers.map((provider) => ({
      id: provider.id,
      providerId: provider.providerId,
      displayName: provider.displayName,
      apiType: provider.apiType,
      authType: provider.authType,
      hasAuth: provider.hasAuth,
      isDefault: provider.isDefault,
      modelCount: provider.models.length,
    })),
    generatedAt: new Date().toISOString(),
  }
}

export function formatReleaseDiagnostics(diagnostics: ReleaseDiagnostics): string {
  const lines = [
    'Pi Desktop Diagnostics',
    `Generated: ${diagnostics.generatedAt}`,
    `App version: ${diagnostics.appVersion}`,
    `Electron: ${diagnostics.electronVersion}`,
    `Platform: ${diagnostics.platform} ${diagnostics.arch}`,
    `Packaged: ${diagnostics.packaged ? 'yes' : 'no'}`,
    `User data: ${diagnostics.userDataPath}`,
    `Resources: ${diagnostics.resourcesPath}`,
    `Current workspace: ${diagnostics.currentWorkspace || '(none)'}`,
    `Default session directory: ${diagnostics.defaultSessionDirectory || '(none)'}`,
    '',
    'Assets:',
    ...Object.entries(diagnostics.assets).map(([name, check]) => `- ${name}: ${check.exists ? 'present' : 'missing'} (${check.path})`),
    '',
    'Providers:',
    ...(diagnostics.providers.length > 0
      ? diagnostics.providers.map((provider) => `- ${provider.displayName} (${provider.providerId}): configured=${provider.hasAuth ? 'yes' : 'no'}, models=${provider.modelCount}, default=${provider.isDefault ? 'yes' : 'no'}`)
      : ['- none']),
  ]

  return lines.join('\n')
}
