import 'chart.js/auto'
import { PPTXViewer } from 'pptxviewjs'
import {
  clampAlpha,
  patchPptxProcessorForImageFidelity,
  withCanvasAlpha,
} from './lib/pptx-fidelity'
import { calculatePptxSlideDisplaySize } from './lib/pptx-layout'

type ViewerMessage =
  | {
      source: 'pi-pptx-preview'
      type: 'load'
      fileKey: string
      requestId: number
      slideIndex: number
      initialScrollTop?: number
      content: Uint8Array | number[]
    }
  | {
      source: 'pi-pptx-preview'
      type: 'navigate'
      fileKey: string
      requestId: number
      slideIndex: number
    }

type ViewerResponse =
  | {
      source: 'pi-pptx-preview'
      type: 'ready'
    }
  | {
      source: 'pi-pptx-preview'
      type: 'loaded' | 'rendered' | 'status' | 'slideError'
      fileKey: string
      requestId?: number
      slideCount: number
      currentSlide: number
      scrollTop: number
    }
  | {
      source: 'pi-pptx-preview'
      type: 'error'
      fileKey: string
      requestId?: number
      message: string
    }

interface ViewerShell {
  root: HTMLElement
  scrollContainer: HTMLDivElement
  slidesHost: HTMLDivElement
}

interface SlideEntry {
  index: number
  section: HTMLDivElement
  label: HTMLDivElement
  card: HTMLDivElement
  canvas: HTMLCanvasElement
  note: HTMLDivElement
  pendingPromise: Promise<void> | null
  state: 'idle' | 'rendering' | 'ready' | 'failed'
}

const VIEWER_CHANNEL = 'pi-pptx-preview'
const VIEWER_ROOT_ID = 'pptx-viewer-root'
const DEFAULT_SLIDE_RATIO = 16 / 9
const PLACEHOLDER_CANVAS_WIDTH = 1600
const VISIBLE_RENDER_NEIGHBOR_RANGE = 1
const VIEWPORT_RENDER_MARGIN = 1.25
const PPTX_RENDER_OPTIONS = {
  quality: 'high' as const,
  scale: 1,
}

let viewer: PPTXViewer | null = null
let viewerShell: ViewerShell | null = null
let activeFileKey = ''
let activeSessionId = 0
let slideCount = 0
let slideEntries: SlideEntry[] = []
let renderQueue = Promise.resolve()
let slideAspectRatio = DEFAULT_SLIDE_RATIO
let statusFrameId: number | null = null
let lazyRenderFrameId: number | null = null
let lastStatusKey = ''
let resizeObserver: ResizeObserver | null = null

function resolveSlideBackgroundFill(drawingDocument: any, slide: any): any {
  if (slide?.backgroundFill) {
    return drawingDocument.getBackgroundColor(slide.backgroundFill)
  }
  if (slide?.layout?.commonSlideData?.backgroundFill) {
    return drawingDocument.getBackgroundColor(slide.layout.commonSlideData.backgroundFill)
  }
  if (slide?.layout?.cSld?.bg) {
    return drawingDocument.getBackgroundColor(slide.layout.cSld.bg)
  }
  if (slide?.layout?.master?.commonSlideData?.backgroundFill) {
    return drawingDocument.getBackgroundColor(slide.layout.master.commonSlideData.backgroundFill)
  }

  const theme = slide?.layout?.master?.theme
  if (theme?.colors?.bg1) return theme.colors.bg1
  if (theme?.colors?.bg2) return theme.colors.bg2
  return null
}

function getPptxProcessorPatchTargets(viewerInstance: PPTXViewer): any[] {
  const rootProcessor = (viewerInstance as PPTXViewer & { processor?: any }).processor
  const targets = [
    rootProcessor,
    rootProcessor?.processor,
    rootProcessor?.drawingDocument,
    rootProcessor?.processor?.drawingDocument,
  ].filter(Boolean)
  return Array.from(new Set(targets))
}

