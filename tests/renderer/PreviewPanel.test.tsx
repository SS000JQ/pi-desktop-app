import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createXlsxFixture } from '../utils/xlsx-fixture'

type ViewerBehavior = {
  slideCount: number
  loadFile?: () => Promise<void>
  renderSlide?: (slideIndex: number) => Promise<void>
  goToSlide?: (slideIndex: number) => Promise<void>
}

type PdfBehavior = {
  pageCount: number
  shouldFail?: boolean
  renderPromises?: Promise<unknown>[]
}

type DocxBehavior = {
  shouldFail?: boolean
  html: string
}

const viewerInstances: MockPPTXViewer[] = []
let viewerBehavior: ViewerBehavior
let pdfBehavior: PdfBehavior
let docxBehavior: DocxBehavior

const pdfGetDocumentMock = vi.fn()
const pdfRenderMock = vi.fn()
const docxRenderAsyncMock = vi.fn()
const iframePostMessageMock = vi.fn()
let iframeContentWindowMock: { postMessage: typeof iframePostMessageMock }
let resizeObserverCallbacks: ResizeObserverCallback[]

class MockPPTXViewer {
  currentSlideIndex = 0
  slideCount = 1
  loadFile = vi.fn(async () => {
    if (viewerBehavior.loadFile) {
      await viewerBehavior.loadFile()
    }
    return this
  })
  renderSlide = vi.fn(async (slideIndex: number) => {
    if (viewerBehavior.renderSlide) {
      await viewerBehavior.renderSlide(slideIndex)
    }
    this.currentSlideIndex = slideIndex
    return this
  })
  goToSlide = vi.fn(async (slideIndex: number) => {
    if (viewerBehavior.goToSlide) {
      await viewerBehavior.goToSlide(slideIndex)
    }
    this.currentSlideIndex = slideIndex
    return this
  })
  getSlideCount = vi.fn(() => this.slideCount)
  getCurrentSlideIndex = vi.fn(() => this.currentSlideIndex)
  destroy = vi.fn()

  constructor() {
    this.slideCount = viewerBehavior.slideCount
    viewerInstances.push(this)
  }
}

vi.mock('pptxviewjs', () => ({
  PPTXViewer: MockPPTXViewer,
}))

vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
  GlobalWorkerOptions: {
    workerSrc: '',
  },
  getDocument: (...args: unknown[]) => pdfGetDocumentMock(...args),
}))

vi.mock('docx-preview', () => ({
  renderAsync: (...args: unknown[]) => docxRenderAsyncMock(...args),
}))

import PreviewPanel from '../../src/renderer/src/components/PreviewPanel'

