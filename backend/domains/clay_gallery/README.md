# Clay Gallery Domain

Owns Beck's physical clay-figure records and the metadata for their R2-backed
inspiration images, gallery posters, display models, and source models.

## Endpoint

- `GET /api/figures` — publicly list figures and asset metadata for the gallery.
- `GET /api/figures/authoring` — return editable figure IDs and feature permission for the signed-in account.
- `POST /api/figures` — save a GLB and an optional JPEG or PNG poster under the signed-in account.
- `POST /api/figures/uploads` — authorize a signed PUT for a single staged GLB.
- `POST /api/figures/uploads/finish` — verify and publish the staged GLB for its uploader.
- `PUT /api/figures/<id>/thumbnail` — attach a generated thumbnail with figure ownership checks.
- `PATCH /api/figures/<id>` — update the owner's saved details and optionally replace the poster.
- `GET /api/figures/<id>/assets/<type>` — stream a display GLB or poster from R2.

### Prepare web assets for a large saved model

Run Blender in background mode with `--python-exit-code 1 --python
backend/domains/clay_gallery/render_web_assets.py -- <original.glb>
<existing-output-directory>`. Review `web.glb` and `thumbnail.jpg` before
publishing. Stage both generated files in a temporary directory in the running
backend container, then run `python scripts/publish_figure_web_assets.py
<figure-id> <original-md5> <web.glb-path> <thumbnail.jpg-path>`. The command
checks the source checksum against R2, preserves the original and any
existing derivative, and attaches the new assets only after storage succeeds.

### Pilot direct web-model delivery

Allow `GET` from the exact development and production gallery origins in the
R2 bucket CORS policy. Preserve any existing upload rules. Test a signed GET
with the actual browser origin before setting `CLAY_GALLERY_DIRECT_WEB_MODELS=1`
and recreating the backend. The switch redirects only optimized `web_model`
GET requests to a five-minute signed R2 URL. The original GLB, posters, and
retry requests retain their existing relay paths.

Compare a cold browser download and the time until the model can rotate.
Signed R2 delivery bypasses Flask. A CDN-cached endpoint for public derivatives
can be evaluated separately if the direct path still needs improvement.

Viewing is public. Any signed-in account can upload and edit its own figures.
The `CLAY_GALLERY_OWNER_USER_ID` setting controls the gallery-wide featured
model action. The browser sends files
to the backend, which writes them to R2 before saving the figure and its assets
in one database transaction.

Object bytes remain in R2. This domain stores stable object keys and metadata,
never R2 credentials, binary files, or expiring presigned URLs.
