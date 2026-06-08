const PATCH_FLAG = '__piPptxImageFidelityPatched'

type CanvasLikeContext = {
  globalAlpha: number
}

type GraphicsLike = {
  context?: CanvasLikeContext | null
  m_oContext?: CanvasLikeContext | null
}

type PatchableProcessor = Record<string, any>

function isElement(value: unknown): value is Element {
  return typeof Element !== 'undefined' && value instanceof Element
}

function getLocalName(element: Element): string {
  return element.localName || element.nodeName.split(':').pop() || element.nodeName
}

function walkElements(root: Element): Element[] {
  const elements: Element[] = [root]
  const children = Array.from(root.children)
  for (const child of children) {
    elements.push(...walkElements(child))
  }
  return elements
}

function findFirstDescendant(root: Element, localNames: string[]): Element | null {
  const localNameSet = new Set(localNames)
  return walkElements(root).find((element) => localNameSet.has(getLocalName(element))) || null
}

function readAlphaAttribute(element: Element, attributeNames: string[]): number | null {
  for (const attributeName of attributeNames) {
    const rawValue = element.getAttribute(attributeName)
    if (rawValue == null) continue

    const numericValue = Number.parseInt(rawValue, 10)
    if (!Number.isFinite(numericValue)) continue

    return clampAlpha(numericValue / 100000)
  }

  return null
}

export function clampAlpha(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.min(1, Math.max(0, value))
}

export function extractPptxImageAlpha(root: Element | null | undefined): number | null {
  if (!root) return null

  const alphaModFix = findFirstDescendant(root, ['alphaModFix'])
  if (alphaModFix) {
    const alpha = readAlphaAttribute(alphaModFix, ['amt', 'val'])
    if (alpha != null) return alpha
  }

  const alphaMod = findFirstDescendant(root, ['alphaMod'])
  if (alphaMod) {
    const alpha = readAlphaAttribute(alphaMod, ['val', 'amt'])
    if (alpha != null) return alpha
  }

  const alpha = findFirstDescendant(root, ['alpha'])
  if (alpha) {
    return readAlphaAttribute(alpha, ['val', 'amt'])
  }

  return null
}

export function getGraphicsContext(graphics: unknown): CanvasLikeContext | null {
  const candidate = graphics as GraphicsLike | undefined
  return candidate?.context || candidate?.m_oContext || null
}

export function withCanvasAlpha<T>(
  ctx: CanvasLikeContext | null,
  alpha: number | null,
  draw: () => T,
): T {
  if (!ctx || alpha == null) return draw()

  const previousAlpha = ctx.globalAlpha
  ctx.globalAlpha = previousAlpha * alpha
  try {
    return draw()
  } finally {
    ctx.globalAlpha = previousAlpha
  }
}

export function mergeImageAlpha<T extends Record<string, any> | null | undefined>(
  target: T,
  alpha: number | null,
): T {
  if (!target || alpha == null) return target

  target.effects = {
    ...(target.effects || {}),
    alpha,
  }

  return target
}

function resolveShapeImageAlpha(shape: any): number | null {
  return clampAlpha(
    shape?.imageEffects?.alpha ??
      shape?.effects?.alpha ??
      shape?.imageData?.effects?.alpha ??
      shape?.imageData?.imageEffects?.alpha,
  )
}

function copyBlipFillAlphaToShape(shape: any, shapeElement: unknown): any {
  if (!shape || !isElement(shapeElement)) {
    return shape
  }

  const blipFillElement = findFirstDescendant(shapeElement, ['blipFill'])
  if (!blipFillElement) {
    return shape
  }

  const alpha = extractPptxImageAlpha(blipFillElement)
  if (alpha != null) {
    shape.imageEffects = {
      ...(shape.imageEffects || {}),
      alpha,
    }
    mergeImageAlpha(shape.imageData, alpha)
  }

  return shape
}

function patchParseImageEffects(processor: PatchableProcessor): void {
  if (typeof processor.parseImageEffects !== 'function') return

  const originalParseImageEffects = processor.parseImageEffects
  processor.parseImageEffects = function parseImageEffectsWithAlpha(effectsElement: unknown) {
    const parsedEffects = originalParseImageEffects.call(this, effectsElement)
    const alpha = isElement(effectsElement) ? extractPptxImageAlpha(effectsElement) : null

    if (alpha == null) {
      return parsedEffects
    }

    return {
      ...(parsedEffects || {}),
      alpha,
    }
  }
}

