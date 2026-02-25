-- Migration 002: Phase 2 — extend boards table + add auth/multi-user tables

-- ============================================================
-- EXTEND EXISTING boards TABLE
-- SQLite ALTER TABLE ADD COLUMN does not support IF NOT EXISTS.
-- Each statement is wrapped in a try/catch in the migration runner.
-- The runner calls addColumnSafe() for each of these.
-- ============================================================

-- Marker comment parsed by migration runner to identify safe-alter lines:
-- SAFE_ALTER: ALTER TABLE boards ADD COLUMN yaml_path    TEXT NOT NULL DEFAULT 'services.yml';
-- SAFE_ALTER: ALTER TABLE boards ADD COLUMN theme         TEXT NOT NULL DEFAULT 'liquid-glass';
-- SAFE_ALTER: ALTER TABLE boards ADD COLUMN wallpaper_url TEXT;
-- SAFE_ALTER: ALTER TABLE boards ADD COLUMN brightness    INTEGER NOT NULL DEFAULT 100;
-- SAFE_ALTER: ALTER TABLE boards ADD COLUMN settings      TEXT NOT NULL DEFAULT '{}';
-- SAFE_ALTER: ALTER TABLE boards ADD COLUMN is_active     INTEGER NOT NULL DEFAULT 1;
-- SAFE_ALTER: ALTER TABLE boards ADD COLUMN updated_at    TEXT;

-- ============================================================
-- USERS
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE,
    name          TEXT NOT NULL,
    auth_method   TEXT NOT NULL DEFAULT 'local' CHECK (auth_method IN ('local', 'oidc')),
    password_hash TEXT,        -- bcrypt hash; NULL for OIDC users
    oidc_subject  TEXT,        -- OIDC sub claim; NULL for local users
    oidc_issuer   TEXT,        -- OIDC issuer URL; NULL for local users
    is_active     INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- USER-BOARD RELATIONSHIP (RBAC-ready)
-- ============================================================

CREATE TABLE IF NOT EXISTS user_boards (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    board_id   TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    role       TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'editor', 'admin', 'owner')),
    granted_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),

    UNIQUE(user_id, board_id)
);

-- ============================================================
-- SYSTEM DEFAULTS (singleton row, id must always be 1)
-- ============================================================

CREATE TABLE IF NOT EXISTS system_defaults (
    id         INTEGER PRIMARY KEY CHECK (id = 1),
    settings   TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO system_defaults (id, settings) VALUES (1, '{}');

-- ============================================================
-- USER BOARD OVERRIDES (hybrid typed + JSON)
-- NULL on typed columns = "no override; use board default"
-- ============================================================

CREATE TABLE IF NOT EXISTS user_board_overrides (
    id            TEXT PRIMARY KEY,
    user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    board_id      TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,

    theme         TEXT,
    wallpaper_url TEXT,
    brightness    INTEGER CHECK (brightness BETWEEN 0 AND 100),

    overrides     TEXT NOT NULL DEFAULT '{}',

    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now')),

    UNIQUE(user_id, board_id)
);

-- ============================================================
-- AUTH SESSIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS sessions (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_boards_slug         ON boards(slug) WHERE is_active = 1;
CREATE INDEX IF NOT EXISTS idx_user_boards_user    ON user_boards(user_id);
CREATE INDEX IF NOT EXISTS idx_user_boards_lookup  ON user_boards(user_id, board_id);
CREATE INDEX IF NOT EXISTS idx_overrides_lookup    ON user_board_overrides(user_id, board_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user       ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires    ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_users_email         ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_oidc          ON users(oidc_issuer, oidc_subject);

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

CREATE TRIGGER IF NOT EXISTS trg_users_updated_at
    AFTER UPDATE ON users
    FOR EACH ROW
BEGIN
    UPDATE users SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_boards_updated_at
    AFTER UPDATE ON boards
    FOR EACH ROW
BEGIN
    UPDATE boards SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_overrides_updated_at
    AFTER UPDATE ON user_board_overrides
    FOR EACH ROW
BEGIN
    UPDATE user_board_overrides SET updated_at = datetime('now') WHERE id = NEW.id;
END;
