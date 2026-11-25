# Frontend App Boundary

Owns startup, routing, authentication gating, and top-level layout. It must not
contain domain business logic.

- `AppLayout.jsx` — the shared shell (navigation + content outlet).
- `ProtectedRoute.jsx` — redirects signed-out visitors to `/login` and
  remembers where they were going. The backend remains authoritative.

The clay gallery at `/` is public. Picking a GLB while signed in shows it
immediately and starts the save. The backend checks uploader permission.
If a save fails, the unsaved preview remains available for editing and retry.

Routes are declared in `src/App.jsx`. Add an actor/organization context here
when the backend identity domain grows organizations and roles.
