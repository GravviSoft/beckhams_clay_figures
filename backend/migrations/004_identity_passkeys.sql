BEGIN;

CREATE TABLE IF NOT EXISTS identity_passkeys (
    credential_id BYTEA PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rp_id TEXT NOT NULL,
    public_key BYTEA NOT NULL,
    sign_count BIGINT NOT NULL CHECK (sign_count >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS identity_passkeys_user_rp_idx
    ON identity_passkeys (user_id, rp_id);

CREATE TABLE IF NOT EXISTS identity_passkey_uses (
    challenge_id TEXT PRIMARY KEY,
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS identity_passkey_uses_expiry_idx
    ON identity_passkey_uses (expires_at);

COMMIT;
