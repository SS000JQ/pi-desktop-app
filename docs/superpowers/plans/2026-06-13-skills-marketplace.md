# Skills Marketplace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing Skills panel into a complete skill discovery, install, enable/disable, and reload workflow similar to agegr/pi-web, without requiring users to use the terminal.

**Architecture:** Keep Pi Desktop's Electron IPC boundary. The renderer owns the Skills management UI; the main process owns network search, `npx skills` installation, filesystem edits, and Pi runtime reload. Reuse Pi's existing resource loader for installed skill discovery so the UI matches what the agent can actually load.

**Tech Stack:** Electron, React, TypeScript, Vitest, Node `child_process.execFile`, `skills.sh` API, `npx skills add/find`, Pi resource loader.

---

## File Map

- Modify: `src/main/skills-manager.ts`
  - Implement `installSkill`.
  - Add a safe `runNpx` helper inspired by `agegr/pi-web/lib/npx.ts`.
  - Add CLI fallback for `searchSkills`.
  - Normalize install output and errors.
- Modify: `src/main/index.ts`
  - Pass `skills:install` payload to `installSkill`.
  - Validate project install `cwd`.
  - Return useful install output and refreshable metadata.
- Modify: `src/preload/api.ts`, `src/renderer/src/env.d.ts`
  - Keep renderer API types aligned with install/search response shape.
- Modify: `src/renderer/src/screens/Skills.tsx`
  - Replace the current "Install from search is coming later" placeholder with real install buttons.
  - Add global/project install scope control.
  - Add install path preview, installed state, install errors, search empty states, and links to `skills.sh`.
  - Reload Pi resources after successful install.
- Modify: `src/renderer/src/styles/global.css`
  - Add stable class-based styles for the Skills marketplace instead of large inline style blocks where practical.
  - Ensure Mint Docs and dark themes both have readable search/install states.
- Modify: `tests/main/skills-manager.test.ts`
  - Add tests for install command generation, CLI fallback parsing, and error normalization.
- Modify: `tests/renderer/Skills.test.tsx`
  - Add tests for search result install flow, scope switching, install success reload, install failure, and links.

---

## Task 1: Main-Process Skills CLI Runner

**Files:**
- Modify: `src/main/skills-manager.ts`
- Test: `tests/main/skills-manager.test.ts`

- [ ] **Step 1: Add failing tests for install command generation**

Add imports:

```ts
import { installSkill } from '../../src/main/skills-manager'
```

Add tests:

```ts
it('installs a global skill through npx skills add for the Pi agent', async () => {
  const calls: Array<{ args: string[]; cwd?: string }> = []

  await installSkill({
    packageName: 'owner/repo@pdf',
    scope: 'global',
    runNpxImpl: async (args, options) => {
      calls.push({ args, cwd: options.cwd })
      return { stdout: 'Installation complete', stderr: '' }
    },
  })

  expect(calls).toEqual([
    {
      args: ['skills', 'add', 'owner/repo@pdf', '-y', '--agent', 'pi', '-g'],
      cwd: undefined,
    },
  ])
})

it('installs a project skill in the selected workspace', async () => {
  const calls: Array<{ args: string[]; cwd?: string }> = []

  await installSkill({
    packageName: 'owner/repo@testing',
    scope: 'project',
    cwd: 'D:/PI/app',
    runNpxImpl: async (args, options) => {
      calls.push({ args, cwd: options.cwd })
      return { stdout: 'Installed 1 skill', stderr: '' }
    },
  })

  expect(calls).toEqual([
    {
      args: ['skills', 'add', 'owner/repo@testing', '-y', '--agent', 'pi'],
      cwd: 'D:/PI/app',
    },
  ])
})

it('rejects project skill installs without a cwd', async () => {
  await expect(installSkill({
    packageName: 'owner/repo@testing',
    scope: 'project',
    runNpxImpl: async () => ({ stdout: 'Installation complete', stderr: '' }),
  })).rejects.toThrow(/workspace is required/i)
})

it('returns cleaned install output and rejects failed installs', async () => {
  await expect(installSkill({
    packageName: 'owner/repo@bad',
    scope: 'global',
    runNpxImpl: async () => ({ stdout: '\u001b[31mNo matching skill\u001b[0m', stderr: '' }),
  })).rejects.toThrow(/No matching skill/i)
})
```

