import { join } from 'path'
import { app } from 'electron'
import { mkdirSync, writeFileSync } from 'fs'

const DB_DIR = join(app.getPath('userData'), 'pi-desktop')
const DB_PATH = join(DB_DIR, 'sessions.db')

let db: any = null
let DB_READY = false

export async function initDatabase(): Promise<void> {
  try {
    mkdirSync(DB_DIR, { recursive: true })
    const initSqlJs = require('sql.js')
    const SQL = await initSqlJs()

    // Try to load existing database, or create new one
    const { existsSync, readFileSync } = require('fs')
    if (existsSync(DB_PATH)) {
      const buffer = readFileSync(DB_PATH)
      db = new SQL.Database(buffer)
    } else {
      db = new SQL.Database()
    }

    db.run(`CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      model TEXT,
      token_count INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      file_path TEXT NOT NULL,
      profile_id TEXT DEFAULT 'default'
    )`)

    DB_READY = true
  } catch (err) {
    console.warn('SQLite init failed:', (err as Error).message)
    DB_READY = false
  }
}

function saveDb(): void {
  if (!db || !DB_READY) return
  try {
    const data = db.export()
    const { writeFileSync: wfs } = require('fs')
    wfs(DB_PATH, Buffer.from(data))
  } catch { /* skip */ }
}

export function createSession(id: string): void {
  if (!DB_READY) return
  try {
    const now = new Date().toISOString()
    const filePath = join(DB_DIR, 'sessions', `${id}.jsonl`)
    mkdirSync(join(DB_DIR, 'sessions'), { recursive: true })
    db.run('INSERT INTO sessions VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, 'New session', null, 0, now, now, filePath])
    writeFileSync(filePath, '', 'utf-8')
    saveDb()
  } catch { /* skip */ }
}

export function listSessions(): Array<{
  id: string; title: string; model: string | null
  tokenCount: number; createdAt: string; updatedAt: string
}> {
  if (!DB_READY) return []
  try {
    const r = db.exec('SELECT id, title, model, token_count, created_at, updated_at FROM sessions ORDER BY updated_at DESC')
    if (!r.length) return []
    return r[0].values.map((row: any[]) => ({
      id: row[0], title: row[1], model: row[2],
      tokenCount: row[3], createdAt: row[4], updatedAt: row[5],
    }))
  } catch { return [] }
}

export function searchSessions(query: string): Array<{
  id: string; title: string; updatedAt: string
}> {
  if (!DB_READY) return []
  try {
    const r = db.exec(`SELECT id, title, updated_at FROM sessions WHERE title LIKE '%' || ? || '%' ORDER BY updated_at DESC LIMIT 20`, [query])
    if (!r.length) return []
    return r[0].values.map((row: any[]) => ({
      id: row[0], title: row[1], updatedAt: row[2],
    }))
  } catch { return [] }
}

export function deleteSession(id: string): void {
  if (!DB_READY) return
  try { db.run('DELETE FROM sessions WHERE id = ?', [id]); saveDb() } catch { /* skip */ }
}

export function updateSessionTitle(id: string, title: string): void {
  if (!DB_READY) return
  try { db.run('UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?', [title, new Date().toISOString(), id]); saveDb() } catch { /* skip */ }
}

export function updateSessionTokens(id: string, tokens: number): void {
  if (!DB_READY) return
  try { db.run('UPDATE sessions SET token_count = ?, updated_at = ? WHERE id = ?', [tokens, new Date().toISOString(), id]); saveDb() } catch { /* skip */ }
}

export function closeDatabase(): void {
  if (db && DB_READY) { saveDb(); try { db.close() } catch { /* skip */ } }
}
