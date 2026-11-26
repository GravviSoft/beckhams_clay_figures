BEGIN;

ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_asset_type_check;
ALTER TABLE assets ADD CONSTRAINT assets_asset_type_check CHECK (
    asset_type IN ('inspiration_image', 'gallery_poster', 'display_model', 'source_model', 'model_thumbnail', 'web_model')
);

COMMIT;
