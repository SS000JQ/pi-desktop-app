export function calculatePptxSlideDisplaySize({
  containerWidth,
  aspectRatio,
  horizontalPadding = 0,
  minWidth = 240,
}: {
  containerWidth: number
  aspectRatio: number
  horizontalPadding?: number
  minWidth?: number
}) {
  const safeAspectRatio = Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 16 / 9
  const safeContainerWidth = Number.isFinite(containerWidth) ? containerWidth : 0
  const safeHorizontalPadding = Number.isFinite(horizontalPadding) ? Math.max(0, horizontalPadding) : 0
  const safeMinWidth = Number.isFinite(minWidth) ? Math.max(1, minWidth) : 240

  const width = Math.max(safeMinWidth, Math.round(safeContainerWidth - safeHorizontalPadding))
  const height = Math.max(1, Math.round(width / safeAspectRatio))

  return {
    width,
    height,
  }
}
