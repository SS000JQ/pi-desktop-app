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

export type FilePreviewData =
  | { type: 'text'; content: string }
  | { type: 'image'; content: string }
  | { type: 'pdf'; content: number[] }
  | {
      type: 'docx'
      content: number[]
      fallbackHtml?: string
    }
  | {
      type: 'pptx'
      content: number[]
      summary?: SlidePreviewSummary[]
    }
  | {
      type: 'xlsx'
      content: number[]
      summary?: WorkbookPreviewSummary
    }
  | { type: 'binary'; ext?: string; reason?: string }
