import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { BinaryPreviewContent } from '../types/chat'

export function resolvePdfPreviewAssetUrl(assetPath: string): string {
  return new URL(`./pdfjs/${assetPath}`, window.location.href).toString()
}

function toUint8Array(content: BinaryPreviewContent): Uint8Array {
  return content instanceof Uint8Array ? new Uint8Array(content) : Uint8Array.from(content)
}

export function buildPdfDocumentParams(content: BinaryPreviewContent) {
  return {
    data: toUint8Array(content),
    cMapUrl: resolvePdfPreviewAssetUrl('cmaps/'),
    cMapPacked: true,
    standardFontDataUrl: resolvePdfPreviewAssetUrl('standard_fonts/'),
    wasmUrl: resolvePdfPreviewAssetUrl('wasm/'),
    useWorkerFetch: false,
    useSystemFonts: true,
    enableXfa: true,
  }
}

export function getPdfDocumentLoadingTask(content: BinaryPreviewContent) {
  pdfjs.GlobalWorkerOptions.workerSrc = resolvePdfPreviewAssetUrl('pdf.worker.mjs')
  return pdfjs.getDocument(buildPdfDocumentParams(content))
}
