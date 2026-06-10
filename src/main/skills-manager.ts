import { readFileSync, writeFileSync } from 'fs'

export interface SkillSearchResult {
  packageName: string
  name: string
  installs?: string
  url?: string
  description?: string
}

export interface SearchSkillsOptions {
  query: string
  limit?: number
  fetchImpl?: typeof fetch
}

function formatInstalls(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (typeof value !== 'number' || Number.isNaN(value)) return undefined
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K installs`
  return `${value} installs`
}

function normalizePackageName(skill: Record<string, unknown>): string {
  const existing = typeof skill.packageName === 'string' ? skill.packageName : ''
  if (existing.trim()) return existing

  const source = typeof skill.source === 'string' ? skill.source : ''
  const name = typeof skill.name === 'string' ? skill.name : typeof skill.id === 'string' ? skill.id : 'skill'
  return source ? `${source}@${name}` : name
}

export async function searchSkills({
  query,
  limit = 20,
  fetchImpl = fetch,
}: SearchSkillsOptions): Promise<SkillSearchResult[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const url = `https://skills.sh/api/search?q=${encodeURIComponent(trimmed)}&limit=${limit}`
  const response = await fetchImpl(url)
  if (!response.ok) {
    throw new Error(`skills.sh search failed: ${response.status}`)
  }

  const payload = await response.json() as Record<string, unknown>
  const skills = Array.isArray(payload.skills)
    ? payload.skills
    : Array.isArray(payload.results)
      ? payload.results
      : []

  return skills.map((entry) => {
    const skill = entry as Record<string, unknown>
    const id = typeof skill.id === 'string' ? skill.id : ''
    const name = typeof skill.name === 'string' ? skill.name : id
    return {
      packageName: normalizePackageName(skill),
      name,
      installs: formatInstalls(skill.installs),
      url: typeof skill.url === 'string' && skill.url.trim()
        ? skill.url
        : id
          ? `https://skills.sh/${id}`
          : undefined,
      description: typeof skill.description === 'string' ? skill.description : undefined,
    }
  })
}

export function setSkillModelInvocation(filePath: string, disabled: boolean): void {
  const content = readFileSync(filePath, 'utf-8')
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---(\r?\n[\s\S]*)?$/)

  if (!frontmatterMatch) {
    const body = content.startsWith('\n') ? content : `\n${content}`
    const frontmatter = disabled ? '---\ndisable-model-invocation: true\n---' : '---\n---'
    writeFileSync(filePath, `${frontmatter}${body}`, 'utf-8')
    return
  }

  const frontmatter = frontmatterMatch[1]
  const body = frontmatterMatch[2] || ''
  const lines = frontmatter
    .split(/\r?\n/)
    .filter((line) => !/^\s*disable-model-invocation\s*:/.test(line))

  if (disabled) {
    lines.push('disable-model-invocation: true')
  }

  writeFileSync(filePath, `---\n${lines.join('\n')}\n---${body}`, 'utf-8')
}

export async function installSkill(_payload?: unknown): Promise<void> {
  throw new Error('Skill installation requires an explicit confirmation flow and is not implemented yet.')
}