function patchDrawingDocumentBackground(processor: any): void {
  const drawingDocument = processor.drawingDocument
  if (!drawingDocument || drawingDocument.__piBackgroundAlphaPatched) return

  if (drawingDocument && typeof drawingDocument.drawSlideBackground === 'function') {
    drawingDocument.__piBackgroundAlphaPatched = true
    drawingDocument.drawSlideBackground = function drawSlideBackgroundWithAlpha(slide: any) {
      if (!this.graphics || !this.graphics.context) return

      const ctx = this.graphics.context as CanvasRenderingContext2D
      const backgroundFill = resolveSlideBackgroundFill(this, slide)

      if (this.coordinateSystem) {
        const { scale, offsetX, offsetY } = this.coordinateSystem
        const slideWidthPx = this.coordinateSystem.slideWidthPx
        const slideHeightPx = this.coordinateSystem.slideHeightPx
        const actualSlideWidth = Math.round(slideWidthPx * scale)
        const actualSlideHeight = Math.round(slideHeightPx * scale)
        const snappedOffsetX = Math.round(offsetX)
        const snappedOffsetY = Math.round(offsetY)

        ctx.save()
        try {
          if (backgroundFill && backgroundFill.type === 'image' && backgroundFill.imageData?.relationshipId) {
            const cacheKey =
              backgroundFill.imageData.resolvedCacheKey || backgroundFill.imageData.relationshipId
            const imageEntry = this.processor?.imageCache?.get(cacheKey)
            const alpha = clampAlpha(backgroundFill.imageData?.effects?.alpha)

            if (imageEntry?.image) {
              withCanvasAlpha(ctx, alpha, () => {
                ctx.drawImage(
                  imageEntry.image,
                  snappedOffsetX,
                  snappedOffsetY,
                  actualSlideWidth,
                  actualSlideHeight,
                )
              })
              return
            }

            ctx.fillStyle = '#ffffff'
          } else if (backgroundFill && backgroundFill.type === 'gradient' && backgroundFill.gradient) {
            const gradient = backgroundFill.gradient
            const stops = gradient.stops || []
            let canvasGradient: CanvasGradient

            if (gradient.type === 'radial') {
              const centerX = snappedOffsetX + actualSlideWidth / 2
              const centerY = snappedOffsetY + actualSlideHeight / 2
              const radius = Math.max(actualSlideWidth, actualSlideHeight) / 2
              canvasGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius)
            } else {
              const angle = (gradient.angle || 0) * Math.PI / 180
              const cos = Math.cos(angle)
              const sin = Math.sin(angle)
              const x0 = snappedOffsetX + actualSlideWidth / 2 - cos * actualSlideWidth / 2
              const y0 = snappedOffsetY + actualSlideHeight / 2 - sin * actualSlideHeight / 2
              const x1 = snappedOffsetX + actualSlideWidth / 2 + cos * actualSlideWidth / 2
              const y1 = snappedOffsetY + actualSlideHeight / 2 + sin * actualSlideHeight / 2
              canvasGradient = ctx.createLinearGradient(x0, y0, x1, y1)
            }

            for (const stop of stops) {
              const position = stop.position !== undefined ? stop.position / 100000 : 0
              const color = this.parseColorToHex(stop.color) || '#ffffff'
              canvasGradient.addColorStop(Math.min(1, Math.max(0, position)), color)
            }
            ctx.fillStyle = canvasGradient
          } else {
            ctx.fillStyle = (typeof backgroundFill === 'string' ? backgroundFill : null) || '#ffffff'
          }

          ctx.fillRect(snappedOffsetX, snappedOffsetY, actualSlideWidth, actualSlideHeight)
        } finally {
          ctx.restore()
        }
        return
      }

      ctx.save()
      try {
        if (backgroundFill && backgroundFill.type === 'image' && backgroundFill.imageData?.relationshipId) {
          const cacheKey =
            backgroundFill.imageData.resolvedCacheKey || backgroundFill.imageData.relationshipId
          const imageEntry = this.processor?.imageCache?.get(cacheKey)
          const alpha = clampAlpha(backgroundFill.imageData?.effects?.alpha)

          if (imageEntry?.image) {
            withCanvasAlpha(ctx, alpha, () => {
              ctx.drawImage(imageEntry.image, 0, 0, this.canvas.width, this.canvas.height)
            })
            return
          }

          ctx.fillStyle = '#ffffff'
        } else {
          ctx.fillStyle = (typeof backgroundFill === 'string' ? backgroundFill : null) || '#ffffff'
        }

        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
      } finally {
        ctx.restore()
      }
    }
  }
}

