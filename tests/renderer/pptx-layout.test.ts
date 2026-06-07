import { describe, expect, it } from 'vitest'

import { calculatePptxSlideDisplaySize } from '../../src/renderer/src/lib/pptx-layout'

describe('pptx layout helpers', () => {
  it('fits slide width inside the available container width', () => {
    expect(
      calculatePptxSlideDisplaySize({
        containerWidth: 860,
        aspectRatio: 16 / 9,
        horizontalPadding: 20,
      }),
    ).toEqual({
      width: 840,
      height: 473,
    })
  })

  it('falls back to a safe minimum width when the container is very small', () => {
    expect(
      calculatePptxSlideDisplaySize({
        containerWidth: 120,
        aspectRatio: 4 / 3,
        horizontalPadding: 16,
        minWidth: 240,
      }),
    ).toEqual({
      width: 240,
      height: 180,
    })
  })
})
