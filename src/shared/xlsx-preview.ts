import JSZip from 'jszip'
import { DOMParser } from '@xmldom/xmldom'
import type { Document as XmlDocument, Element as XmlElement } from '@xmldom/xmldom'
import type { WorkbookPreviewSummary } from './preview-types'

export interface XlsxMergeRange {
  startRow: number
  startColumn: number
  endRow: number
  endColumn: number
}

export interface XlsxPreviewSheet {
  name: string
  rows: string[][]
  columnWidths: Array<number | undefined>
  merges: XlsxMergeRange[]
}

export interface XlsxPreviewWorkbook {
  sheetNames: string[]
  sheets: XlsxPreviewSheet[]
}

interface WorkbookSheetRef {
  name: string
  relationshipId: string
  fallbackIndex: number
}

const MAX_RENDER_ROWS = 200
const MAX_RENDER_COLUMNS = 80

function parseXml(xml: string): XmlDocument {
  return new DOMParser().parseFromString(xml, 'text/xml')
}

function elementsByName(parent: XmlDocument | XmlElement, localName: string): XmlElement[] {
  return Array.from(parent.getElementsByTagName('*')).filter((node) => node.localName === localName)
}

function firstElementByName(parent: XmlDocument | XmlElement, localName: string): XmlElement | null {
  return elementsByName(parent, localName)[0] || null
}

function getAttr(element: XmlElement, name: string): string {
  return element.getAttribute(name) || element.getAttribute(`r:${name}`) || ''
}

function columnNameToIndex(columnName: string): number {
  let index = 0
  for (const char of columnName.toUpperCase()) {
    index = index * 26 + (char.charCodeAt(0) - 64)
  }
  return Math.max(0, index - 1)
}

function decodeCellReference(reference: string): { row: number; column: number } | null {
  const match = /^([A-Z]+)(\d+)$/i.exec(reference)
  if (!match) return null
  return {
    row: Math.max(0, Number(match[2]) - 1),
    column: columnNameToIndex(match[1]),
  }
}

function decodeRange(reference: string): { startRow: number; startColumn: number; endRow: number; endColumn: number } | null {
  const [startRef, endRef = startRef] = reference.split(':')
  const start = decodeCellReference(startRef)
  const end = decodeCellReference(endRef)
  if (!start || !end) return null
  return {
    startRow: Math.min(start.row, end.row),
    startColumn: Math.min(start.column, end.column),
    endRow: Math.max(start.row, end.row),
    endColumn: Math.max(start.column, end.column),
  }
}

function collectText(element: XmlElement): string {
  const textNodes = elementsByName(element, 't')
  if (textNodes.length === 0) return element.textContent || ''
  return textNodes.map((node) => node.textContent || '').join('')
}

function normalizeZipPath(path: string): string {
  const parts: string[] = []
  for (const part of path.replace(/\\/g, '/').split('/')) {
    if (!part || part === '.') continue
    if (part === '..') {
      parts.pop()
      continue
    }
    parts.push(part)
  }
  return parts.join('/')
}

function resolveWorkbookTarget(target: string): string {
  if (target.startsWith('/')) return normalizeZipPath(target.slice(1))
  return normalizeZipPath(`xl/${target}`)
}

function parseSharedStrings(xml: string | null): string[] {
  if (!xml) return []
  const document = parseXml(xml)
  return elementsByName(document, 'si').map(collectText)
}

function parseWorkbookSheets(workbookXml: string): WorkbookSheetRef[] {
  const document = parseXml(workbookXml)
  return elementsByName(document, 'sheet').map((sheet, index) => ({
    name: sheet.getAttribute('name') || `Sheet ${index + 1}`,
    relationshipId: getAttr(sheet, 'id'),
    fallbackIndex: index + 1,
  }))
}

function parseWorkbookRelationships(relsXml: string | null): Map<string, string> {
  const relationships = new Map<string, string>()
  if (!relsXml) return relationships

  const document = parseXml(relsXml)
  for (const relationship of elementsByName(document, 'Relationship')) {
    const id = relationship.getAttribute('Id') || ''
    const target = relationship.getAttribute('Target') || ''
    if (id && target) relationships.set(id, resolveWorkbookTarget(target))
  }
  return relationships
}

