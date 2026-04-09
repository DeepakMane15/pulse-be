# User Manual

This manual captures user-facing behavior for the current backend stage.

## Current Usable Flow

1. Start services via Docker Compose.
2. Call health endpoint (`/api/health`) to verify backend status.

## Planned User Journey (Patch Roadmap)

1. User login
2. Tenant and role-based access
3. Video upload
4. Processing progress updates
5. Streaming playback
6. Admin management actions

## Roles (Planned)

- `viewer`: read-only access
- `editor`: upload/edit video content
- `admin`: tenant-level management
- `super_admin`: global management

## Access Notes

Role behavior and endpoint-level restrictions will be introduced incrementally in migration patches and reflected in `docs/API.md`.
