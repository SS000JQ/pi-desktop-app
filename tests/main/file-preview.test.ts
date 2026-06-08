import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import JSZip from 'jszip'
import { afterEach, describe, expect, it } from 'vitest'
import { readPreviewFile } from '../../src/main/file-preview'
import { createXlsxFixture } from '../utils/xlsx-fixture'

async function createPptxFile(filePath: string): Promise<void> {
  const zip = new JSZip()

  zip.file(
    'ppt/slides/slide1.xml',
    [
      '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"',
      ' xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">',
      '<p:cSld><p:spTree><p:sp><p:txBody>',
      '<a:p><a:r><a:t>Intro</a:t></a:r></a:p>',
      '<a:p><a:r><a:t>Overview of the plan</a:t></a:r></a:p>',
      '</p:txBody></p:sp></p:spTree></p:cSld>',
      '</p:sld>',
    ].join(''),
  )

  zip.file(
    'ppt/slides/slide2.xml',
    [
      '<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"',
      ' xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">',
      '<p:cSld><p:spTree><p:sp><p:txBody>',
      '<a:p><a:r><a:t>Next Step</a:t></a:r></a:p>',
      '<a:p><a:r><a:t>Implementation milestones</a:t></a:r></a:p>',
      '</p:txBody></p:sp></p:spTree></p:cSld>',
      '</p:sld>',
    ].join(''),
  )

  const content = await zip.generateAsync({ type: 'nodebuffer' })
  writeFileSync(filePath, content)
}

async function createDocxFile(filePath: string): Promise<void> {
  const zip = new JSZip()

  zip.file(
    '[Content_Types].xml',
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
      '<Default Extension="xml" ContentType="application/xml"/>',
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>',
      '</Types>',
    ].join(''),
  )
  zip.file(
    '_rels/.rels',
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>',
      '</Relationships>',
    ].join(''),
  )
  zip.file(
    'word/document.xml',
    [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
      '<w:body>',
      '<w:p><w:r><w:t>Quarterly Brief</w:t></w:r></w:p>',
      '<w:p><w:r><w:t>Prepared for review.</w:t></w:r></w:p>',
      '</w:body>',
      '</w:document>',
    ].join(''),
  )

  const content = await zip.generateAsync({ type: 'nodebuffer' })
  writeFileSync(filePath, content)
}

describe('readPreviewFile', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop()
      if (dir) rmSync(dir, { recursive: true, force: true })
    }
  })

  it('returns raw pptx bytes together with extracted slide summaries', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'pi-preview-'))
    tempDirs.push(tempDir)
    const filePath = join(tempDir, 'slides.pptx')
    await createPptxFile(filePath)

    const preview = await readPreviewFile(filePath)

    expect(preview.type).toBe('pptx')
    if (preview.type !== 'pptx') return

    expect(preview.content.length).toBeGreaterThan(0)
    expect(preview.summary).toEqual([
      { index: 1, title: 'Intro', summary: 'Overview of the plan' },
      { index: 2, title: 'Next Step', summary: 'Implementation milestones' },
    ])
  })

  it('still returns a pptx payload when summary extraction fails', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'pi-preview-'))
    tempDirs.push(tempDir)
    const filePath = join(tempDir, 'broken.pptx')
    writeFileSync(filePath, Buffer.from([0, 1, 2, 3, 4, 5]))

    const preview = await readPreviewFile(filePath)

    expect(preview.type).toBe('pptx')
    if (preview.type !== 'pptx') return

    expect(Array.from(preview.content)).toEqual([0, 1, 2, 3, 4, 5])
    expect(preview.summary).toBeUndefined()
  })

  it('returns raw pdf bytes instead of a file url', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'pi-preview-'))
    tempDirs.push(tempDir)
    const filePath = join(tempDir, 'report.pdf')
    const pdfBytes = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF')
    writeFileSync(filePath, pdfBytes)

    const preview = await readPreviewFile(filePath)

    expect(preview.type).toBe('pdf')
    if (preview.type !== 'pdf') return
    expect(Array.from(preview.content)).toEqual(Array.from(pdfBytes))
  })

  it('returns a controllable fallback instead of reading oversized binary previews', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'pi-preview-'))
    tempDirs.push(tempDir)
    const filePath = join(tempDir, 'huge.pdf')
    writeFileSync(filePath, Buffer.alloc(50 * 1024 * 1024 + 1))

    const preview = await readPreviewFile(filePath)

    expect(preview.type).toBe('binary')
    if (preview.type !== 'binary') return
    expect(preview.ext).toBe('.pdf')
    expect(preview.size).toBe(50 * 1024 * 1024 + 1)
    expect(preview.limit).toBe(50 * 1024 * 1024)
    expect(preview.reason).toMatch(/too large/i)
  })

  it('returns raw docx bytes together with a fallback html rendering', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'pi-preview-'))
    tempDirs.push(tempDir)
    const filePath = join(tempDir, 'brief.docx')
    await createDocxFile(filePath)

    const preview = await readPreviewFile(filePath)

    expect(preview.type).toBe('docx')
    if (preview.type !== 'docx') return

    expect(preview.content.length).toBeGreaterThan(0)
    expect(preview.fallbackHtml).toContain('Quarterly Brief')
    expect(preview.fallbackHtml).toContain('Prepared for review.')
  })

  it('returns raw workbook bytes together with a summary fallback', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'pi-preview-'))
    tempDirs.push(tempDir)
    const filePath = join(tempDir, 'tracker.xlsx')
    const workbookBytes = await createXlsxFixture([
      ['Task', 'Owner'],
      ['Draft', 'Pi'],
    ])
    writeFileSync(filePath, workbookBytes)

    const preview = await readPreviewFile(filePath)

    expect(preview.type).toBe('xlsx')
    if (preview.type !== 'xlsx') return

    expect(preview.content.length).toBeGreaterThan(0)
    expect(preview.summary).toEqual({
      sheetNames: ['Sheet1'],
      sheets: [
        {
          name: 'Sheet1',
          rows: [
            ['Task', 'Owner'],
            ['Draft', 'Pi'],
          ],
        },
      ],
    })
  })
})