- [ ] **Step 2: Run the tests and verify failure**

Run:

```bash
npm test -- tests/main/skills-manager.test.ts -t "installs"
```

Expected: failures because `installSkill` currently throws "not implemented".

- [ ] **Step 3: Implement typed runner and installSkill**

In `src/main/skills-manager.ts`, add:

```ts
import { execFile } from 'child_process'
import { promisify } from 'util'
import { execPath } from 'process'

const execFileAsync = promisify(execFile)
const ANSI_RE = /\x1B\[[0-9;]*m/g

export interface RunNpxOptions {
  timeout?: number
  cwd?: string
  env?: NodeJS.ProcessEnv
}

export interface RunNpxResult {
  stdout: string
  stderr: string
}

export type RunNpxImpl = (args: string[], options: RunNpxOptions) => Promise<RunNpxResult>

function findNpxCli(): string | null {
  const nodeDir = dirname(execPath)
  const candidates = [
    join(nodeDir, 'node_modules', 'npm', 'bin', 'npx-cli.js'),
    join(nodeDir, '..', 'lib', 'node_modules', 'npm', 'bin', 'npx-cli.js'),
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return null
}

export async function runNpx(args: string[], options: RunNpxOptions = {}): Promise<RunNpxResult> {
  const npxCli = findNpxCli()
  const command = npxCli ? execPath : 'npx'
  const commandArgs = npxCli ? [npxCli, ...args] : args
  return execFileAsync(command, commandArgs, {
    timeout: options.timeout,
    cwd: options.cwd,
    env: options.env,
  })
}

function cleanCliOutput(value: string): string {
  return value.replace(ANSI_RE, '').trim()
}

export interface InstallSkillOptions {
  packageName: string
  scope: 'global' | 'project'
  cwd?: string
  runNpxImpl?: RunNpxImpl
}

export async function installSkill(payload?: InstallSkillOptions): Promise<{ output: string }> {
  const packageName = payload?.packageName?.trim()
  if (!packageName) throw new Error('Skill package is required.')

  const scope = payload.scope === 'project' ? 'project' : 'global'
  if (scope === 'project' && !payload.cwd?.trim()) {
    throw new Error('A workspace is required to install a project skill.')
  }

  const args = ['skills', 'add', packageName, '-y', '--agent', 'pi']
  if (scope === 'global') args.push('-g')

  const runner = payload.runNpxImpl || runNpx
  const result = await runner(args, {
    timeout: 60_000,
    cwd: scope === 'project' ? payload.cwd : undefined,
    env: { ...process.env, FORCE_COLOR: '0' },
  })

  const output = cleanCliOutput(`${result.stdout}${result.stderr}`)
  if (!/Installation complete|Installed \d+ skill/i.test(output)) {
    throw new Error(output.slice(-500) || 'Skill installation failed.')
  }

  return { output }
}
```

- [ ] **Step 4: Run the install tests**

Run:

```bash
npm test -- tests/main/skills-manager.test.ts -t "install"
```

Expected: install tests pass.

---

## Task 2: Skills Search CLI Fallback

**Files:**
- Modify: `src/main/skills-manager.ts`
- Test: `tests/main/skills-manager.test.ts`

- [ ] **Step 1: Add failing tests for search fallback parsing**

Add:

```ts
it('falls back to npx skills find when skills.sh search fails', async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 })

  await expect(searchSkills({
    query: 'pdf',
    fetchImpl: fetchMock as any,
    runNpxImpl: async () => ({
      stdout: [
        'owner/repo@pdf  12K installs',
        'https://skills.sh/owner/repo/pdf',
      ].join('\n'),
      stderr: '',
    }),
  })).resolves.toEqual([
    {
      packageName: 'owner/repo@pdf',
      name: 'pdf',
      installs: '12K installs',
      url: 'https://skills.sh/owner/repo/pdf',
    },
  ])
})
```

