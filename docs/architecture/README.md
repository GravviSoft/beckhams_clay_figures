# Platform Architecture

This directory records the approved architecture, module conventions, and
accepted decisions. The root `README.md` is the operating manual; these files
are the detailed standards it points to.

## Guiding principles

- One modular monolith: one repository, one deployment, explicit business domains.
- One canonical identity per person and one canonical record per business entity.
- Backend authorization is authoritative; the frontend only hides what is unavailable.
- Deny by default. Every query is scoped to the authenticated actor.
- Introduce modules through tested vertical slices, not mechanical file moves.
- Numbered, append-only, checksum-recorded migrations.
- Docker-only frontend tooling.

## Documents

- [Project structure](project-structure.md)
- [Domain ownership](domain-ownership.md)
- [Backend module standard](backend-module-standard.md)
- [Frontend module standard](frontend-module-standard.md)
- [Architecture decisions](decisions/README.md)
