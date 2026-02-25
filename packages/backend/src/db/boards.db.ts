import type { Db } from './index.js';

// ============================================================
// Phase 1 types & functions (existing board operations)
// ============================================================

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

// ============================================================
// Phase 2 types & functions (multi-user settings resolution)
// ============================================================

interface EffectiveBoardSettingsRow {
  board_id: string;
  slug: string;
  name: string;
  yaml_path: string;
  theme: string;
  brightness: number;
  wallpaper_url: string | null;
  system_settings_json: string;
  board_settings_json: string;
  user_overrides_json: string;
  role: string;
}

export interface EffectiveBoardSettings {
  boardId: string;
  slug: string;
  name: string;
  yamlPath: string;
  theme: string;
  brightness: number;
  wallpaperUrl: string | null;
  role: string;
  settings: Record<string, unknown>;
}

const RESOLVE_BOARD_SETTINGS_SQL = `
  SELECT
    b.id AS board_id,
    b.slug,
    b.name,
    b.yaml_path,
    COALESCE(ubo.theme, b.theme, 'liquid-glass') AS theme,
    COALESCE(ubo.brightness, b.brightness, 100) AS brightness,
    COALESCE(ubo.wallpaper_url, b.wallpaper_url) AS wallpaper_url,
    sd.settings AS system_settings_json,
    b.settings AS board_settings_json,
    COALESCE(ubo.overrides, '{}') AS user_overrides_json,
    ub.role
  FROM boards b
  JOIN user_boards ub ON ub.board_id = b.id AND ub.user_id = ?
  LEFT JOIN user_board_overrides ubo ON ubo.board_id = b.id AND ubo.user_id = ?
  LEFT JOIN system_defaults sd ON sd.id = 1
  WHERE b.id = ?
    AND b.is_active = 1
`;

export function resolveEffectiveBoardSettings(
  db: Db,
  userId: string,
  boardId: string,
): EffectiveBoardSettings | undefined {
  const row = db.prepare(RESOLVE_BOARD_SETTINGS_SQL).get(userId, userId, boardId) as
    | EffectiveBoardSettingsRow
    | undefined;

  if (!row) return undefined;

  // Merge JSON buckets: system < board < user (right side wins)
  const systemSettings = JSON.parse(row.system_settings_json || '{}') as Record<string, unknown>;
  const boardSettings = JSON.parse(row.board_settings_json) as Record<string, unknown>;
  const userOverrides = JSON.parse(row.user_overrides_json) as Record<string, unknown>;

  return {
    boardId: row.board_id,
    slug: row.slug,
    name: row.name,
    yamlPath: row.yaml_path,
    theme: row.theme,
    brightness: row.brightness,
    wallpaperUrl: row.wallpaper_url,
    role: row.role,
    settings: { ...systemSettings, ...boardSettings, ...userOverrides },
  };
}

const LIST_USER_BOARDS_SQL = `
  SELECT
    b.id,
    b.slug,
    b.name,
    COALESCE(ubo.theme, b.theme, 'liquid-glass') AS theme,
    COALESCE(ubo.wallpaper_url, b.wallpaper_url) AS wallpaper_url,
    COALESCE(ubo.brightness, b.brightness, 100) AS brightness,
    ub.role
  FROM boards b
  JOIN user_boards ub ON ub.board_id = b.id AND ub.user_id = ?
  LEFT JOIN user_board_overrides ubo ON ubo.board_id = b.id AND ubo.user_id = ?
  WHERE b.is_active = 1
  ORDER BY b.name
`;

export interface BoardSummary {
  id: string;
  slug: string;
  name: string;
  theme: string;
  wallpaperUrl: string | null;
  brightness: number;
  role: string;
}

export function listBoardsForUser(db: Db, userId: string): BoardSummary[] {
  const rows = db.prepare(LIST_USER_BOARDS_SQL).all(userId, userId) as Array<{
    id: string;
    slug: string;
    name: string;
    theme: string;
    wallpaper_url: string | null;
    brightness: number;
    role: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    theme: row.theme,
    wallpaperUrl: row.wallpaper_url,
    brightness: row.brightness,
    role: row.role,
  }));
}