function parseCellValue(cell: XmlElement, sharedStrings: string[]): string {
  const type = cell.getAttribute('t') || ''

  if (type === 'inlineStr') {
    const inlineString = firstElementByName(cell, 'is')
    return inlineString ? collectText(inlineString) : ''
  }

  const rawValue = firstElementByName(cell, 'v')?.textContent || ''
  if (type === 's') return sharedStrings[Number(rawValue)] || ''
  if (type === 'b') return rawValue === '1' ? 'TRUE' : 'FALSE'
  return rawValue
}

function parseSheetXml(name: string, xml: string, sharedStrings: string[]): XlsxPreviewSheet {
  const document = parseXml(xml)
  const values = new Map<string, string>()
  let maxRow = 0
  let maxColumn = 0

  for (const cell of elementsByName(document, 'c')) {
    const reference = cell.getAttribute('r') || ''
    const decoded = decodeCellReference(reference)
    if (!decoded) continue

    const value = parseCellValue(cell, sharedStrings)
    values.set(`${decoded.row}:${decoded.column}`, value)
    maxRow = Math.max(maxRow, decoded.row)
    maxColumn = Math.max(maxColumn, decoded.column)
  }

  const dimensionRef = firstElementByName(document, 'dimension')?.getAttribute('ref') || ''
  const dimension = dimensionRef ? decodeRange(dimensionRef) : null
  const endRow = Math.min(dimension?.endRow ?? maxRow, MAX_RENDER_ROWS - 1)
  const endColumn = Math.min(dimension?.endColumn ?? maxColumn, MAX_RENDER_COLUMNS - 1)
  const startRow = Math.max(0, dimension?.startRow ?? 0)
  const startColumn = Math.max(0, dimension?.startColumn ?? 0)

  const rows: string[][] = []
  for (let rowIndex = startRow; rowIndex <= endRow; rowIndex += 1) {
    const row: string[] = []
    for (let columnIndex = startColumn; columnIndex <= endColumn; columnIndex += 1) {
      row.push(values.get(`${rowIndex}:${columnIndex}`) || '')
    }
    rows.push(row)
  }

  const columnWidths: Array<number | undefined> = []
  for (const column of elementsByName(document, 'col')) {
    const min = Number(column.getAttribute('min') || 0)
    const max = Number(column.getAttribute('max') || min)
    const width = Number(column.getAttribute('width') || 0)
    if (!min || !max || !width) continue

    for (let index = min - 1; index <= max - 1; index += 1) {
      columnWidths[index] = Math.round(width * 9 + 16)
    }
  }

  const merges = elementsByName(document, 'mergeCell')
    .map((merge) => decodeRange(merge.getAttribute('ref') || ''))
    .filter((merge): merge is XlsxMergeRange => Boolean(merge))

  return { name, rows, columnWidths, merges }
}

export async function parseXlsxPreview(content: Uint8Array): Promise<XlsxPreviewWorkbook> {
  const zip = await JSZip.loadAsync(content)
  const workbookXml = await zip.file('xl/workbook.xml')?.async('string')
  if (!workbookXml) throw new Error('Workbook metadata is missing.')

  const [relsXml, sharedStringsXml] = await Promise.all([
    zip.file('xl/_rels/workbook.xml.rels')?.async('string') ?? null,
    zip.file('xl/sharedStrings.xml')?.async('string') ?? null,
  ])

  const sharedStrings = parseSharedStrings(sharedStringsXml)
  const relationships = parseWorkbookRelationships(relsXml)
  const sheetRefs = parseWorkbookSheets(workbookXml)
  const sheets: XlsxPreviewSheet[] = []

  for (const sheetRef of sheetRefs) {
    const path = relationships.get(sheetRef.relationshipId) || `xl/worksheets/sheet${sheetRef.fallbackIndex}.xml`
    const sheetXml = await zip.file(path)?.async('string')
    if (!sheetXml) continue
    sheets.push(parseSheetXml(sheetRef.name, sheetXml, sharedStrings))
  }

  return {
    sheetNames: sheetRefs.map((sheet) => sheet.name),
    sheets,
  }
}

export function buildWorkbookSummary(workbook: XlsxPreviewWorkbook): WorkbookPreviewSummary {
  return {
    sheetNames: workbook.sheetNames.slice(0, 6),
    sheets: workbook.sheets.slice(0, 3).map((sheet) => ({
      name: sheet.name,
      rows: sheet.rows
        .slice(0, 8)
        .map((row) => row.slice(0, 6))
        .filter((row) => row.some((cell) => cell.trim().length > 0)),
    })),
  }
}
