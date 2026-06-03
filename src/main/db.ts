// Dynamic import to handle missing native module at runtime
let Database: any = null
try {
  Database = require('better-sqlite3')
} catch {
  // Native module not available — SQLite features disabled
}

import { join } from 'path'
import { app } from 'electron'
import { mkdirSync, writeFileSync } from 'fs'

const DB_DIR = join(app.getPath('userData'), 'pi-desktop')
const DB_PATH = join(DB_DIR, 'sessions.db')

let db: any

export function initDatabase(): void {
  try {
    mkdirSync(DB_DIR, { recursive: true })
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        model TEXT,
        token_count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        file_path TEXT NOT NULL,
        profile_id TEXT DEFAULT 'default'
      );
      CREATE VIRTUAL TABLE IF NOT EXISTS sessions_fts USING fts5(
        title, content='sessions', content_rowid='rowid'
      );
      CREATE TRIGGER IF NOT EXISTS sessions_ai AFTER INSERT ON sessions BEGIN
        INSERT INTO sessions_fts(rowid, title) VALUES (new.rowid, new.title);
      END;
      CREATE TRIGGER IF NOT EXISTS sessions_ad AFTER DELETE ON sessions BEGIN
        INSERT INTO sessions_fts(sessions_fts, rowid, title) VALUES('delete', old.rowid, old.title);
      END;
      CREATE TRIGGER IF NOT EXISTS sessions_au AFTER UPDATE ON sessions BEGIN
        INSERT INTO sessions_fts(sessions_fts, rowid, title) VALUES('delete', old.rowid, old.title);
        INSERT INTO sessions_fts(rowid, title) VALUES (new.rowid, new.title);
      END;
    `)
  } catch (err) {
    console.warn('SQLite init failed (native module not available):', (err as Error).message)
  }
}

export function createSession(id: string): void {
  try {
    const now = new Date().toISOString()
    const filePath = join(DB_DIR, 'sessions', `${id}.jsonl`)
    mkdirSync(join(DB_DIR, 'sessions'), { recursive: true })
    db.prepare(`
      INSERT INTO sessions (id, title, model, created_at, updated_at, file_path)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, 'New session', null, now, now, filePath)
    writeFileSync(filePath, '', 'utf-8')
  } catch { /* skip if DB not available */ }
}

export function listSessions(): Array<{
  id: string
  title: string
  model: string | null
  tokenCount: number
  createdAt: string
  updatedAt: string
}> {
  try {
    return db.prepare(`
      SELECT id, title, model, token_count as tokenCount, created_at as createdAt, updated_at as updatedAt
      FROM sessions ORDER BY updated_at DESC
    `).all() as any
  } catch { return [] }
}

export function searchSessions(query: string): Array<{
  id: string
  title: string
  updatedAt: string
}> {
  try {
    return db.prepare(`
      SELECT s.id, s.title, s.updated_at as updatedAt
      FROM sessions_fts f JOIN sessions s ON s.rowid = f.rowid
      WHERE sessions_fts MATCH ? ORDER BY rank LIMIT 20
    `).all(query) as any
  } catch { return [] }
}

export function deleteSession(id: string): void {
  try { db.prepare('DELETE FROM sessions WHERE id = ?').run(id) } catch { /* skip */ }
}

export function updateSessionTitle(id: string, title: string): void {
  try { db.prepare('UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?').run(title, new Date().toISOString(), id) } catch { /* skip */ }
}

export function updateSessionTokens(id: string, tokens: number): void {
  try { db.prepare('UPDATE sessions SET token_count = ?, updated_at = ? WHERE id = ?').run(tokens, new Date().toISOString(), id) } catch { /* skip */ }
}

export function closeDatabase(): void {
  try { if (db) db.close() } catch { /* skip */ }
}
