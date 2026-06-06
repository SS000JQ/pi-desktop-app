import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import PreviewPanel from '../../src/renderer/src/components/PreviewPanel'

describe('PreviewPanel', () => {
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
          content: '# Hello Preview\n\nThis came from a real file.',
        }}
        onClosePreview={() => {}}
        onOpenExternal={() => {}}
      />,
    )

    expect(screen.getAllByText('notes.md').length).toBeGreaterThan(0)
    expect(screen.getByText('Hello Preview')).toBeTruthy()
    expect(screen.getByText('This came from a real file.')).toBeTruthy()
  })

  it('renders an image preview when given image content', async () => {
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
})