function installPptxViewerFidelityPatches(viewerInstance: PPTXViewer): void {
  for (const processor of getPptxProcessorPatchTargets(viewerInstance)) {
    patchPptxProcessorForImageFidelity(processor)
    patchDrawingDocumentBackground(processor)
  }
}

function postToParent(message: ViewerResponse): void {
  window.parent.postMessage(message, '*')
}

function clampSlideIndex(slideIndex: number): number {
  if (slideCount <= 0) return 0
  return Math.max(0, Math.min(slideIndex, slideCount - 1))
}

function waitForFrame(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => resolve())
  })
}

function cancelScheduledFrames(): void {
  if (statusFrameId !== null) {
    window.cancelAnimationFrame(statusFrameId)
    statusFrameId = null
  }

  if (lazyRenderFrameId !== null) {
    window.cancelAnimationFrame(lazyRenderFrameId)
    lazyRenderFrameId = null
  }
}

function detachShell(): void {
  if (viewerShell) {
    viewerShell.scrollContainer.removeEventListener('scroll', handleScroll, { passive: true } as EventListenerOptions)
  }
  resizeObserver?.disconnect()
  resizeObserver = null
  viewerShell = null
}

function destroyViewer(): void {
  cancelScheduledFrames()
  detachShell()
  viewer?.destroy()
  viewer = null
  slideEntries = []
  slideCount = 0
  slideAspectRatio = DEFAULT_SLIDE_RATIO
  lastStatusKey = ''
  renderQueue = Promise.resolve()
}

function createShell(): ViewerShell {
  const root = document.getElementById(VIEWER_ROOT_ID)
  if (!root) {
    throw new Error('Viewer root is missing.')
  }

  root.innerHTML = [
    '<style>',
    'html, body { margin: 0; height: 100%; overflow: hidden; background: #1a1919; }',
    'body { font-family: SimSun, "Songti SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif; color: rgba(255,255,255,0.72); }',
    `#${VIEWER_ROOT_ID} { height: 100%; }`,
    '.pptx-scroll { height: 100%; overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; padding: 8px 8px 22px; box-sizing: border-box; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.28) rgba(255,255,255,0.04); }',
    '.pptx-scroll::-webkit-scrollbar { width: 10px; }',
    '.pptx-scroll::-webkit-scrollbar-track { background: rgba(255,255,255,0.035); border-radius: 999px; }',
    '.pptx-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.24); border: 2px solid #1a1919; border-radius: 999px; }',
    '.pptx-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.34); }',
    '.pptx-slide-list { display: flex; flex-direction: column; gap: 14px; }',
    '.pptx-slide { display: flex; flex-direction: column; gap: 8px; }',
    '.pptx-slide-meta { display: flex; justify-content: space-between; align-items: center; padding: 0 4px; font-size: 10px; letter-spacing: 0.04em; color: rgba(255,255,255,0.24); }',
    '.pptx-slide-card { display: flex; justify-content: center; align-items: center; width: 100%; padding: 6px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.05); background: linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.018)); box-shadow: inset 0 1px 0 rgba(255,255,255,0.03); overflow: hidden; }',
    '.pptx-slide-card.is-failed { border-color: rgba(255,94,94,0.16); background: rgba(255,94,94,0.04); }',
    '.pptx-slide-canvas { display: block; max-width: 100%; background: #ffffff; border-radius: 12px; box-shadow: 0 20px 48px rgba(0,0,0,0.26); }',
    '.pptx-slide-note { min-height: 18px; padding: 0 6px; font-size: 11px; line-height: 1.6; color: rgba(255,255,255,0.32); }',
    '.pptx-slide-note[data-state="failed"] { color: rgba(255,194,194,0.9); }',
    '.pptx-slide-note[data-state="loading"] { color: rgba(255,255,255,0.28); }',
    '.pptx-slide-note[data-state="ready"] { color: transparent; }',
    '</style>',
    '<div class="pptx-scroll">',
    '  <div class="pptx-slide-list"></div>',
    '</div>',
  ].join('')

  const scrollContainer = root.querySelector('.pptx-scroll') as HTMLDivElement | null
  const slidesHost = root.querySelector('.pptx-slide-list') as HTMLDivElement | null

  if (!scrollContainer || !slidesHost) {
    throw new Error('Viewer shell could not be created.')
  }

  scrollContainer.addEventListener('scroll', handleScroll, { passive: true })

  viewerShell = {
    root,
    scrollContainer,
    slidesHost,
  }

  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      handleViewerResize()
    })
    resizeObserver.observe(scrollContainer)
  }

  return viewerShell
}