- [ ] **Step 2: Run and verify failure**

Run:

```bash
npm test -- tests/main/skills-manager.test.ts -t "falls back"
```

Expected: TypeScript/test failure because `searchSkills` does not accept `runNpxImpl`.

- [ ] **Step 3: Extend SearchSkillsOptions and implement fallback**

Update types:

```ts
export interface SearchSkillsOptions {
  query: string
  limit?: number
  fetchImpl?: typeof fetch
  runNpxImpl?: RunNpxImpl
}
```

Add parser:

```ts
function parseSkillsFindOutput(raw: string, limit: number): SkillSearchResult[] {
  const lines = cleanCliOutput(raw).split(/\r?\n/)
  const results: SkillSearchResult[] = []
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim()
    const match = line.match(/^([\w.\-]+\/[\w.\-@:]+)\s+([\d.,]+[KMB]?\s+installs?)$/i)
    if (!match) continue
    const packageName = match[1]
    const name = packageName.includes('@') ? packageName.split('@').pop() || packageName : packageName
    const nextLine = lines[index + 1]?.trim()
    results.push({
      packageName,
      name,
      installs: match[2],
      url: nextLine?.startsWith('https://') ? nextLine : undefined,
    })
    if (results.length >= limit) break
  }
  return results
}
```

Wrap API search:

```ts
try {
  const response = await fetchImpl(url)
  if (!response.ok) throw new Error(`skills.sh search failed: ${response.status}`)
  // existing JSON normalization
} catch (error) {
  const runner = runNpxImpl || runNpx
  const result = await runner(['skills', 'find', trimmed], {
    timeout: 20_000,
    env: { ...process.env, FORCE_COLOR: '0' },
  })
  return parseSkillsFindOutput(`${result.stdout}${result.stderr}`, limit)
}
```

- [ ] **Step 4: Run skills-manager tests**

Run:

```bash
npm test -- tests/main/skills-manager.test.ts
```

Expected: all skills manager tests pass.

---

## Task 3: IPC Install Response and Project CWD Validation

**Files:**
- Modify: `src/main/index.ts`
- Modify: `src/preload/api.ts`
- Modify: `src/renderer/src/env.d.ts`

- [ ] **Step 1: Update IPC handler**

Change `SKILLS_INSTALL` handler:

```ts
ipcMain.handle(IPC_CHANNELS.SKILLS_INSTALL, async (_event, payload: { packageName: string; scope: 'global' | 'project'; cwd?: string }) => {
  try {
    const result = await installSkill(payload)
    return { success: true, data: result }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to install skill' }
  }
})
```

- [ ] **Step 2: Update preload types**

In `src/preload/api.ts` and `src/renderer/src/env.d.ts`, change:

```ts
install: (payload: { packageName: string; scope: 'global' | 'project'; cwd?: string }) => Promise<IpcResponse<{ output: string }>>
```

- [ ] **Step 3: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: typecheck passes.

---

## Task 4: Renderer Install UI

**Files:**
- Modify: `src/renderer/src/screens/Skills.tsx`
- Test: `tests/renderer/Skills.test.tsx`

- [ ] **Step 1: Add renderer tests for install flow**

Add tests:

