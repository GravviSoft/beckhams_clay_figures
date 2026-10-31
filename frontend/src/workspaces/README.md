# Frontend Workspaces

A workspace composes domain UI into one role-specific experience (its own
navigation and default route). Workspaces contain layout and composition only;
business UI and state live in `domains/`.

- `dashboard/` — the default signed-in workspace.

Add role workspaces (for example `admin/`, `customer/`) when real roles exist.