function setCanvasPlaceholderSize(canvas: HTMLCanvasElement, ratio = slideAspectRatio): void {
  canvas.width = PLACEHOLDER_CANVAS_WIDTH
  canvas.height = Math.max(1, Math.round(PLACEHOLDER_CANVAS_WIDTH / ratio))
}

function updateSlideAspectRatio(width: number, height: number): void {
  if (width <= 0 || height <= 0) return

  slideAspectRatio = width / height
  for (const entry of slideEntries) {
    if (entry.state === 'ready') continue
    setCanvasPlaceholderSize(entry.canvas, slideAspectRatio)
  }
}

function getElementHorizontalPadding(element: HTMLElement): number {
  const computed = window.getComputedStyle(element)
  const left = Number.parseFloat(computed.paddingLeft || '0')
  const right = Number.parseFloat(computed.paddingRight || '0')
  return (Number.isFinite(left) ? left : 0) + (Number.isFinite(right) ? right : 0)
}

function syncSlideCanvasDisplay(entry: SlideEntry, resizeReadyCanvas = false): boolean {
  const availableWidth = entry.card.clientWidth || viewerShell?.scrollContainer.clientWidth || window.innerWidth
  const cardPadding = getElementHorizontalPadding(entry.card)
  const nextSize = calculatePptxSlideDisplaySize({
    containerWidth: availableWidth,
    aspectRatio: slideAspectRatio,
    horizontalPadding: cardPadding,
  })

  const nextWidth = `${nextSize.width}px`
  const nextHeight = `${nextSize.height}px`
  const didChange =
    entry.canvas.style.width !== nextWidth ||
    entry.canvas.style.height !== nextHeight ||
    entry.canvas.width === 0 ||
    entry.canvas.height === 0

  if (!didChange) {
    return false
  }

  entry.canvas.style.width = nextWidth
  entry.canvas.style.height = nextHeight

  if (entry.state !== 'ready' || resizeReadyCanvas) {
    const pixelRatio = window.devicePixelRatio || 1
    entry.canvas.width = Math.max(1, Math.round(nextSize.width * pixelRatio))
    entry.canvas.height = Math.max(1, Math.round(nextSize.height * pixelRatio))
  }

  return true
}

function syncAllSlideCanvasDisplay(markReadySlidesForRerender = false): boolean {
  let didResizeAnyCanvas = false

  for (const entry of slideEntries) {
    const didChange = syncSlideCanvasDisplay(entry, markReadySlidesForRerender)
    if (!didChange) {
      continue
    }

    didResizeAnyCanvas = true
    if (markReadySlidesForRerender && entry.state === 'ready') {
      entry.state = 'idle'
      entry.note.dataset.state = 'ready'
      entry.note.textContent = 'Rendered'
    }
  }

  return didResizeAnyCanvas
}