function patchParseBlipFill(processor: PatchableProcessor): void {
  if (typeof processor.parseBlipFill !== 'function') return

  const originalParseBlipFill = processor.parseBlipFill
  processor.parseBlipFill = function parseBlipFillWithAlpha(blipFillElement: unknown) {
    const imageData = originalParseBlipFill.call(this, blipFillElement)
    const alpha = isElement(blipFillElement) ? extractPptxImageAlpha(blipFillElement) : null
    return mergeImageAlpha(imageData, alpha)
  }
}

function patchParseShape(processor: PatchableProcessor): void {
  if (typeof processor.parseShape !== 'function') return

  const originalParseShape = processor.parseShape
  processor.parseShape = function parseShapeWithImageAlpha(shapeElement: unknown) {
    const shape = originalParseShape.call(this, shapeElement)
    return copyBlipFillAlphaToShape(shape, shapeElement)
  }
}

function patchProcessPictureShape(processor: PatchableProcessor): void {
  if (typeof processor.processPictureShape !== 'function') return

  const originalProcessPictureShape = processor.processPictureShape
  processor.processPictureShape = function processPictureShapeWithImageAlpha(shapeElement: unknown) {
    const shape = originalProcessPictureShape.call(this, shapeElement)
    return copyBlipFillAlphaToShape(shape, shapeElement)
  }
}

function patchDrawImageShape(processor: PatchableProcessor): void {
  if (typeof processor.drawImageShape !== 'function') return

  const originalDrawImageShape = processor.drawImageShape
  processor.drawImageShape = function drawImageShapeWithAlpha(
    graphics: unknown,
    shape: any,
    x: number,
    y: number,
    width: number,
    height: number,
  ) {
    const ctx = getGraphicsContext(graphics)
    const alpha = resolveShapeImageAlpha(shape)
    return withCanvasAlpha(ctx, alpha, () =>
      originalDrawImageShape.call(this, graphics, shape, x, y, width, height),
    )
  }
}

function patchDrawPictureShape(processor: PatchableProcessor): void {
  if (typeof processor.drawPictureShape !== 'function') return

  const originalDrawPictureShape = processor.drawPictureShape
  processor.drawPictureShape = function drawPictureShapeWithAlpha(shape: any, bounds: unknown) {
    const ctx = getGraphicsContext(this?.graphics)
    const alpha = resolveShapeImageAlpha(shape)
    return withCanvasAlpha(ctx, alpha, () => originalDrawPictureShape.call(this, shape, bounds))
  }
}

function patchDrawBackgroundImage(processor: PatchableProcessor): void {
  if (typeof processor.drawBackgroundImage !== 'function') return

  const originalDrawBackgroundImage = processor.drawBackgroundImage
  processor.drawBackgroundImage = function drawBackgroundImageWithAlpha(
    graphics: unknown,
    image: unknown,
    imageData: any,
    canvasRect: unknown,
  ) {
    const ctx = getGraphicsContext(graphics)
    const alpha = clampAlpha(imageData?.effects?.alpha ?? imageData?.imageEffects?.alpha)
    return withCanvasAlpha(ctx, alpha, () =>
      originalDrawBackgroundImage.call(this, graphics, image, imageData, canvasRect),
    )
  }
}

export function patchPptxProcessorForImageFidelity(processor: unknown): void {
  const patchableProcessor = processor as PatchableProcessor | null | undefined
  if (!patchableProcessor || patchableProcessor[PATCH_FLAG]) return

  Object.defineProperty(patchableProcessor, PATCH_FLAG, {
    value: true,
    enumerable: false,
    configurable: false,
  })

  patchParseImageEffects(patchableProcessor)
  patchParseBlipFill(patchableProcessor)
  patchParseShape(patchableProcessor)
  patchProcessPictureShape(patchableProcessor)
  patchDrawImageShape(patchableProcessor)
  patchDrawPictureShape(patchableProcessor)
  patchDrawBackgroundImage(patchableProcessor)
}
