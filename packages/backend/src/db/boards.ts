import type { Db } from './index.js';

export interface BoardRow {
  id: string;
  name: string;
  slug: string;
  background_ext: string | null;
  wallpaper_enabled: number; // SQLite booleans are 0/1
  created_at: string;
}

export function getDefaultBoard(db: Db): BoardRow | undefined {
  return db.prepare('SELECT * FROM boards ORDER BY created_at LIMIT 1').get() as BoardRow | undefined;
}

export function getBoard(db: Db, id: string): BoardRow | undefined {
  return db.prepare('SELECT * FROM boards WHERE id = ?').get(id) as BoardRow | undefined;
}

export function setBackgroundExt(db: Db, boardId: string, ext: string | null): void {
  db.prepare('UPDATE boards SET background_ext = ? WHERE id = ?').run(ext, boardId);
}

export function setWallpaperEnabled(db: Db, boardId: string, enabled: boolean): void {
  db.prepare('UPDATE boards SET wallpaper_enabled = ? WHERE id = ?').run(enabled ? 1 : 0, boardId);
}
