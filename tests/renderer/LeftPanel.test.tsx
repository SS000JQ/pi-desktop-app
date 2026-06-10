import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import LeftPanel from '../../src/renderer/src/components/LeftPanel'
import type { Session } from '../../src/renderer/src/types/chat'

function makeSession(overrides: Partial<Session>): Session {
  return {
    id: overrides.id || 'session-id',
    path: overrides.path || 'D:/sessions/session.jsonl',
    cwd: overrides.cwd || 'D:/PI/app',
    source: 'pi',
    title: overrides.title || 'Session',
    createdAt: overrides.createdAt || Date.now(),
    updatedAt: overrides.updatedAt || Date.now(),
    messages: [],
    messageCount: overrides.messageCount ?? 12,
    status: overrides.status || 'idle',
    ...overrides,
  }
}

function renderLeftPanel(props: Partial<Parameters<typeof LeftPanel>[0]> = {}) {
  const now = Date.now()
  return render(
    <LeftPanel
      sessions={[
        makeSession({
          id: 'app-1',
          path: 'D:/sessions/app-1.jsonl',
          cwd: 'D:/PI/app',
          title: 'Read project content',
          updatedAt: now - 60_000,
          messageCount: 259,
        }),
        makeSession({
          id: 'app-2',
          path: 'D:/sessions/app-2.jsonl',
          cwd: 'D:/PI/app',
          title: 'Analyze current project',
          updatedAt: now - 3_600_000,
          messageCount: 52,
        }),
        makeSession({
          id: 'project-1',
          path: 'D:/sessions/project-1.jsonl',
          cwd: 'D:/PI/Project2',
          title: 'Analyze issue',
          updatedAt: now - 7_200_000,
          messageCount: 30,
        }),
      ]}
      activeSessionPath="D:/sessions/app-1.jsonl"
      pinnedSessionPaths={props.pinnedSessionPaths || []}
      onPinnedSessionPathsChange={props.onPinnedSessionPathsChange || (() => {})}
      onSessionSelect={props.onSessionSelect || (() => {})}
      onSessionCreate={props.onSessionCreate || (() => {})}
      onOpenModels={props.onOpenModels || (() => {})}
      onOpenSkills={props.onOpenSkills || (() => {})}
      onOpenSettings={props.onOpenSettings || (() => {})}
      collapsed={false}
      onToggleCollapse={props.onToggleCollapse || (() => {})}
      panelWidth={props.panelWidth || 300}
      onResize={props.onResize || (() => {})}
      {...props}
    />,
  )
}

describe('LeftPanel compact project sessions', () => {
  it('renders a compact grouped session list without old view tabs or message counts', () => {
    renderLeftPanel()

    expect(screen.queryByRole('tablist', { name: 'Session views' })).toBeNull()
    expect(screen.queryByText('Pi Sessions')).toBeNull()
    expect(screen.queryByText('259 msgs')).toBeNull()

    expect(screen.getByRole('button', { name: 'D:/PI/app' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'D:/PI/Project2' })).toBeTruthy()
    expect(screen.getByText('Read project content')).toBeTruthy()
    expect(screen.getByText('Analyze issue')).toBeTruthy()
  })

  it('pins and unpins sessions from the context menu', () => {
    const onPinnedSessionPathsChange = vi.fn()
    renderLeftPanel({ onPinnedSessionPathsChange })

    fireEvent.contextMenu(screen.getByRole('button', { name: /Read project content/ }))
    fireEvent.click(screen.getByText('Pin'))

    expect(onPinnedSessionPathsChange).toHaveBeenCalledWith(['D:/sessions/app-1.jsonl'])
  })

  it('shows pinned sessions above project groups and lets them unpin', () => {
    const onPinnedSessionPathsChange = vi.fn()
    renderLeftPanel({
      pinnedSessionPaths: ['D:/sessions/project-1.jsonl'],
      onPinnedSessionPathsChange,
    })

    const pinnedRegion = screen.getByLabelText('Pinned sessions')
    expect(within(pinnedRegion).getByText('Analyze issue')).toBeTruthy()

    fireEvent.contextMenu(within(pinnedRegion).getByRole('button', { name: /Analyze issue/ }))
    fireEvent.click(screen.getByText('Unpin'))

    expect(onPinnedSessionPathsChange).toHaveBeenCalledWith([])
  })
})
