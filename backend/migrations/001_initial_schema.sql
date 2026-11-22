BEGIN;

-- Append-only migration ledger. Every applied file is recorded with its
-- SHA-256 checksum so edited history is detected instead of silently blessed.
CREATE TABLE IF NOT EXISTS schema_migrations (
    filename TEXT PRIMARY KEY,
    checksum_sha256 TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    applied_by TEXT NOT NULL DEFAULT current_user,
    notes TEXT
);

-- Canonical human account (identity domain).
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE CHECK (email = lower(email) AND length(email) <= 320),
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Replaceable reference domain (example_items domain).
CREATE TABLE IF NOT EXISTS example_items (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS example_items_user_id_idx ON example_items(user_id);

-- Data warehouse source registry: one row per dataset_key.
CREATE TABLE IF NOT EXISTS external_data_sources (
    dataset_key TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    update_frequency TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Data warehouse run history: one row per pipeline execution.
CREATE TABLE IF NOT EXISTS external_data_runs (
    id BIGSERIAL PRIMARY KEY,
    dataset_key TEXT NOT NULL REFERENCES external_data_sources(dataset_key),
    status TEXT NOT NULL CHECK (status IN ('running', 'success', 'unchanged', 'skipped', 'advisory', 'failed')),
    source_version TEXT,
    rows_seen INTEGER NOT NULL DEFAULT 0,
    rows_written INTEGER NOT NULL DEFAULT 0,
    message TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ
);

-- Example normalized observations written by jobs/example.
CREATE TABLE IF NOT EXISTS example_observations (
    source_key TEXT PRIMARY KEY,
    observed_value TEXT NOT NULL,
    source_version TEXT NOT NULL,
    retrieved_at TIMESTAMPTZ NOT NULL
);

COMMIT;