function setSlideState(entry: SlideEntry, state: SlideEntry['state'], message?: string): void {
  entry.state = state
  entry.card.classList.toggle('is-failed', state === 'failed')

  if (state === 'failed') {
    entry.note.dataset.state = 'failed'
    entry.note.textContent = message || `Slide ${entry.index + 1} could not be rendered.`
    return
  }

  if (state === 'rendering') {
    entry.note.dataset.state = 'loading'
    entry.note.textContent = 'Rendering slide...'
    return
  }

  if (state === 'ready') {
    entry.note.dataset.state = 'ready'
    entry.note.textContent = 'Rendered'
    return
  }

  entry.note.dataset.state = 'idle'
  entry.note.textContent = 'Waiting to render...'
}

function buildSlideEntries(count: number): void {
  if (!viewerShell) {
    throw new Error('Viewer shell is unavailable.')
  }

  viewerShell.slidesHost.innerHTML = ''
  slideEntries = []

  for (let index = 0; index < count; index += 1) {
    const section = document.createElement('div')
    section.className = 'pptx-slide'
    section.dataset.slideIndex = String(index)

    const label = document.createElement('div')
    label.className = 'pptx-slide-meta'
    label.textContent = `Slide ${index + 1}`

    const card = document.createElement('div')
    card.className = 'pptx-slide-card'

    const canvas = document.createElement('canvas')
    canvas.className = 'pptx-slide-canvas'
    setCanvasPlaceholderSize(canvas)

    const note = document.createElement('div')
    note.className = 'pptx-slide-note'

    card.appendChild(canvas)
    section.appendChild(label)
    section.appendChild(card)
    section.appendChild(note)
    viewerShell.slidesHost.appendChild(section)

    const entry: SlideEntry = {
      index,
      section,
      label,
      card,
      canvas,
      note,
      pendingPromise: null,
      state: 'idle',
    }

    setSlideState(entry, 'idle')
    syncSlideCanvasDisplay(entry)
    slideEntries.push(entry)
  }
}

function handleViewerResize(): void {
  const didResizeAnyCanvas = syncAllSlideCanvasDisplay(true)
  if (!didResizeAnyCanvas) {
    return
  }

  scheduleVisibleRender(activeSessionId)
  scheduleStatusPost()
}

function getCurrentSlideFromScroll(): number {
  if (!viewerShell || slideEntries.length === 0) return 0

  const { scrollTop, clientHeight } = viewerShell.scrollContainer
  const probeLine = scrollTop + clientHeight * 0.38
  let closestIndex = 0
  let closestDistance = Number.POSITIVE_INFINITY

  for (const entry of slideEntries) {
    const top = entry.section.offsetTop
    const height = entry.section.offsetHeight
    const bottom = top + height

    if (probeLine >= top && probeLine <= bottom) {
      return entry.index
    }

    const midpoint = top + height / 2
    const distance = Math.abs(midpoint - probeLine)
    if (distance < closestDistance) {
      closestDistance = distance
      closestIndex = entry.index
    }
  }

  return closestIndex
}

function buildStatusKey(currentSlide: number, scrollTop: number): string {
  return `${activeFileKey}:${slideCount}:${currentSlide}:${Math.round(scrollTop)}`
}

function postViewerState(type: 'loaded' | 'rendered' | 'status' | 'slideError', requestId?: number): void {
  if (!viewerShell || !activeFileKey) return

  const currentSlide = getCurrentSlideFromScroll()
  const scrollTop = viewerShell.scrollContainer.scrollTop

  if (type === 'status') {
    const nextStatusKey = buildStatusKey(currentSlide, scrollTop)
    if (nextStatusKey === lastStatusKey) {
      return
    }
    lastStatusKey = nextStatusKey
  } else {
    lastStatusKey = buildStatusKey(currentSlide, scrollTop)
  }

  postToParent({
    source: VIEWER_CHANNEL,
    type,
    fileKey: activeFileKey,
    requestId,
    slideCount,
    currentSlide,
    scrollTop,
  })
}

function scheduleStatusPost(): void {
  if (statusFrameId !== null) return

  statusFrameId = window.requestAnimationFrame(() => {
    statusFrameId = null
    postViewerState('status')
  })
}

