import 'chart.js/auto'
import { PPTXViewer } from 'pptxviewjs'
import { calculatePptxSlideDisplaySize } from './lib/pptx-layout'

type ViewerMessage =
  | {
      source: 'pi-pptx-preview'
      type: 'load'
      fileKey: string
      requestId: number
      slideIndex: number
      initialScrollTop?: number
      content: number[]
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
      type: 'loaded' | 'rendered' | 'status'
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
    'body { font-family: "JetBrains Mono", monospace; color: rgba(255,255,255,0.72); }',
    `#${VIEWER_ROOT_ID} { height: 100%; }`,
    '.pptx-scroll { height: 100%; overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; padding: 8px 8px 22px; box-sizing: border-box; }',
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

function syncSlideCanvasDisplay(entry: SlideEntry): boolean {
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

  if (entry.state !== 'ready') {
    const pixelRatio = window.devicePixelRatio || 1
    entry.canvas.width = Math.max(1, Math.round(nextSize.width * pixelRatio))
    entry.canvas.height = Math.max(1, Math.round(nextSize.height * pixelRatio))
  }

  return true
}

function syncAllSlideCanvasDisplay(markReadySlidesForRerender = false): boolean {
  let didResizeAnyCanvas = false

  for (const entry of slideEntries) {
    const didChange = syncSlideCanvasDisplay(entry)
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

function postViewerState(type: 'loaded' | 'rendered' | 'status', requestId?: number): void {
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
      await viewer.renderSlide(index, entry.canvas)

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

  await viewer.loadFile(Uint8Array.from(message.content))

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

  await ensureSlideRendered(targetSlide, { critical: true, sessionId })
  scrollToSlide(targetSlide)
  await waitForFrame()

  scheduleVisibleRender(sessionId)
  postViewerState('rendered', message.requestId)
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
