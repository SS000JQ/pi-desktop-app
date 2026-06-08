export interface SlidePreviewSummary {
  index: number
  title: string
  summary: string
}

export interface WorkbookPreviewSummarySheet {
  name: string
  rows: string[][]
}

export interface WorkbookPreviewSummary {
  sheetNames: string[]
  sheets: WorkbookPreviewSummarySheet[]
}

export type BinaryPreviewContent = Uint8Array | number[]

export type FilePreviewData =
  | { type: 'text'; content: string }
  | { type: 'image'; content: string }
  | { type: 'pdf'; content: BinaryPreviewContent }
  | {
      type: 'docx'
      content: BinaryPreviewContent
      fallbackHtml?: string
    }
  | {
      type: 'pptx'
      content: BinaryPreviewContent
      summary?: SlidePreviewSummary[]
    }
  | {
      type: 'xlsx'
      content: BinaryPreviewContent
      summary?: WorkbookPreviewSummary
    }
  | { type: 'binary'; ext?: string; reason?: string; size?: number; limit?: number }