function enqueueRender(task: () => Promise<void>): Promise<void> {
  const queuedTask = renderQueue.then(task, task)
  renderQueue = queuedTask.then(
    () => undefined,
    () => undefined,
  )
  return queuedTask
}

function getSlideEntry(slideIndex: number): SlideEntry {
  const entry = slideEntries[slideIndex]
  if (!entry) {
    throw new Error(`Slide ${slideIndex + 1} is unavailable.`)
  }
  return entry
}

function isSlideReady(entry: SlideEntry): boolean {
  return entry.state === 'ready'
}

async function ensureSlideRendered(
  slideIndex: number,
  options: { critical: boolean; sessionId: number },
): Promise<void> {
  const index = clampSlideIndex(slideIndex)
  const entry = getSlideEntry(index)

  if (entry.state === 'ready') {
    return
  }

  if (entry.state === 'failed') {
    if (options.critical) {
      throw new Error(`Slide ${index + 1} could not be rendered.`)
    }
    return
  }

  if (entry.pendingPromise) {
    await entry.pendingPromise
    if (options.critical && !isSlideReady(entry)) {
      throw new Error(`Slide ${index + 1} could not be rendered.`)
    }
    return
  }

  const renderTask = enqueueRender(async () => {
    if (options.sessionId !== activeSessionId || !viewer) return

    setSlideState(entry, 'rendering')

    try {
      await viewer.renderSlide(index, entry.canvas, PPTX_RENDER_OPTIONS)

      if (options.sessionId !== activeSessionId) return

      setSlideState(entry, 'ready')
      updateSlideAspectRatio(entry.canvas.width, entry.canvas.height)
      syncAllSlideCanvasDisplay(false)
    } catch (error) {
      if (options.sessionId !== activeSessionId) return

      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : `Slide ${index + 1} could not be rendered.`
      setSlideState(entry, 'failed', message)

      if (options.critical) {
        throw error
      }
    } finally {
      entry.pendingPromise = null
    }
  })

  entry.pendingPromise = renderTask
  await renderTask

  if (options.critical && !isSlideReady(entry)) {
    throw new Error(`Slide ${index + 1} could not be rendered.`)
  }
}

function getSlidesNearViewport(): number[] {
  if (!viewerShell || slideEntries.length === 0) return []

  const { scrollTop, clientHeight } = viewerShell.scrollContainer
  const viewportTop = scrollTop - clientHeight * VIEWPORT_RENDER_MARGIN
  const viewportBottom = scrollTop + clientHeight * (1 + VIEWPORT_RENDER_MARGIN)
  const indices = new Set<number>()
  const focusSlide = getCurrentSlideFromScroll()

  for (const entry of slideEntries) {
    const top = entry.section.offsetTop
    const bottom = top + entry.section.offsetHeight
    if (bottom >= viewportTop && top <= viewportBottom) {
      indices.add(entry.index)
    }
  }

  for (let offset = -VISIBLE_RENDER_NEIGHBOR_RANGE; offset <= VISIBLE_RENDER_NEIGHBOR_RANGE; offset += 1) {
    const nextIndex = focusSlide + offset
    if (nextIndex >= 0 && nextIndex < slideCount) {
      indices.add(nextIndex)
    }
  }

  return Array.from(indices).sort((left, right) => left - right)
}

async function renderVisibleSlides(sessionId: number): Promise<void> {
  const targetSlides = getSlidesNearViewport()

  for (const slideIndex of targetSlides) {
    if (sessionId !== activeSessionId) return
    await ensureSlideRendered(slideIndex, { critical: false, sessionId })
  }
}

function scheduleVisibleRender(sessionId: number): void {
  if (lazyRenderFrameId !== null) return

  lazyRenderFrameId = window.requestAnimationFrame(() => {
    lazyRenderFrameId = null
    void renderVisibleSlides(sessionId)
  })
}

