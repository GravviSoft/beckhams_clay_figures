BEGIN;

-- One canonical record per physical clay creation.
CREATE TABLE IF NOT EXISTS figures (
    id BIGSERIAL PRIMARY KEY,
    owner_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    character_name TEXT NOT NULL CHECK (length(trim(character_name)) BETWEEN 1 AND 150),
    made_on DATE,
    description TEXT CHECK (description IS NULL OR length(description) <= 2000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS figures_owner_made_on_idx
    ON figures(owner_user_id, made_on DESC);

-- R2-backed inspiration photos, gallery posters, and 3D model files.
CREATE TABLE IF NOT EXISTS assets (
    id BIGSERIAL PRIMARY KEY,
    figure_id BIGINT NOT NULL REFERENCES figures(id) ON DELETE CASCADE,
    asset_type TEXT NOT NULL CHECK (
        asset_type IN ('inspiration_image', 'gallery_poster', 'display_model', 'source_model')
    ),
    storage_key TEXT NOT NULL UNIQUE,
    original_filename TEXT,
    content_type TEXT NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
    caption TEXT CHECK (caption IS NULL OR length(caption) <= 500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (figure_id, asset_type)
);

CREATE INDEX IF NOT EXISTS assets_figure_id_idx ON assets(figure_id);

COMMIT;
