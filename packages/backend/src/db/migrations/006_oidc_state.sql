CREATE TABLE IF NOT EXISTS oidc_auth_state (
  id            TEXT PRIMARY KEY,
  state         TEXT NOT NULL UNIQUE,
  code_verifier TEXT NOT NULL,
  redirect_uri  TEXT NOT NULL,
  expires_at    TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_oidc_state ON oidc_auth_state(state);
