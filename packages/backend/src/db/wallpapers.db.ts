import type { Db } from './index.js';

export interface WallpaperRow {
  id: string;
  user_id: string;
  board_id: string;
  ext: string;
  uploaded_at: string;
}

const ACTIVE_WALLPAPER_KEY = (boardId: string) => `bg_wallpaper_id_${boardId}`;

const UPSERT_USER_PREF_SQL = `
  INSERT INTO user_preferences (user_id, key, value, updated_at)
  VALUES (?, ?, ?, datetime('now'))
  ON CONFLICT (user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
`;

export function listWallpapers(db: Db, userId: string, boardId: string): WallpaperRow[] {
  return db
    .prepare<[string, string], WallpaperRow>(
      'SELECT * FROM user_wallpapers WHERE user_id = ? AND board_id = ? ORDER BY uploaded_at ASC',
    )
    .all(userId, boardId);
}

export function insertWallpaper(db: Db, id: string, userId: string, boardId: string, ext: string): void {
  db.prepare('INSERT INTO user_wallpapers (id, user_id, board_id, ext) VALUES (?, ?, ?, ?)').run(
    id,
    userId,
    boardId,
    ext,
  );
}

export function deleteWallpaper(
  db: Db,
  userId: string,
  wallpaperId: string,
): WallpaperRow | undefined {
  const row = db
    .prepare<[string, string], WallpaperRow>(
      'SELECT * FROM user_wallpapers WHERE id = ? AND user_id = ?',
    )
    .get(wallpaperId, userId);
  if (!row) return undefined;
  db.prepare('DELETE FROM user_wallpapers WHERE id = ? AND user_id = ?').run(wallpaperId, userId);
  return row;
}

export function getActiveWallpaperId(db: Db, userId: string, boardId: string): string | null {
  const row = db
    .prepare<[string, string], { value: string }>(
      'SELECT value FROM user_preferences WHERE user_id = ? AND key = ?',
    )
    .get(userId, ACTIVE_WALLPAPER_KEY(boardId));
  return row?.value ?? null;
}

export function setActiveWallpaperId(
  db: Db,
  userId: string,
  boardId: string,
  id: string | null,
): void {
  if (id === null) {
    db.prepare('DELETE FROM user_preferences WHERE user_id = ? AND key = ?').run(
      userId,
      ACTIVE_WALLPAPER_KEY(boardId),
    );
  } else {
    db.prepare(UPSERT_USER_PREF_SQL).run(userId, ACTIVE_WALLPAPER_KEY(boardId), id);
  }
}
