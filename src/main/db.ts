import Database from 'better-sqlite3'
import { join } from 'path'
import { app } from 'electron'
import { mkdirSync, writeFileSync } from 'fs'

const DB_DIR = join(app.getPath('userData'), 'pi-desktop')
const DB_PATH = join(DB_DIR, 'sessions.db')

let db: Database.Database

export function initDatabase(): void {
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
}

export function createSession(id: string): void {
  const now = new Date().toISOString()
  const filePath = join(DB_DIR, 'sessions', `${id}.jsonl`)
  mkdirSync(join(DB_DIR, 'sessions'), { recursive: true })

  db.prepare(`
    INSERT INTO sessions (id, title, model, created_at, updated_at, file_path)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, 'New session', null, now, now, filePath)

  // Write initial empty JSONL file
  writeFileSync(filePath, '', 'utf-8')
}

export function listSessions(): Array<{
  id: string
  title: string
  model: string | null
  tokenCount: number
  createdAt: string
  updatedAt: string
}> {
  return db.prepare(`
    SELECT id, title, model, token_count as tokenCount, created_at as createdAt, updated_at as updatedAt
    FROM sessions
    ORDER BY updated_at DESC
  `).all() as any
}

export function searchSessions(query: string): Array<{
  id: string
  title: string
  updatedAt: string
}> {
  return db.prepare(`
    SELECT s.id, s.title, s.updated_at as updatedAt
    FROM sessions_fts f JOIN sessions s ON s.rowid = f.rowid
    WHERE sessions_fts MATCH ?
    ORDER BY rank
    LIMIT 20
  `).all(query) as any
}

export function deleteSession(id: string): void {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(id)
}

export function updateSessionTitle(id: string, title: string): void {
  db.prepare('UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?').run(
    title,
    new Date().toISOString(),
    id
  )
}

export function updateSessionTokens(id: string, tokens: number): void {
  db.prepare('UPDATE sessions SET token_count = ?, updated_at = ? WHERE id = ?').run(
    tokens,
    new Date().toISOString(),
    id
  )
}

export function closeDatabase(): void {
  if (db) db.close()
}
