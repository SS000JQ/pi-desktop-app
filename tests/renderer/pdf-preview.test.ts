import { beforeEach, describe, expect, it, vi } from 'vitest'

const { pdfGetDocumentMock, pdfWorkerOptions } = vi.hoisted(() => ({
  pdfGetDocumentMock: vi.fn(),
  pdfWorkerOptions: {
    workerSrc: '',
  },
}))

vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
  GlobalWorkerOptions: pdfWorkerOptions,
  getDocument: (...args: unknown[]) => pdfGetDocumentMock(...args),
}))

import {
  buildPdfDocumentParams,
  getPdfDocumentLoadingTask,
  resolvePdfPreviewAssetUrl,
} from '../../src/renderer/src/lib/pdf-preview'

describe('pdf-preview runtime helpers', () => {
  beforeEach(() => {
    pdfGetDocumentMock.mockReset()
    pdfWorkerOptions.workerSrc = ''
  })

  it('resolves renderer-local pdf assets from the current window location', () => {
    expect(resolvePdfPreviewAssetUrl('pdf.worker.mjs')).toMatch(/\/pdfjs\/pdf\.worker\.mjs$/)
    expect(resolvePdfPreviewAssetUrl('cmaps/')).toMatch(/\/pdfjs\/cmaps\/$/)
  })

  it('builds pdf.js document params with worker-compatible resource paths', () => {
    const params = buildPdfDocumentParams([1, 2, 3, 4])

    expect(params.data).toBeInstanceOf(Uint8Array)
    expect(Array.from(params.data)).toEqual([1, 2, 3, 4])
    expect(params.cMapUrl).toMatch(/\/pdfjs\/cmaps\/$/)
    expect(params.cMapPacked).toBe(true)
    expect(params.standardFontDataUrl).toMatch(/\/pdfjs\/standard_fonts\/$/)
    expect(params.wasmUrl).toMatch(/\/pdfjs\/wasm\/$/)
    expect(params.useWorkerFetch).toBe(false)
    expect(params.useSystemFonts).toBe(true)
    expect(params.enableXfa).toBe(true)
  })

  it('clones Uint8Array content before passing it to pdf.js', () => {
    const content = new Uint8Array([1, 2, 3, 4])
    const params = buildPdfDocumentParams(content)

    expect(params.data).toBeInstanceOf(Uint8Array)
    expect(params.data).not.toBe(content)
    expect(params.data.buffer).not.toBe(content.buffer)
    expect(Array.from(params.data)).toEqual([1, 2, 3, 4])
  })

  it('configures the legacy worker before loading a document', () => {
    const task = { promise: Promise.resolve(null) }
    pdfGetDocumentMock.mockReturnValue(task)

    const result = getPdfDocumentLoadingTask([9, 8, 7])

    expect(result).toBe(task)
    expect(pdfWorkerOptions.workerSrc).toMatch(/\/pdfjs\/pdf\.worker\.mjs$/)
    expect(pdfGetDocumentMock).toHaveBeenCalledTimes(1)

    const call = pdfGetDocumentMock.mock.calls[0]?.[0] as Record<string, unknown>
    expect(Array.from(call.data as Uint8Array)).toEqual([9, 8, 7])
    expect(call.cMapUrl).toMatch(/\/pdfjs\/cmaps\/$/)
    expect(call.standardFontDataUrl).toMatch(/\/pdfjs\/standard_fonts\/$/)
    expect(call.wasmUrl).toMatch(/\/pdfjs\/wasm\/$/)
  })
})
