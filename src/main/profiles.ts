import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

const PROFILES_DIR = join(app.getPath('userData'), 'pi-desktop', 'profiles')

interface ProfileData {
  id: string
  name: string
  createdAt: string
  defaultModel?: string
}

export function ensureProfilesDir(): void {
  if (!existsSync(PROFILES_DIR)) {
    mkdirSync(PROFILES_DIR, { recursive: true })
  }
}

export function listProfiles(): ProfileData[] {
  ensureProfilesDir()
  try {
    const entries = readdirSync(PROFILES_DIR, { withFileTypes: true })
    const profiles: ProfileData[] = []
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const configPath = join(PROFILES_DIR, entry.name, 'profile.json')
        if (existsSync(configPath)) {
          try {
            profiles.push(JSON.parse(readFileSync(configPath, 'utf-8')))
          } catch { /* skip corrupt profiles */ }
        }
      }
    }
    return profiles
  } catch {
    return []
  }
}

export function createProfile(name: string): ProfileData {
  ensureProfilesDir()
  const id = `profile-${Date.now()}`
  const dir = join(PROFILES_DIR, id)
  mkdirSync(dir, { recursive: true })
  const profile: ProfileData = { id, name, createdAt: new Date().toISOString() }
  writeFileSync(join(dir, 'profile.json'), JSON.stringify(profile, null, 2), 'utf-8')
  return profile
}

export function deleteProfile(id: string): boolean {
  const dir = join(PROFILES_DIR, id)
  if (!existsSync(dir)) return false
  rmSync(dir, { recursive: true, force: true })
  return true
}

export function getActiveProfile(): string {
  const configPath = join(app.getPath('userData'), 'pi-desktop', 'active-profile.json')
  try {
    return JSON.parse(readFileSync(configPath, 'utf-8')).id || 'default'
  } catch {
    return 'default'
  }
}

export function setActiveProfile(id: string): void {
  const dir = join(app.getPath('userData'), 'pi-desktop')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'active-profile.json'), JSON.stringify({ id }), 'utf-8')
}