function scrollToSlide(slideIndex: number): void {
  if (!viewerShell) return

  const entry = slideEntries[clampSlideIndex(slideIndex)]
  if (!entry) return

  const nextTop = Math.max(0, entry.section.offsetTop - 4)
  viewerShell.scrollContainer.scrollTo({
    top: nextTop,
    behavior: 'auto',
  })
}

function restoreScrollPosition(initialScrollTop: number | undefined, slideIndex: number): void {
  if (!viewerShell) return

  if (typeof initialScrollTop === 'number' && initialScrollTop > 0) {
    viewerShell.scrollContainer.scrollTop = initialScrollTop
    return
  }

  scrollToSlide(slideIndex)
}

function handleScroll(): void {
  scheduleVisibleRender(activeSessionId)
  scheduleStatusPost()
}

async function handleLoadMessage(message: Extract<ViewerMessage, { type: 'load' }>): Promise<void> {
  destroyViewer()

  activeSessionId += 1
  activeFileKey = message.fileKey
  const sessionId = activeSessionId

  createShell()

  viewer = new PPTXViewer({
    slideSizeMode: 'fit',
    backgroundColor: '#ffffff',
  })

  await (viewer as PPTXViewer & { _initializeProcessor?: () => Promise<unknown> })._initializeProcessor?.()
  installPptxViewerFidelityPatches(viewer)
  await viewer.loadFile(message.content instanceof Uint8Array ? message.content : Uint8Array.from(message.content))
  installPptxViewerFidelityPatches(viewer)

  if (sessionId !== activeSessionId || !viewer) return

  slideCount = viewer.getSlideCount()
  if (slideCount <= 0) {
    throw new Error('This presentation does not contain any slides.')
  }

  buildSlideEntries(slideCount)

  const targetSlide = clampSlideIndex(message.slideIndex)
  await ensureSlideRendered(targetSlide, { critical: true, sessionId })

  const initialSlides = Array.from(
    new Set(
      [targetSlide - 1, targetSlide + 1].filter(
        (slideIndex) => slideIndex >= 0 && slideIndex < slideCount,
      ),
    ),
  )

  await Promise.allSettled(
    initialSlides.map((slideIndex) =>
      ensureSlideRendered(slideIndex, {
        critical: false,
        sessionId,
      }),
    ),
  )

  restoreScrollPosition(message.initialScrollTop, targetSlide)
  await waitForFrame()

  scheduleVisibleRender(sessionId)
  postViewerState('loaded', message.requestId)
}

async function handleNavigateMessage(message: Extract<ViewerMessage, { type: 'navigate' }>): Promise<void> {
  if (!viewer || activeFileKey !== message.fileKey) {
    throw new Error('Presentation viewer is not ready for navigation yet.')
  }

  const sessionId = activeSessionId
  const targetSlide = clampSlideIndex(message.slideIndex)

  await ensureSlideRendered(targetSlide, { critical: false, sessionId })
  scrollToSlide(targetSlide)
  await waitForFrame()

  scheduleVisibleRender(sessionId)
  const targetEntry = slideEntries[targetSlide]
  postViewerState(targetEntry?.state === 'failed' ? 'slideError' : 'rendered', message.requestId)
}

window.addEventListener('message', (event: MessageEvent<ViewerMessage>) => {
  const message = event.data
  if (!message || message.source !== VIEWER_CHANNEL) return

  const run = async () => {
    if (message.type === 'load') {
      await handleLoadMessage(message)
      return
    }

    if (message.type === 'navigate') {
      await handleNavigateMessage(message)
    }
  }

  void run().catch((error) => {
    postToParent({
      source: VIEWER_CHANNEL,
      type: 'error',
      fileKey: message.fileKey || activeFileKey,
      requestId: message.requestId,
      message:
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : 'This presentation could not be rendered in the viewer.',
    })
  })
})

window.addEventListener('load', () => {
  createShell()
  postToParent({
    source: VIEWER_CHANNEL,
    type: 'ready',
  })
})

window.addEventListener('beforeunload', () => {
  destroyViewer()
  activeFileKey = ''
})