describe('PreviewPanel', () => {
  beforeEach(() => {
    viewerInstances.length = 0
    viewerBehavior = {
      slideCount: 2,
    }
    pdfBehavior = {
      pageCount: 2,
    }
    docxBehavior = {
      html: '<h1>Quarterly Brief</h1><p>Prepared for review.</p>',
    }
    resizeObserverCallbacks = []

    pdfGetDocumentMock.mockReset()
    pdfRenderMock.mockReset()
    pdfGetDocumentMock.mockImplementation(() => {
      if (pdfBehavior.shouldFail) {
        return {
          promise: Promise.reject(new Error('pdf failed')),
          destroy: vi.fn(),
        }
      }

      return {
        promise: Promise.resolve({
          numPages: pdfBehavior.pageCount,
          getPage: vi.fn(async () => ({
            getViewport: ({ scale }: { scale: number }) => ({
              width: 640 * scale,
              height: 480 * scale,
            }),
            render: vi.fn(() => {
              pdfRenderMock()
              return { promise: pdfBehavior.renderPromises?.shift() || Promise.resolve() }
            }),
            cleanup: vi.fn(),
          })),
          destroy: vi.fn(),
          cleanup: vi.fn(),
        }),
        destroy: vi.fn(),
      }
    })

    docxRenderAsyncMock.mockReset()
    docxRenderAsyncMock.mockImplementation(async (_data: unknown, container: HTMLElement) => {
      if (docxBehavior.shouldFail) {
        throw new Error('docx failed')
      }
      container.innerHTML = docxBehavior.html
    })

    iframePostMessageMock.mockReset()
    iframeContentWindowMock = {
      postMessage: iframePostMessageMock,
    }
    Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
      configurable: true,
      get: () => iframeContentWindowMock,
    })

    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: vi.fn(() => ({
        setTransform: vi.fn(),
        clearRect: vi.fn(),
        drawImage: vi.fn(),
      })),
    })

    class MockResizeObserver {
      callback: ResizeObserverCallback

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback
        resizeObserverCallbacks.push(callback)
      }

      observe = vi.fn()
      disconnect = vi.fn()
      unobserve = vi.fn()
    }

    Object.defineProperty(window, 'ResizeObserver', {
      configurable: true,
      value: MockResizeObserver,
    })
    Object.defineProperty(globalThis, 'ResizeObserver', {
      configurable: true,
      value: MockResizeObserver,
    })
  })

  function emitPptxViewerEvent(data: Record<string, unknown>) {
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: iframeContentWindowMock as Window,
          data: {
            source: 'pi-pptx-preview',
            ...data,
          },
        }),
      )
    })
  }

  it('renders the workbench sections with uploads, connectors, and skills', async () => {
    render(
      <PreviewPanel
        collapsed={false}
        onToggleCollapse={() => {}}
        panelWidth={360}
        onResize={() => {}}
        currentWorkspace="D:/PI/app/musicccc"
        workspaceFiles={[
          {
            name: 'report_submit_ready.md',
            path: 'D:/PI/app/musicccc/report_submit_ready.md',
            isDir: false,
            size: 100,
            modifiedAt: new Date().toISOString(),
          },
        ]}
        workspaceDirectories={[
          {
            name: 'assets',
            path: 'D:/PI/app/musicccc/assets',
            isDir: true,
            size: 0,
            modifiedAt: new Date().toISOString(),
          },
        ]}
        contextUploads={[{ id: 'u1', label: '绉戝涓庣ぞ浼氱粨棰樻姤鍛?pdf', path: 'D:/PI/app/musicccc/report.pdf' }]}
        contextConnectors={[{ id: 'c1', label: 'Web search' }]}
        contextSkills={[{ id: 's1', label: 'writing-plans' }]}
      />,
    )

    expect(screen.getByText('Progress')).toBeTruthy()
    expect(screen.getByText('Workspace')).toBeTruthy()
    expect(screen.getByText('Context')).toBeTruthy()
    expect(screen.getByText('Uploads')).toBeTruthy()
    expect(screen.getByText('Connectors')).toBeTruthy()
    expect(screen.getByText('Skills')).toBeTruthy()
    expect(screen.getByText('report_submit_ready.md')).toBeTruthy()
    expect(screen.getByText('绉戝涓庣ぞ浼氱粨棰樻姤鍛?pdf')).toBeTruthy()
    expect(screen.getByText('Web search')).toBeTruthy()
  })

  it('renders a markdown preview from real file content', async () => {
    render(
      <PreviewPanel
        collapsed={false}
        onToggleCollapse={() => {}}
        panelWidth={300}
        onResize={() => {}}
        previewFile={{
          path: 'D:/PI/app/notes.md',
          name: 'notes.md',
          ext: '.md',
          type: 'text',
          content: '# Hello Preview\n\nThis came from a real file.\n\n| A | B |\n| - | - |\n| 1 | 2 |',
        }}
        onClosePreview={() => {}}
        onOpenExternal={() => {}}
      />,
    )

    expect(screen.getAllByText('notes.md').length).toBeGreaterThan(0)
    expect(screen.getByText('Hello Preview')).toBeTruthy()
    expect(screen.getByText('This came from a real file.')).toBeTruthy()
    expect(screen.getByText('A')).toBeTruthy()
  })

  it('renders an image preview with viewer controls', async () => {
    render(
      <PreviewPanel
        collapsed={false}
        onToggleCollapse={() => {}}
        panelWidth={300}
        onResize={() => {}}
        previewFile={{
          path: 'D:/PI/app/image.png',
          name: 'image.png',
          ext: '.png',
          type: 'image',
          content: 'data:image/png;base64,abc123',
        }}
        onClosePreview={() => {}}
        onOpenExternal={() => {}}
      />,
    )

    const image = screen.getByAltText('image.png') as HTMLImageElement
    expect(image).toBeTruthy()
    expect(image.src).toContain('data:image/png;base64,abc123')
    expect(screen.getByText('Fit Width')).toBeTruthy()
    expect(screen.getByText('Actual Size')).toBeTruthy()
  })

  it('renders a pdf viewer with page controls', async () => {
    render(
      <PreviewPanel
        collapsed={false}
        onToggleCollapse={() => {}}
        panelWidth={300}
        onResize={() => {}}
        previewFile={{
          path: 'D:/PI/app/report.pdf',
          name: 'report.pdf',
          ext: '.pdf',
          type: 'pdf',
          content: [37, 80, 68, 70],
        }}
        onClosePreview={() => {}}
        onOpenExternal={() => {}}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('1 / 2')).toBeTruthy()
    })

    expect(screen.getByRole('button', { name: 'Previous page' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeTruthy()
  })

  it('reloads the pdf document when the same path receives new content', async () => {
    const { rerender } = render(
      <PreviewPanel
        collapsed={false}
        onToggleCollapse={() => {}}
        panelWidth={300}
        onResize={() => {}}
        previewFile={{
          path: 'D:/PI/app/report.pdf',
          name: 'report.pdf',
          ext: '.pdf',
          type: 'pdf',
          content: [37, 80, 68, 70],
        }}
        onClosePreview={() => {}}
        onOpenExternal={() => {}}
      />,
    )

    await waitFor(() => {
      expect(pdfGetDocumentMock).toHaveBeenCalledTimes(1)
    })

    rerender(
      <PreviewPanel
        collapsed={false}
        onToggleCollapse={() => {}}
        panelWidth={300}
        onResize={() => {}}
        previewFile={{
          path: 'D:/PI/app/report.pdf',
          name: 'report.pdf',
          ext: '.pdf',
          type: 'pdf',
          content: [37, 80, 68, 70, 10],
        }}
        onClosePreview={() => {}}
        onOpenExternal={() => {}}
      />,
    )

    await waitFor(() => {
      expect(pdfGetDocumentMock).toHaveBeenCalledTimes(2)
    })
  })

  it('recovers from a failed pdf render when the same file receives valid content', async () => {
    pdfBehavior.shouldFail = true
    const { rerender } = render(
      <PreviewPanel
        collapsed={false}
        onToggleCollapse={() => {}}
        panelWidth={300}
        onResize={() => {}}
        previewFile={{
          path: 'D:/PI/app/report.pdf',
          name: 'report.pdf',
          ext: '.pdf',
          type: 'pdf',
          content: [37, 80, 68, 70],
        }}
        onClosePreview={() => {}}
        onOpenExternal={() => {}}
      />,
    )

    expect(await screen.findByText('PDF rendering failed. Use Open for the native viewer if needed.')).toBeTruthy()

    pdfBehavior.shouldFail = false
    rerender(
      <PreviewPanel
        collapsed={false}
        onToggleCollapse={() => {}}
        panelWidth={300}
        onResize={() => {}}
        previewFile={{
          path: 'D:/PI/app/report.pdf',
          name: 'report.pdf',
          ext: '.pdf',
          type: 'pdf',
          content: [37, 80, 68, 70, 10],
        }}
        onClosePreview={() => {}}
        onOpenExternal={() => {}}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('1 / 2')).toBeTruthy()
    })
    expect(screen.queryByText('PDF rendering failed. Use Open for the native viewer if needed.')).toBeNull()
  })

  it('does not attach a ResizeObserver for pdf redraws', async () => {
    render(
      <PreviewPanel
        collapsed={false}
        onToggleCollapse={() => {}}
        panelWidth={300}
        onResize={() => {}}
        previewFile={{
          path: 'D:/PI/app/report.pdf',
          name: 'report.pdf',
          ext: '.pdf',
          type: 'pdf',
          content: [37, 80, 68, 70],
        }}
        onClosePreview={() => {}}
        onOpenExternal={() => {}}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('1 / 2')).toBeTruthy()
    })

    expect(resizeObserverCallbacks).toHaveLength(0)
    expect(screen.queryByText('PDF rendering failed. Use Open for the native viewer if needed.')).toBeNull()
  })

  it('redraws pdf only after explicit panel width changes', async () => {
    const { rerender } = render(
      <PreviewPanel
        collapsed={false}
        onToggleCollapse={() => {}}
        panelWidth={300}
        onResize={() => {}}
        previewFile={{
          path: 'D:/PI/app/report.pdf',
          name: 'report.pdf',
          ext: '.pdf',
          type: 'pdf',
          content: [37, 80, 68, 70],
        }}
        onClosePreview={() => {}}
        onOpenExternal={() => {}}
      />,
    )

    await waitFor(() => {
      expect(pdfRenderMock).toHaveBeenCalledTimes(1)
    })

    const stage = document.querySelector('.pv-viewer-stage') as HTMLElement
    Object.defineProperty(stage, 'clientWidth', {
      configurable: true,
      value: 700,
    })

    await act(async () => {
      rerender(
        <PreviewPanel
          collapsed={false}
          onToggleCollapse={() => {}}
          panelWidth={720}
          onResize={() => {}}
          previewFile={{
            path: 'D:/PI/app/report.pdf',
            name: 'report.pdf',
            ext: '.pdf',
            type: 'pdf',
            content: [37, 80, 68, 70],
          }}
          onClosePreview={() => {}}
          onOpenExternal={() => {}}
        />,
      )
      await new Promise((resolve) => window.setTimeout(resolve, 150))
    })

    await waitFor(() => {
      expect(pdfRenderMock).toHaveBeenCalledTimes(2)
    })
    expect(screen.queryByText('PDF rendering failed. Use Open for the native viewer if needed.')).toBeNull()
  })

  it('serializes pdf panel-width redraws so they cannot render into an active canvas', async () => {
    let finishFirstRender: (() => void) | null = null
    pdfBehavior.renderPromises = [
      new Promise((resolve) => {
        finishFirstRender = () => resolve(undefined)
      }),
      Promise.resolve(),
    ]

    const { rerender } = render(
      <PreviewPanel
        collapsed={false}
        onToggleCollapse={() => {}}
        panelWidth={300}
        onResize={() => {}}
        previewFile={{
          path: 'D:/PI/app/report.pdf',
          name: 'report.pdf',
          ext: '.pdf',
          type: 'pdf',
          content: [37, 80, 68, 70],
        }}
        onClosePreview={() => {}}
        onOpenExternal={() => {}}
      />,
    )

    await waitFor(() => {
      expect(pdfRenderMock).toHaveBeenCalledTimes(1)
    })

    const stage = document.querySelector('.pv-viewer-stage') as HTMLElement
    Object.defineProperty(stage, 'clientWidth', {
      configurable: true,
      value: 700,
    })

    await act(async () => {
      rerender(
        <PreviewPanel
          collapsed={false}
          onToggleCollapse={() => {}}
          panelWidth={720}
          onResize={() => {}}
          previewFile={{
            path: 'D:/PI/app/report.pdf',
            name: 'report.pdf',
            ext: '.pdf',
            type: 'pdf',
            content: [37, 80, 68, 70],
          }}
          onClosePreview={() => {}}
          onOpenExternal={() => {}}
        />,
      )
      await new Promise((resolve) => window.setTimeout(resolve, 150))
    })

    expect(pdfRenderMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      finishFirstRender?.()
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(pdfRenderMock).toHaveBeenCalledTimes(2)
    })
    expect(screen.queryByText('PDF rendering failed. Use Open for the native viewer if needed.')).toBeNull()
  })

  it('renders docx and xlsx viewer branches', async () => {
    const workbookBytes = Array.from(await createXlsxFixture([
      ['Task', 'Owner'],
      ['Draft', 'Pi'],
    ]))

    const { rerender } = render(
      <PreviewPanel
        collapsed={false}
        onToggleCollapse={() => {}}
        panelWidth={300}
        onResize={() => {}}
        previewFile={{
          path: 'D:/PI/app/brief.docx',
          name: 'brief.docx',
          ext: '.docx',
          type: 'docx',
          content: [1, 2, 3],
          fallbackHtml: '<h1>Fallback Docx</h1>',
        }}
        onClosePreview={() => {}}
        onOpenExternal={() => {}}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Quarterly Brief')).toBeTruthy()
      expect(screen.getByText('Prepared for review.')).toBeTruthy()
    })

    rerender(
      <PreviewPanel
        collapsed={false}
        onToggleCollapse={() => {}}
        panelWidth={300}
        onResize={() => {}}
        previewFile={{
          path: 'D:/PI/app/tracker.xlsx',
          name: 'tracker.xlsx',
          ext: '.xlsx',
          type: 'xlsx',
          content: workbookBytes,
          summary: {
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
          },
        }}
        onClosePreview={() => {}}
        onOpenExternal={() => {}}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Sheet1')).toBeTruthy()
      expect(screen.getByText('Task')).toBeTruthy()
      expect(screen.getByText('Draft')).toBeTruthy()
    })
  })

  it('rerenders docx when the same path receives new content', async () => {
    const { rerender } = render(
      <PreviewPanel
        collapsed={false}
        onToggleCollapse={() => {}}
        panelWidth={300}
        onResize={() => {}}
        previewFile={{
          path: 'D:/PI/app/brief.docx',
          name: 'brief.docx',
          ext: '.docx',
          type: 'docx',
          content: [1, 2, 3],
          fallbackHtml: '<h1>Fallback Docx</h1>',
        }}
        onClosePreview={() => {}}
        onOpenExternal={() => {}}
      />,
    )

    await waitFor(() => {
      expect(docxRenderAsyncMock).toHaveBeenCalledTimes(1)
    })

    rerender(
      <PreviewPanel
        collapsed={false}
        onToggleCollapse={() => {}}
        panelWidth={300}
        onResize={() => {}}
        previewFile={{
          path: 'D:/PI/app/brief.docx',
          name: 'brief.docx',
          ext: '.docx',
          type: 'docx',
          content: [1, 2, 3, 4],
          fallbackHtml: '<h1>Fallback Docx</h1>',
        }}
        onClosePreview={() => {}}
        onOpenExternal={() => {}}
      />,
    )

    await waitFor(() => {
      expect(docxRenderAsyncMock).toHaveBeenCalledTimes(2)
    })
  })

  it('renders an html preview in an iframe and allows source toggle', async () => {
    render(
      <PreviewPanel
        collapsed={false}
        onToggleCollapse={() => {}}
        panelWidth={300}
        onResize={() => {}}
        previewFile={{
          path: 'D:/PI/app/report.html',
          name: 'report.html',
          ext: '.html',
          type: 'text',
          content: '<html><body><h1>Hello HTML</h1></body></html>',
        }}
        onClosePreview={() => {}}
        onOpenExternal={() => {}}
      />,
    )

    expect(screen.getByTitle('report.html')).toBeTruthy()
    fireEvent.click(screen.getByText('Source'))
    expect(screen.getByText(/Hello HTML/)).toBeTruthy()
  })

  it('renders a continuous pptx viewer with loading, controls, and page count', async () => {
    render(
      <PreviewPanel
        collapsed={false}
        onToggleCollapse={() => {}}
        panelWidth={300}
        onResize={() => {}}
        previewFile={{
          path: 'D:/PI/app/slides.pptx',
          name: 'slides.pptx',
          ext: '.pptx',
          type: 'pptx',
          content: [1, 2, 3, 4],
          summary: [{ index: 1, title: 'Intro', summary: 'Overview of the plan' }],
        }}
        onClosePreview={() => {}}
        onOpenExternal={() => {}}
      />,
    )

    await waitFor(() => {
      expect(screen.getByTitle('slides.pptx viewer')).toBeTruthy()
    })

    expect(screen.getByTitle('slides.pptx viewer').closest('.pv-pptx-preview-body')).toBeTruthy()
    expect(screen.getByTitle('slides.pptx viewer').closest('.pv-pptx-shell')).toBeTruthy()

    emitPptxViewerEvent({ type: 'ready' })

    await waitFor(() => {
      expect(screen.getByText('Loading presentation...')).toBeTruthy()
      expect(iframePostMessageMock).toHaveBeenCalled()
    })

    const loadMessage = iframePostMessageMock.mock.calls[0]?.[0] as
      | { type?: string; fileKey?: string; requestId?: number; initialScrollTop?: number }
      | undefined

    expect(loadMessage?.type).toBe('load')
    expect(loadMessage?.initialScrollTop).toBe(0)
    emitPptxViewerEvent({
      type: 'loaded',
      fileKey: loadMessage?.fileKey,
      requestId: loadMessage?.requestId,
      slideCount: 2,
      currentSlide: 0,
      scrollTop: 0,
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Previous slide' })).toBeTruthy()
      expect(screen.getByRole('button', { name: 'Next slide' })).toBeTruthy()
      expect(screen.getByText('1 / 2')).toBeTruthy()
    })
  })

  it('starts pptx loading when the iframe finishes loading even before a ready message arrives', async () => {
    render(
      <PreviewPanel
        collapsed={false}
        onToggleCollapse={() => {}}
        panelWidth={300}
        onResize={() => {}}
        previewFile={{
          path: 'D:/PI/app/slides.pptx',
          name: 'slides.pptx',
          ext: '.pptx',
          type: 'pptx',
          content: [1, 2, 3, 4],
          summary: [{ index: 1, title: 'Intro', summary: 'Overview of the plan' }],
        }}
        onClosePreview={() => {}}
        onOpenExternal={() => {}}
      />,
    )

    const iframe = await screen.findByTitle('slides.pptx viewer')
    await act(async () => {
      fireEvent.load(iframe)
    })

    await waitFor(() => {
      expect(iframePostMessageMock).toHaveBeenCalled()
    })

    const loadMessage = iframePostMessageMock.mock.calls[0]?.[0] as
      | { type?: string; fileKey?: string; requestId?: number }
      | undefined

    expect(loadMessage?.type).toBe('load')
    emitPptxViewerEvent({
      type: 'loaded',
      fileKey: loadMessage?.fileKey,
      requestId: loadMessage?.requestId,
      slideCount: 2,
      currentSlide: 0,
      scrollTop: 0,
    })

    await waitFor(() => {
      expect(screen.getByText('1 / 2')).toBeTruthy()
    })
  })

  it('does not auto-load the same pptx twice when iframe load and ready both fire', async () => {
    render(
      <PreviewPanel
        collapsed={false}
        onToggleCollapse={() => {}}
        panelWidth={300}
        onResize={() => {}}
        previewFile={{
          path: 'D:/PI/app/slides.pptx',
          name: 'slides.pptx',
          ext: '.pptx',
          type: 'pptx',
          content: [1, 2, 3, 4],
          summary: [{ index: 1, title: 'Intro', summary: 'Overview of the plan' }],
        }}
        onClosePreview={() => {}}
        onOpenExternal={() => {}}
      />,
    )

    const iframe = await screen.findByTitle('slides.pptx viewer')
    await act(async () => {
      fireEvent.load(iframe)
    })

    await waitFor(() => {
      expect(iframePostMessageMock).toHaveBeenCalledTimes(1)
    })

    emitPptxViewerEvent({ type: 'ready' })

    await waitFor(() => {
      expect(iframePostMessageMock).toHaveBeenCalledTimes(1)
    })
  })

  it('reloads the pptx document when the same path receives new content', async () => {
    const { rerender } = render(
      <PreviewPanel
        collapsed={false}
        onToggleCollapse={() => {}}
        panelWidth={300}
        onResize={() => {}}
        previewFile={{
          path: 'D:/PI/app/slides.pptx',
          name: 'slides.pptx',
          ext: '.pptx',
          type: 'pptx',
          content: [1, 2, 3, 4],
          summary: [{ index: 1, title: 'Intro', summary: 'Overview of the plan' }],
        }}
        onClosePreview={() => {}}
        onOpenExternal={() => {}}
      />,
    )

    emitPptxViewerEvent({ type: 'ready' })

    await waitFor(() => {
      expect(iframePostMessageMock).toHaveBeenCalledTimes(1)
    })

    rerender(
      <PreviewPanel
        collapsed={false}
        onToggleCollapse={() => {}}
        panelWidth={300}
        onResize={() => {}}
        previewFile={{
          path: 'D:/PI/app/slides.pptx',
          name: 'slides.pptx',
          ext: '.pptx',
          type: 'pptx',
          content: [1, 2, 3, 4, 5],
          summary: [{ index: 1, title: 'Intro', summary: 'Overview of the plan' }],
        }}
        onClosePreview={() => {}}
        onOpenExternal={() => {}}
      />,
    )

    await waitFor(() => {
      expect(iframePostMessageMock).toHaveBeenCalledTimes(2)
    })
  })

  it('navigates pptx slides through the viewer api', async () => {
    render(
      <PreviewPanel
        collapsed={false}
        onToggleCollapse={() => {}}
        panelWidth={300}
        onResize={() => {}}
        previewFile={{
          path: 'D:/PI/app/slides.pptx',
          name: 'slides.pptx',
          ext: '.pptx',
          type: 'pptx',
          content: [1, 2, 3, 4],
          summary: [{ index: 1, title: 'Intro', summary: 'Overview of the plan' }],
        }}
        onClosePreview={() => {}}
        onOpenExternal={() => {}}
      />,
    )

    emitPptxViewerEvent({ type: 'ready' })
    await waitFor(() => {
      expect(iframePostMessageMock).toHaveBeenCalled()
    })

    const loadMessage = iframePostMessageMock.mock.calls[0]?.[0] as
      | { fileKey?: string; requestId?: number }
      | undefined
    emitPptxViewerEvent({
      type: 'loaded',
      fileKey: loadMessage?.fileKey,
      requestId: loadMessage?.requestId,
      slideCount: 2,
      currentSlide: 0,
      scrollTop: 0,
    })

    await waitFor(() => {
      expect(screen.getByText('1 / 2')).toBeTruthy()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Next slide' }))

    const navigateMessage = iframePostMessageMock.mock.calls[1]?.[0] as
      | { type?: string; fileKey?: string; requestId?: number; slideIndex?: number }
      | undefined

    expect(navigateMessage?.type).toBe('navigate')
    expect(navigateMessage?.slideIndex).toBe(1)
    emitPptxViewerEvent({
      type: 'rendered',
      fileKey: navigateMessage?.fileKey,
      requestId: navigateMessage?.requestId,
      slideCount: 2,
      currentSlide: 1,
      scrollTop: 720,
    })

    await waitFor(() => {
      expect(screen.getByText('2 / 2')).toBeTruthy()
    })
  })

  it('falls back to slide summaries when pptx rendering fails', async () => {
    render(
      <PreviewPanel
        collapsed={false}
        onToggleCollapse={() => {}}
        panelWidth={300}
        onResize={() => {}}
        previewFile={{
          path: 'D:/PI/app/slides.pptx',
          name: 'slides.pptx',
          ext: '.pptx',
          type: 'pptx',
          content: [1, 2, 3, 4],
          summary: [
            { index: 1, title: 'Intro', summary: 'Overview of the plan' },
            { index: 2, title: 'Next Step', summary: 'Implementation milestones' },
          ],
        }}
        onClosePreview={() => {}}
        onOpenExternal={() => {}}
      />,
    )

    emitPptxViewerEvent({ type: 'ready' })
    await waitFor(() => {
      expect(iframePostMessageMock).toHaveBeenCalled()
    })

    const loadMessage = iframePostMessageMock.mock.calls[0]?.[0] as
      | { fileKey?: string; requestId?: number }
      | undefined

    emitPptxViewerEvent({
      type: 'error',
      fileKey: loadMessage?.fileKey,
      requestId: loadMessage?.requestId,
      message: 'render failed',
    })

    await waitFor(() => {
      expect(screen.getByText('Slide rendering failed. Showing extracted text instead.')).toBeTruthy()
      expect(screen.getByText('render failed')).toBeTruthy()
    })

    expect(screen.getByText('Slide 1')).toBeTruthy()
    expect(screen.getByText('Overview of the plan')).toBeTruthy()
  })

  it('falls back to docx html when docx-preview fails', async () => {
    docxBehavior = {
      shouldFail: true,
      html: '',
    }

    render(
      <PreviewPanel
        collapsed={false}
        onToggleCollapse={() => {}}
        panelWidth={300}
        onResize={() => {}}
        previewFile={{
          path: 'D:/PI/app/brief.docx',
          name: 'brief.docx',
          ext: '.docx',
          type: 'docx',
          content: [1, 2, 3],
          fallbackHtml: '<h1>Fallback Docx</h1><p>Fallback copy</p>',
        }}
        onClosePreview={() => {}}
        onOpenExternal={() => {}}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('Document rendering failed. Showing HTML fallback instead.')).toBeTruthy()
      const fallbackFrame = screen.getByTitle('brief.docx fallback') as HTMLIFrameElement
      expect(fallbackFrame).toBeTruthy()
      expect(fallbackFrame.getAttribute('sandbox')).toBe('allow-same-origin')
      expect(fallbackFrame.getAttribute('srcdoc')).toContain('Fallback Docx')
      expect(fallbackFrame.getAttribute('srcdoc')).toContain('Fallback copy')
    })
  })

  it('keeps the pptx viewer open when a navigated slide reports a local render failure', async () => {
    render(
      <PreviewPanel
        collapsed={false}
        onToggleCollapse={() => {}}
        panelWidth={300}
        onResize={() => {}}
        previewFile={{
          path: 'D:/PI/app/slides.pptx',
          name: 'slides.pptx',
          ext: '.pptx',
          type: 'pptx',
          content: [1, 2, 3, 4],
          summary: [
            { index: 1, title: 'Intro', summary: 'Overview of the plan' },
            { index: 2, title: 'Next Step', summary: 'Implementation milestones' },
          ],
        }}
        onClosePreview={() => {}}
        onOpenExternal={() => {}}
      />,
    )

    emitPptxViewerEvent({ type: 'ready' })
    await waitFor(() => {
      expect(iframePostMessageMock).toHaveBeenCalledTimes(1)
    })

    const loadMessage = iframePostMessageMock.mock.calls[0]?.[0] as
      | { fileKey?: string; requestId?: number }
      | undefined
    emitPptxViewerEvent({
      type: 'loaded',
      fileKey: loadMessage?.fileKey,
      requestId: loadMessage?.requestId,
      slideCount: 2,
      currentSlide: 0,
      scrollTop: 0,
    })

    await waitFor(() => {
      expect(screen.getByText('1 / 2')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Next slide' }))
    const navigateMessage = iframePostMessageMock.mock.calls[1]?.[0] as
      | { fileKey?: string; requestId?: number }
      | undefined

    emitPptxViewerEvent({
      type: 'slideError',
      fileKey: navigateMessage?.fileKey,
      requestId: navigateMessage?.requestId,
      slideCount: 2,
      currentSlide: 1,
      scrollTop: 720,
      message: 'Slide 2 could not be rendered.',
    })

    await waitFor(() => {
      expect(screen.getByTitle('slides.pptx viewer')).toBeTruthy()
      expect(screen.getByText('2 / 2')).toBeTruthy()
    })

    expect(screen.queryByText('Slide rendering failed. Showing extracted text instead.')).toBeNull()
  })

  it('destroys the pptx viewer when switching away from the file', async () => {
    const { rerender, unmount } = render(
      <PreviewPanel
        collapsed={false}
        onToggleCollapse={() => {}}
        panelWidth={300}
        onResize={() => {}}
        previewFile={{
          path: 'D:/PI/app/slides.pptx',
          name: 'slides.pptx',
          ext: '.pptx',
          type: 'pptx',
          content: [1, 2, 3, 4],
          summary: [{ index: 1, title: 'Intro', summary: 'Overview of the plan' }],
        }}
        onClosePreview={() => {}}
        onOpenExternal={() => {}}
      />,
    )

    emitPptxViewerEvent({ type: 'ready' })
    await waitFor(() => {
      expect(iframePostMessageMock).toHaveBeenCalled()
    })

    const loadMessage = iframePostMessageMock.mock.calls[0]?.[0] as
      | { fileKey?: string; requestId?: number }
      | undefined
    emitPptxViewerEvent({
      type: 'loaded',
      fileKey: loadMessage?.fileKey,
      requestId: loadMessage?.requestId,
      slideCount: 2,
      currentSlide: 0,
      scrollTop: 0,
    })

    await waitFor(() => {
      expect(screen.getByText('1 / 2')).toBeTruthy()
    })

    rerender(
      <PreviewPanel
        collapsed={false}
        onToggleCollapse={() => {}}
        panelWidth={300}
        onResize={() => {}}
        previewFile={{
          path: 'D:/PI/app/notes.md',
          name: 'notes.md',
          ext: '.md',
          type: 'text',
          content: '# Hello Preview',
        }}
        onClosePreview={() => {}}
        onOpenExternal={() => {}}
      />,
    )

    expect(screen.getByText('Hello Preview')).toBeTruthy()

    unmount()
  })

  it('restores the remembered pptx scroll position when reopening the same file', async () => {
    const { rerender } = render(
      <PreviewPanel
        collapsed={false}
        onToggleCollapse={() => {}}
        panelWidth={300}
        onResize={() => {}}
        previewFile={{
          path: 'D:/PI/app/slides.pptx',
          name: 'slides.pptx',
          ext: '.pptx',
          type: 'pptx',
          content: [1, 2, 3, 4],
          summary: [{ index: 1, title: 'Intro', summary: 'Overview of the plan' }],
        }}
        onClosePreview={() => {}}
        onOpenExternal={() => {}}
      />,
    )

    emitPptxViewerEvent({ type: 'ready' })
    await waitFor(() => {
      expect(iframePostMessageMock).toHaveBeenCalledTimes(1)
    })

    const firstLoadMessage = iframePostMessageMock.mock.calls[0]?.[0] as
      | { fileKey?: string; requestId?: number }
      | undefined
    emitPptxViewerEvent({
      type: 'loaded',
      fileKey: firstLoadMessage?.fileKey,
      requestId: firstLoadMessage?.requestId,
      slideCount: 4,
      currentSlide: 1,
      scrollTop: 960,
    })

    await waitFor(() => {
      expect(screen.getByText('2 / 4')).toBeTruthy()
    })

    rerender(
      <PreviewPanel
        collapsed={false}
        onToggleCollapse={() => {}}
        panelWidth={300}
        onResize={() => {}}
        previewFile={{
          path: 'D:/PI/app/notes.md',
          name: 'notes.md',
          ext: '.md',
          type: 'text',
          content: '# Hello Preview',
        }}
        onClosePreview={() => {}}
        onOpenExternal={() => {}}
      />,
    )

    rerender(
      <PreviewPanel
        collapsed={false}
        onToggleCollapse={() => {}}
        panelWidth={300}
        onResize={() => {}}
        previewFile={{
          path: 'D:/PI/app/slides.pptx',
          name: 'slides.pptx',
          ext: '.pptx',
          type: 'pptx',
          content: [1, 2, 3, 4],
          summary: [{ index: 1, title: 'Intro', summary: 'Overview of the plan' }],
        }}
        onClosePreview={() => {}}
        onOpenExternal={() => {}}
      />,
    )

    emitPptxViewerEvent({ type: 'ready' })

    await waitFor(() => {
      expect(iframePostMessageMock).toHaveBeenCalledTimes(2)
    })

    const secondLoadMessage = iframePostMessageMock.mock.calls[1]?.[0] as
      | { initialScrollTop?: number; slideIndex?: number }
      | undefined

    expect(secondLoadMessage?.type).toBe('load')
    expect(secondLoadMessage?.slideIndex).toBe(1)
    expect(secondLoadMessage?.initialScrollTop).toBe(960)
  })

  it('updates the visible pptx page status from iframe scroll events', async () => {
    render(
      <PreviewPanel
        collapsed={false}
        onToggleCollapse={() => {}}
        panelWidth={300}
        onResize={() => {}}
        previewFile={{
          path: 'D:/PI/app/slides.pptx',
          name: 'slides.pptx',
          ext: '.pptx',
          type: 'pptx',
          content: [1, 2, 3, 4],
          summary: [{ index: 1, title: 'Intro', summary: 'Overview of the plan' }],
        }}
        onClosePreview={() => {}}
        onOpenExternal={() => {}}
      />,
    )

    const iframe = await screen.findByTitle('slides.pptx viewer')
    await act(async () => {
      fireEvent.load(iframe)
    })

    await waitFor(() => {
      expect(iframePostMessageMock).toHaveBeenCalledTimes(1)
    })

    const loadMessage = iframePostMessageMock.mock.calls[0]?.[0] as
      | { fileKey?: string; requestId?: number }
      | undefined
    emitPptxViewerEvent({
      type: 'loaded',
      fileKey: loadMessage?.fileKey,
      requestId: loadMessage?.requestId,
      slideCount: 3,
      currentSlide: 0,
      scrollTop: 0,
    })

    await waitFor(() => {
      expect(screen.getByText('1 / 3')).toBeTruthy()
    })

    emitPptxViewerEvent({
      type: 'status',
      fileKey: loadMessage?.fileKey,
      currentSlide: 2,
      slideCount: 3,
      scrollTop: 1880,
    })

    await waitFor(() => {
      expect(screen.getByText('3 / 3')).toBeTruthy()
    })
  })

  it('uses readable controls instead of mojibake glyphs', async () => {
    render(
      <PreviewPanel
        collapsed={false}
        onToggleCollapse={() => {}}
        panelWidth={300}
        onResize={() => {}}
        previewFile={{
          path: 'D:/PI/app/notes.md',
          name: 'notes.md',
          ext: '.md',
          type: 'text',
          content: '# Hello Preview',
        }}
        onClosePreview={() => {}}
        onOpenExternal={() => {}}
      />,
    )

    expect(screen.getByRole('button', { name: 'Open externally' }).textContent).toBe('Open')
    expect(screen.getByRole('button', { name: 'Hide panel' }).textContent).toBe('x')
    expect(screen.getByRole('button', { name: 'Back to results' }).textContent).toBe('Back')
  })

  it('allows nested workspace folders to keep expanding and nested files to be previewed', async () => {
    const toggleDirectory = vi.fn()
    const selectFile = vi.fn()

    render(
      <PreviewPanel
        collapsed={false}
        onToggleCollapse={() => {}}
        panelWidth={360}
        onResize={() => {}}
        currentWorkspace="D:/PI/app"
        workspaceDirectories={[
          {
            name: 'projects',
            path: 'D:/PI/app/projects',
            isDir: true,
            size: 0,
            modifiedAt: new Date().toISOString(),
          },
        ]}
        workspaceChildrenByDir={{
          'D:/PI/app/projects': [
            {
              name: 'client-a',
              path: 'D:/PI/app/projects/client-a',
              isDir: true,
              size: 0,
              modifiedAt: new Date().toISOString(),
            },
          ],
          'D:/PI/app/projects/client-a': [
            {
              name: 'brief.md',
              path: 'D:/PI/app/projects/client-a/brief.md',
              isDir: false,
              size: 120,
              modifiedAt: new Date().toISOString(),
            },
          ],
        }}
        onToggleWorkspaceDirectory={toggleDirectory}
        onSelectFile={selectFile}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'projects' }))
    fireEvent.click(screen.getByRole('button', { name: 'client-a' }))
    fireEvent.click(screen.getByRole('button', { name: 'brief.md' }))

    expect(toggleDirectory).toHaveBeenCalledWith('D:/PI/app/projects')
    expect(toggleDirectory).toHaveBeenCalledWith('D:/PI/app/projects/client-a')
    expect(selectFile).toHaveBeenCalledWith('D:/PI/app/projects/client-a/brief.md')
  })
})
