import { shell } from 'electron'
import { exec } from 'child_process'
import { existsSync } from 'fs'
import { extname } from 'path'

export type FileType = 'office' | 'code' | 'markdown' | 'html' | 'image' | 'unknown'

export function detectFileType(ext: string): FileType {
  const e = ext.toLowerCase()
  if (['.pptx', '.docx', '.xlsx', '.ppt', '.doc', '.xls'].includes(e)) return 'office'
  if (
    [
      '.ts',
      '.tsx',
      '.js',
      '.jsx',
      '.py',
      '.go',
      '.rs',
      '.java',
      '.c',
      '.cpp',
      '.css',
      '.scss',
      '.json',
      '.yaml',
      '.yml',
      '.toml',
      '.xml',
      '.sh',
      '.bash',
      '.sql'
    ].includes(e)
  )
    return 'code'
  if (['.md', '.txt'].includes(e)) return 'markdown'
  if (['.html', '.htm'].includes(e)) return 'html'
  if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico'].includes(e)) return 'image'
  return 'unknown'
}

export function getEditorLabel(filePath: string): string {
  const ext = extname(filePath)
  const type = detectFileType(ext)
  switch (type) {
    case 'office':
      return 'Open in WPS'
    case 'code':
    case 'markdown':
      return 'Open in VS Code'
    case 'html':
      return 'Open in Browser'
    default:
      return 'Open'
  }
}

export function canPreview(ext: string): boolean {
  const e = ext.toLowerCase()
  return [
    '.md',
    '.csv',
    '.pdf',
    '.pptx',
    '.docx',
    '.xlsx',
    '.png',
    '.jpg',
    '.jpeg',
    '.gif',
    '.svg',
    '.html',
    '.htm',
    '.txt',
    '.ts',
    '.tsx',
    '.js',
    '.py',
    '.go',
    '.rs',
    '.json',
    '.css'
  ].includes(e)
}

export function canEdit(ext: string): boolean {
  const e = ext.toLowerCase()
  return [
    '.md',
    '.txt',
    '.ts',
    '.tsx',
    '.js',
    '.py',
    '.go',
    '.rs',
    '.css',
    '.json',
    '.yaml',
    '.toml',
    '.xml',
    '.sh'
  ].includes(e)
}

export function hasPreview(ext: string): boolean {
  const e = ext.toLowerCase()
  return ['.md', '.html', '.htm'].includes(e)
}

export function hasSource(ext: string): boolean {
  const e = ext.toLowerCase()
  return ['.md', '.html', '.htm'].includes(e)
}

export async function openInExternalEditor(filePath: string): Promise<void> {
  const ext = extname(filePath).toLowerCase()
  const type = detectFileType(ext)

  switch (type) {
    case 'office':
      await shell.openPath(filePath)
      break
    case 'code':
    case 'markdown':
      try {
        await new Promise<void>((resolve, reject) => {
          exec(`code -r "${filePath}"`, (err) => {
            if (err) reject(err)
            else resolve()
          })
        })
      } catch {
        await shell.openPath(filePath)
      }
      break
    case 'html':
      await shell.openExternal(`file://${filePath}`)
      break
    default:
      await shell.openPath(filePath)
  }
}
