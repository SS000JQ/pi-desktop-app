import { extname } from 'path'
import { pathToFileURL } from 'url'
import { readFileSync } from 'fs'
import mammoth from 'mammoth'
import JSZip from 'jszip'
import * as XLSX from 'xlsx'
import { DOMParser } from '@xmldom/xmldom'

export type FilePreviewData =
  | { type: 'text'; content: string }
  | { type: 'image'; content: string }
  | { type: 'pdf'; content: string }
  | { type: 'docx'; content: string }
  | {
      type: 'pptx'
      slides: Array<{
        index: number
        title: string
        summary: string
      }>
    }
  | {
      type: 'xlsx'
      workbook: {
        sheetNames: string[]
        sheets: Array<{
          name: string
          rows: string[][]
        }>
      }
    }
  | { type: 'binary'; ext?: string; reason?: string }

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

function readImagePreview(filePath: string, ext: string): FilePreviewData {
  const base64 = readFileSync(filePath).toString('base64')
  const mime = ext === '.svg' ? 'image/svg+xml' : `image/${ext.slice(1)}`
  return { type: 'image', content: `data:${mime};base64,${base64}` }
}

async function readDocxPreview(filePath: string): Promise<FilePreviewData> {
  const result = await mammoth.convertToHtml({ path: filePath })
  return {
    type: 'docx',
    content: result.value || '<p>No preview content found in this document.</p>',
  }
}

function readXlsxPreview(filePath: string): FilePreviewData {
  const workbook = XLSX.readFile(filePath, { cellDates: false })
  const sheetNames = workbook.SheetNames.slice(0, 6)
  const sheets = sheetNames.slice(0, 3).map((name) => {
    const sheet = workbook.Sheets[name]
    const rows = ((XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      blankrows: false,
      raw: false,
    }) as unknown[]) || [])
      .slice(0, 8)
      .map((row) =>
        Array.isArray(row)
          ? row.slice(0, 6).map((cell) => (cell == null ? '' : String(cell)))
          : [],
      )
      .filter((row) => row.some((cell) => cell.trim().length > 0))

    return { name, rows }
  })

  return {
    type: 'xlsx',
    workbook: {
      sheetNames,
      sheets,
    },
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
  const zip = await JSZip.loadAsync(readFileSync(filePath))
  const slidePaths = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((left, right) => {
      const leftNumber = Number(left.match(/slide(\d+)/i)?.[1] || 0)
      const rightNumber = Number(right.match(/slide(\d+)/i)?.[1] || 0)
      return leftNumber - rightNumber
    })

  const slides = await Promise.all(
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
    slides,
  }
}

export async function readPreviewFile(filePath: string): Promise<FilePreviewData> {
  const ext = extname(filePath).toLowerCase()

  if (textExtensions.has(ext)) {
    return { type: 'text', content: readFileSync(filePath, 'utf-8') }
  }

  if (imageExtensions.has(ext)) {
    return readImagePreview(filePath, ext)
  }

  if (ext === '.pdf') {
    return { type: 'pdf', content: `${pathToFileURL(filePath).toString()}#toolbar=0&navpanes=0` }
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
    return readXlsxPreview(filePath)
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