```tsx
it('installs a searched skill and reloads Pi resources', async () => {
  window.piDesktop = {
    ...window.piDesktop,
    desktop: {
      ...window.piDesktop.desktop,
      getPiResources: vi.fn().mockResolvedValue({
        success: true,
        data: {
          ...baseResources,
          skills: [],
        },
      }),
    },
    skills: {
      ...window.piDesktop.skills,
      search: vi.fn().mockResolvedValue({
        success: true,
        data: [{ packageName: 'owner/repo@pdf', name: 'pdf', installs: '12K installs', url: 'https://skills.sh/owner/repo/pdf' }],
      }),
      install: vi.fn().mockResolvedValue({ success: true, data: { output: 'Installation complete' } }),
    },
    piRuntime: {
      ...window.piDesktop.piRuntime,
      reloadResources: vi.fn().mockResolvedValue({ success: true }),
    },
  } as Window['piDesktop']

  render(<Skills currentDir="D:/PI/app" sessionPath="session-path" onClose={() => {}} />)

  fireEvent.change(await screen.findByPlaceholderText('Search skills'), { target: { value: 'pdf' } })
  fireEvent.click(screen.getByRole('button', { name: 'Search' }))

  expect(await screen.findByText('owner/repo@pdf')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Install' }))

  await waitFor(() => {
    expect(window.piDesktop.skills.install).toHaveBeenCalledWith({
      packageName: 'owner/repo@pdf',
      scope: 'global',
      cwd: 'D:/PI/app',
    })
  })
  expect(await screen.findByText(/Installed owner\/repo@pdf/i)).toBeTruthy()
})
```

- [ ] **Step 2: Add state in `Skills.tsx`**

Add:

```ts
const [installScope, setInstallScope] = useState<'global' | 'project'>('global')
const [installingPackage, setInstallingPackage] = useState<string | null>(null)
const [installedPackages, setInstalledPackages] = useState<Set<string>>(() => new Set())
```

- [ ] **Step 3: Implement `handleInstallSkill`**

Add:

```ts
const handleInstallSkill = async (packageName: string) => {
  if (!window.piDesktop.skills?.install) return
  setInstallingPackage(packageName)
  setManagerNotice(null)
  const response = await window.piDesktop.skills.install({
    packageName,
    scope: installScope,
    cwd: currentDir || undefined,
  })
  if (!response.success) {
    setManagerNotice(response.error || 'Skill install failed.')
    setInstallingPackage(null)
    return
  }
  setInstalledPackages((previous) => new Set(previous).add(packageName))
  const runtimeNotice = await reloadRuntimeResources(sessionPath)
  const next = await loadPiResources(currentDir, sessionPath).catch(() => null)
  if (next) setResources(next)
  setManagerNotice(`Installed ${packageName}.${runtimeNotice}`)
  setInstallingPackage(null)
}
```

- [ ] **Step 4: Replace placeholder result card**

For each search result render:

```tsx
const installed = installedPackages.has(result.packageName)
const installing = installingPackage === result.packageName
<button
  onClick={() => void handleInstallSkill(result.packageName)}
  disabled={installed || installing || Boolean(installingPackage)}
>
  {installed ? 'Installed' : installing ? 'Installing...' : 'Install'}
</button>
```

- [ ] **Step 5: Add scope selector**

Above search results:

```tsx
<div role="group" aria-label="Skill install scope">
  <button onClick={() => setInstallScope('global')} aria-pressed={installScope === 'global'}>Global</button>
  <button onClick={() => setInstallScope('project')} aria-pressed={installScope === 'project'} disabled={!currentDir}>Project</button>
</div>
```

- [ ] **Step 6: Run renderer tests**

Run:

```bash
npm test -- tests/renderer/Skills.test.tsx
```

Expected: all Skills tests pass.

---

## Task 5: Skills Panel UX Polish

**Files:**
- Modify: `src/renderer/src/screens/Skills.tsx`
- Modify: `src/renderer/src/styles/global.css`

- [ ] **Step 1: Convert install/search UI to class-based markup**

Use classes:

```tsx
<div className="skills-search-panel">
  <div className="skills-search-row">...</div>
  <div className="skills-scope-row">...</div>
  <div className="skills-results">...</div>
</div>
```

- [ ] **Step 2: Add global styles**

Add CSS:

