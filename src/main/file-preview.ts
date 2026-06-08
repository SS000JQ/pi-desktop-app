import { extname } from 'path'
import { readFileSync, statSync } from 'fs'
import mammoth from 'mammoth'
import JSZip from 'jszip'
import { DOMParser } from '@xmldom/xmldom'
import type {
  FilePreviewData,
  SlidePreviewSummary,
} from '../shared/preview-types'
import { buildWorkbookSummary, parseXlsxPreview } from '../shared/xlsx-preview'

const TEXT_PREVIEW_LIMIT_BYTES = 3 * 1024 * 1024
const IMAGE_PREVIEW_LIMIT_BYTES = 25 * 1024 * 1024
const RICH_PREVIEW_LIMIT_BYTES = 50 * 1024 * 1024

const textExtensions = new Set([
  '.bat',
  '.c',
  '.cpp',
  '.cjs',
  '.conf',
  '.env',
  '.gitignore',
  '.ini',
  '.java',
  '.jsx',
  '.log',
  '.md',
  '.mdx',
  '.mjs',
  '.ps1',
  '.scss',
  '.sql',
  '.txt',
  '.ts',
  '.tsx',
  '.js',
  '.py',
  '.go',
  '.rs',
  '.json',
  '.css',
  '.html',
  '.htm',
  '.toml',
  '.yaml',
  '.yml',
  '.xml',
  '.sh',
])

const imageExtensions = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.webp',
])

function buildTooLargePreview(ext: string, size: number, limit: number): FilePreviewData {
  return {
    type: 'binary',
    ext,
    size,
    limit,
    reason: `This file is too large for in-app preview (${formatBytes(size)}). Use Open to view it externally.`,
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`
}

function getFileSize(filePath: string): number {
  return statSync(filePath).size
}

function readBinaryContent(filePath: string, ext: string, limitBytes: number): Uint8Array | FilePreviewData {
  const size = getFileSize(filePath)
  if (size > limitBytes) return buildTooLargePreview(ext, size, limitBytes)
  return new Uint8Array(readFileSync(filePath))
}

function readTextContent(filePath: string, ext: string, limitBytes: number): string | FilePreviewData {
  const size = getFileSize(filePath)
  if (size > limitBytes) return buildTooLargePreview(ext, size, limitBytes)
  return readFileSync(filePath, 'utf-8')
}

function readImagePreview(filePath: string, ext: string): FilePreviewData {
  const rawContent = readBinaryContent(filePath, ext, IMAGE_PREVIEW_LIMIT_BYTES)
  if (!(rawContent instanceof Uint8Array)) return rawContent

  const base64 = Buffer.from(rawContent).toString('base64')
  const mime = ext === '.svg' ? 'image/svg+xml' : `image/${ext.slice(1)}`
  return { type: 'image', content: `data:${mime};base64,${base64}` }
}

async function readDocxPreview(filePath: string): Promise<FilePreviewData> {
  const rawContent = readBinaryContent(filePath, '.docx', RICH_PREVIEW_LIMIT_BYTES)
  if (!(rawContent instanceof Uint8Array)) return rawContent

  try {
    const result = await mammoth.convertToHtml({ buffer: Buffer.from(rawContent) })
    return {
      type: 'docx',
      content: rawContent,
      fallbackHtml: result.value || '<p>No preview content found in this document.</p>',
    }
  } catch {
    return {
      type: 'docx',
      content: rawContent,
    }
  }
}

async function readXlsxPreview(filePath: string, ext: string): Promise<FilePreviewData> {
  const rawContent = readBinaryContent(filePath, ext, RICH_PREVIEW_LIMIT_BYTES)
  if (!(rawContent instanceof Uint8Array)) return rawContent

  try {
    const workbook = await parseXlsxPreview(rawContent)
    return {
      type: 'xlsx',
      content: rawContent,
      summary: buildWorkbookSummary(workbook),
    }
  } catch {
    return {
      type: 'xlsx',
      content: rawContent,
    }
  }
}

function readPdfPreview(filePath: string): FilePreviewData {
  const rawContent = readBinaryContent(filePath, '.pdf', RICH_PREVIEW_LIMIT_BYTES)
  if (!(rawContent instanceof Uint8Array)) return rawContent

  return {
    type: 'pdf',
    content: rawContent,
  }
}

function extractPptxText(xml: string): string[] {
  const document = new DOMParser().parseFromString(xml, 'text/xml')
  const textNodes = document.getElementsByTagName('a:t')
  const values: string[] = []

  for (let index = 0; index < textNodes.length; index += 1) {
    const value = textNodes[index]?.textContent?.trim()
    if (value) values.push(value)
  }

  return values
}

async function readPptxPreview(filePath: string): Promise<FilePreviewData> {
  const rawContent = readBinaryContent(filePath, '.pptx', RICH_PREVIEW_LIMIT_BYTES)
  if (!(rawContent instanceof Uint8Array)) return rawContent

  try {
    const zip = await JSZip.loadAsync(rawContent)
    const slidePaths = Object.keys(zip.files)
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
      .sort((left, right) => {
        const leftNumber = Number(left.match(/slide(\d+)/i)?.[1] || 0)
        const rightNumber = Number(right.match(/slide(\d+)/i)?.[1] || 0)
        return leftNumber - rightNumber
      })

    const summary: SlidePreviewSummary[] = await Promise.all(
      slidePaths.slice(0, 12).map(async (slidePath, index) => {
        const xml = await zip.file(slidePath)?.async('string')
        const texts = xml ? extractPptxText(xml) : []
        const title = texts[0] || `Slide ${index + 1}`
        const summary = texts.slice(1).join(' ').trim() || 'No text summary available for this slide.'
        return {
          index: index + 1,
          title,
          summary,
        }
      }),
    )

    return {
      type: 'pptx',
      content: rawContent,
      summary,
    }
  } catch {
    return {
      type: 'pptx',
      content: rawContent,
    }
  }
}

export async function readPreviewFile(filePath: string): Promise<FilePreviewData> {
  const fileStat = statSync(filePath)
  if (!fileStat.isFile()) {
    return {
      type: 'binary',
      reason: 'Only files can be previewed in the right panel.',
    }
  }

  const ext = extname(filePath).toLowerCase()

  if (textExtensions.has(ext)) {
    const content = readTextContent(filePath, ext, TEXT_PREVIEW_LIMIT_BYTES)
    if (typeof content !== 'string') return content
    return { type: 'text', content }
  }

  if (imageExtensions.has(ext)) {
    return readImagePreview(filePath, ext)
  }

  if (ext === '.pdf') {
    return readPdfPreview(filePath)
  }

  if (ext === '.docx') {
    return readDocxPreview(filePath)
  }

  if (ext === '.doc' || ext === '.ppt' || ext === '.xls') {
    return {
      type: 'binary',
      ext,
      reason: 'Legacy Office files are not supported for in-app preview yet. Use Open to view them externally.',
    }
  }

  if (ext === '.xlsx' || ext === '.csv') {
    return readXlsxPreview(filePath, ext)
  }

  if (ext === '.pptx') {
    return readPptxPreview(filePath)
  }

  return {
    type: 'binary',
    ext,
    reason: 'This file type does not have an in-app preview yet.',
  }
}
