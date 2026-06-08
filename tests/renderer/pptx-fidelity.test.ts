import { describe, expect, it, vi } from 'vitest'

import {
  extractPptxImageAlpha,
  patchPptxProcessorForImageFidelity,
  withCanvasAlpha,
} from '../../src/renderer/src/lib/pptx-fidelity'

function parseXml(source: string): Element {
  const document = new DOMParser().parseFromString(source, 'application/xml')
  const error = document.querySelector('parsererror')
  if (error) {
    throw new Error(error.textContent || 'Invalid XML fixture')
  }
  return document.documentElement
}

describe('pptx fidelity helpers', () => {
  it('extracts alpha from alphaModFix amt values', () => {
    const element = parseXml('<a:blip xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:alphaModFix amt="15000"/></a:blip>')

    expect(extractPptxImageAlpha(element)).toBe(0.15)
  })

  it('extracts alpha from alphaMod val values', () => {
    const element = parseXml('<a:effects xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:alphaMod val="30000"/></a:effects>')

    expect(extractPptxImageAlpha(element)).toBe(0.3)
  })

  it('extracts alpha from alphaMod amt values', () => {
    const element = parseXml('<a:effectLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:alphaMod amt="30000"/></a:effectLst>')

    expect(extractPptxImageAlpha(element)).toBe(0.3)
  })

  it('extracts alpha from alpha val values', () => {
    const element = parseXml('<a:blip xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:alpha val="20000"/></a:blip>')

    expect(extractPptxImageAlpha(element)).toBe(0.2)
  })

  it('returns null when no image alpha is present', () => {
    const element = parseXml('<a:blip xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:lum bright="0"/></a:blip>')

    expect(extractPptxImageAlpha(element)).toBeNull()
  })

  it('applies canvas alpha only while drawing and restores the previous value', () => {
    const ctx = { globalAlpha: 0.8 } as CanvasRenderingContext2D
    const draw = vi.fn(() => ctx.globalAlpha)

    const alphaDuringDraw = withCanvasAlpha(ctx, 0.25, draw)

    expect(alphaDuringDraw).toBe(0.2)
    expect(ctx.globalAlpha).toBe(0.8)
  })

  it('patches image drawing once so repeated installs do not compound alpha', () => {
    const alphaDuringDraw: number[] = []
    const drawImageShape = vi.fn((graphics: { context: { globalAlpha: number } }) => {
      alphaDuringDraw.push(graphics.context.globalAlpha)
    })
    const processor = { drawImageShape }
    const graphics = { context: { globalAlpha: 1 } }
    const shape = { imageEffects: { alpha: 0.5 } }

    patchPptxProcessorForImageFidelity(processor)
    patchPptxProcessorForImageFidelity(processor)

    processor.drawImageShape(graphics, shape, 0, 0, 100, 100)

    expect(drawImageShape).toHaveBeenCalledTimes(1)
    expect(alphaDuringDraw).toEqual([0.5])
    expect(graphics.context.globalAlpha).toBe(1)
  })

  it('patches parseImageEffects to preserve existing effects and add alpha', () => {
    const processor = {
      parseImageEffects: vi.fn(() => ({ brightness: 10 })),
    }
    const effects = parseXml('<a:effects xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:alphaModFix amt="15000"/></a:effects>')

    patchPptxProcessorForImageFidelity(processor)

    expect(processor.parseImageEffects(effects)).toEqual({
      brightness: 10,
      alpha: 0.15,
    })
  })

  it('patches parseBlipFill to copy direct blip alpha into imageData effects', () => {
    const processor = {
      parseBlipFill: vi.fn(() => ({ relationshipId: 'rId4' })),
    }
    const blipFill = parseXml([
      '<p:blipFill xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">',
      '  <a:blip r:embed="rId4" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
      '    <a:alphaModFix amt="15000"/>',
      '  </a:blip>',
      '</p:blipFill>',
    ].join(''))

    patchPptxProcessorForImageFidelity(processor)

    expect(processor.parseBlipFill(blipFill)).toEqual({
      relationshipId: 'rId4',
      effects: { alpha: 0.15 },
    })
  })

  it('patches parseShape to copy blipFill alpha into shape imageEffects', () => {
    const processor = {
      parseShape: vi.fn(() => ({ name: 'logo' })),
    }
    const shapeElement = parseXml([
      '<p:pic xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">',
      '  <p:blipFill>',
      '    <a:blip><a:alpha val="20000"/></a:blip>',
      '  </p:blipFill>',
      '</p:pic>',
    ].join(''))

    patchPptxProcessorForImageFidelity(processor)

    expect(processor.parseShape(shapeElement)).toEqual({
      name: 'logo',
      imageEffects: { alpha: 0.2 },
    })
  })

  it('patches processPictureShape to copy blipFill alpha into picture imageEffects', () => {
    const processor = {
      processPictureShape: vi.fn(() => ({ type: 'pic', imageRelId: 'rId2' })),
    }
    const pictureElement = parseXml([
      '<p:pic xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">',
      '  <p:blipFill>',
      '    <a:blip r:embed="rId2" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
      '      <a:alphaModFix amt="8000"/>',
      '    </a:blip>',
      '  </p:blipFill>',
      '</p:pic>',
    ].join(''))

    patchPptxProcessorForImageFidelity(processor)

    expect(processor.processPictureShape(pictureElement)).toEqual({
      type: 'pic',
      imageRelId: 'rId2',
      imageEffects: { alpha: 0.08 },
    })
  })

  it('patches drawPictureShape to apply picture alpha while drawing', () => {
    const alphaDuringDraw: number[] = []
    const drawingDocument = {
      graphics: { context: { globalAlpha: 1 } },
      drawPictureShape: vi.fn(function drawPictureShape(this: { graphics: { context: { globalAlpha: number } } }) {
        alphaDuringDraw.push(this.graphics.context.globalAlpha)
      }),
    }

    patchPptxProcessorForImageFidelity(drawingDocument)
    drawingDocument.drawPictureShape({ imageEffects: { alpha: 0.08 } }, { x: 0, y: 0, w: 100, h: 100 })

    expect(alphaDuringDraw).toEqual([0.08])
    expect(drawingDocument.graphics.context.globalAlpha).toBe(1)
  })

  it('patches background image drawing to apply imageData alpha temporarily', () => {
    const alphaDuringDraw: number[] = []
    const processor = {
      drawBackgroundImage: vi.fn((graphics: { context: { globalAlpha: number } }) => {
        alphaDuringDraw.push(graphics.context.globalAlpha)
      }),
    }
    const graphics = { context: { globalAlpha: 0.9 } }

    patchPptxProcessorForImageFidelity(processor)
    processor.drawBackgroundImage(graphics, {}, { effects: { alpha: 0.3 } }, {})

    expect(alphaDuringDraw).toEqual([0.27])
    expect(graphics.context.globalAlpha).toBe(0.9)
  })
})
