import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'

export function resolvePdfPreviewAssetUrl(assetPath: string): string {
  return new URL(`./pdfjs/${assetPath}`, window.location.href).toString()
}

export function buildPdfDocumentParams(content: number[]) {
  return {
    data: Uint8Array.from(content),
    cMapUrl: resolvePdfPreviewAssetUrl('cmaps/'),
    cMapPacked: true,
    standardFontDataUrl: resolvePdfPreviewAssetUrl('standard_fonts/'),
    wasmUrl: resolvePdfPreviewAssetUrl('wasm/'),
    useWorkerFetch: false,
    useSystemFonts: true,
    enableXfa: true,
  }
}

export function getPdfDocumentLoadingTask(content: number[]) {
  pdfjs.GlobalWorkerOptions.workerSrc = resolvePdfPreviewAssetUrl('pdf.worker.mjs')
  return pdfjs.getDocument(buildPdfDocumentParams(content))
}
