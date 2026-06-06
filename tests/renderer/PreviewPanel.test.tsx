import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { vi } from 'vitest'
import PreviewPanel from '../../src/renderer/src/components/PreviewPanel'

describe('PreviewPanel', () => {
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
        contextUploads={[{ id: 'u1', label: '科学与社会结题报告.pdf', path: 'D:/PI/app/musicccc/report.pdf' }]}
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
    expect(screen.getByText('科学与社会结题报告.pdf')).toBeTruthy()
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

  it('renders a pdf preview when given a file URL', async () => {
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
          content: 'file:///D:/PI/app/report.pdf',
        }}
        onClosePreview={() => {}}
        onOpenExternal={() => {}}
      />,
    )

    const frame = screen.getByLabelText('report.pdf') as HTMLObjectElement
    expect(frame).toBeTruthy()
    expect(frame.getAttribute('data')).toContain('file:///D:/PI/app/report.pdf')
  })

  it('renders office summaries for docx, pptx, and xlsx previews', async () => {
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
          content: '<h1>Quarterly Brief</h1><p>Prepared for review.</p>',
        }}
        onClosePreview={() => {}}
        onOpenExternal={() => {}}
      />,
    )

    expect(screen.getByText('Quarterly Brief')).toBeTruthy()
    expect(screen.getByText('Prepared for review.')).toBeTruthy()

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
          slides: [
            { index: 1, title: 'Intro', summary: 'Overview of the plan' },
            { index: 2, title: 'Next Step', summary: 'Implementation milestones' },
          ],
        }}
        onClosePreview={() => {}}
        onOpenExternal={() => {}}
      />,
    )

    expect(screen.getByText('Slide 1')).toBeTruthy()
    expect(screen.getByText('Overview of the plan')).toBeTruthy()

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
          workbook: {
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

    expect(screen.getByText('Sheet1')).toBeTruthy()
    expect(screen.getByText('Task')).toBeTruthy()
    expect(screen.getByText('Draft')).toBeTruthy()
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