```css
.skills-search-panel {
  padding: 10px 14px;
  border-bottom: 1px solid var(--bd);
}

.skills-scope-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.skills-scope-toggle {
  display: inline-flex;
  overflow: hidden;
  border: 1px solid var(--card-border);
  border-radius: 6px;
}

.skills-scope-toggle button {
  border: 0;
  background: var(--panel-bg);
  color: var(--text2);
  font: inherit;
  font-size: 11px;
  padding: 4px 9px;
  cursor: pointer;
}

.skills-scope-toggle button[aria-pressed="true"] {
  background: color-mix(in srgb, var(--accent) 16%, var(--panel-bg));
  color: var(--text);
  font-weight: 600;
}

.skills-result-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  border: 1px solid var(--card-border);
  border-radius: 7px;
  padding: 9px 10px;
  background: var(--panel-bg);
}
```

- [ ] **Step 3: Add Mint Docs overrides**

Add:

```css
[data-theme="mint-docs"] .skills-result-card {
  background: #ffffff;
  border-color: rgba(15,23,42,0.10);
}

[data-theme="mint-docs"] .skills-scope-toggle button {
  color: rgba(48,55,71,0.76);
}

[data-theme="mint-docs"] .skills-scope-toggle button[aria-pressed="true"] {
  color: rgba(12,15,22,0.92);
  background: rgba(200,246,249,0.34);
}
```

- [ ] **Step 4: Manual visual checklist**

Check:

```text
Classic theme: search results readable, Install button visible.
Mint Docs theme: package name dark enough, install count not washed out.
Project scope disabled when currentDir is missing.
Long package names truncate cleanly.
Install errors wrap instead of overflowing.
```

---

## Task 6: Runtime Reload and Diagnostics

**Files:**
- Modify: `src/renderer/src/screens/Skills.tsx`
- Test: `tests/renderer/Skills.test.tsx`

- [ ] **Step 1: Add test for install failure**

Add:

```tsx
it('shows install errors without clearing search results', async () => {
  window.piDesktop = {
    ...window.piDesktop,
    skills: {
      ...window.piDesktop.skills,
      search: vi.fn().mockResolvedValue({
        success: true,
        data: [{ packageName: 'owner/repo@bad', name: 'bad' }],
      }),
      install: vi.fn().mockResolvedValue({ success: false, error: 'No matching skill' }),
    },
  } as Window['piDesktop']

  render(<Skills currentDir="D:/PI/app" onClose={() => {}} />)
  fireEvent.change(await screen.findByPlaceholderText('Search skills'), { target: { value: 'bad' } })
  fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  expect(await screen.findByText('owner/repo@bad')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Install' }))
  expect(await screen.findByText('No matching skill')).toBeTruthy()
  expect(screen.getByText('owner/repo@bad')).toBeTruthy()
})
```

- [ ] **Step 2: Make notices specific**

Use:

```ts
setManagerNotice(response.error || `Failed to install ${packageName}.`)
```

and:

```ts
setManagerNotice(`Installed ${packageName}.${runtimeNotice}`)
```

- [ ] **Step 3: Run tests**

Run:

```bash
npm test -- tests/renderer/Skills.test.tsx
```

Expected: pass.

---

## Task 7: Full Verification

**Files:**
- No new source files.

- [ ] **Step 1: Run targeted main tests**

Run:

```bash
npm test -- tests/main/skills-manager.test.ts
```

Expected: pass.

- [ ] **Step 2: Run targeted renderer tests**

Run:

```bash
npm test -- tests/renderer/Skills.test.tsx
```

Expected: pass.

- [ ] **Step 3: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: pass.

- [ ] **Step 4: Run full tests**

Run:

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Run production build**

Run:

```bash
npm run build
```

Expected: build succeeds. Existing bundle-size warnings are acceptable.

---

## Self-Review

- Spec coverage: Plan covers discovery, download/install, global/project scope, runtime reload, existing enable/disable, search fallback, and user-facing errors.
- Placeholder scan: No implementation step uses TBD/TODO placeholders.
- Type consistency: Renderer uses `packageName`, main install uses `InstallSkillOptions`, preload/env types return `{ output: string }`.
