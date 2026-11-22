# Clay Gallery Domain

Owns Beck's physical clay-figure records and the metadata for their R2-backed
inspiration images, gallery posters, display models, and source models.

## Endpoint

- `GET /api/figures` — list the authenticated user's figures and asset metadata.

Object bytes remain in R2. This domain stores stable object keys and metadata,
never R2 credentials, binary files, or expiring presigned URLs.
