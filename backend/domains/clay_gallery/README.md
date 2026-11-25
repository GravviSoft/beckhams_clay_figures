# Clay Gallery Domain

Owns Beck's physical clay-figure records and the metadata for their R2-backed
inspiration images, gallery posters, display models, and source models.

## Endpoint

- `GET /api/figures` — publicly list figures and asset metadata for the gallery.
- `GET /api/figures/authoring` — return editable figure IDs and feature permission for the signed-in account.
- `POST /api/figures` — save a GLB and an optional JPEG or PNG poster under the signed-in account.
- `PATCH /api/figures/<id>` — update the owner's saved details and optionally replace the poster.
- `GET /api/figures/<id>/assets/<type>` — stream a display GLB or poster from R2.

Viewing is public. Any signed-in account can upload and edit its own figures.
The `CLAY_GALLERY_OWNER_USER_ID` setting controls the gallery-wide featured
model action. The browser sends files
to the backend, which writes them to R2 before saving the figure and its assets
in one database transaction.

Object bytes remain in R2. This domain stores stable object keys and metadata,
never R2 credentials, binary files, or expiring presigned URLs.
