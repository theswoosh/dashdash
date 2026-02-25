-- Migration 001: Phase 1 initial schema
-- These tables were originally created inline in db/index.ts.
-- On fresh installs this creates them. On existing installs all CREATE TABLE
-- statements are no-ops (IF NOT EXISTS) — the migration runner records this
-- version as applied regardless, ensuring version 2 runs next.

CREATE TABLE IF NOT EXISTS boards (
    id                TEXT PRIMARY KEY,
    name              TEXT NOT NULL DEFAULT 'Home',
    slug              TEXT NOT NULL UNIQUE,
    background_ext    TEXT,
    wallpaper_enabled INTEGER NOT NULL DEFAULT 0,
    created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notepad (
    service_id  TEXT PRIMARY KEY,
    content     TEXT NOT NULL DEFAULT '',
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_preferences (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
