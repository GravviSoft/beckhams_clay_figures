# Shared

Genuinely cross-domain frontend code that is neither a UI primitive nor API
infrastructure (for example formatting helpers used by several domains).

Where shared things already live:

- API client and session: `src/services/api.js`, `src/services/auth.js`
- Authenticated UI primitives: `src/components/authenticated-ui/`
- Loading/empty/error states: `src/components/PageLoader.jsx`, `src/components/StatusState.jsx`

Move code here only when a second domain needs it.
