# API Documentation

Base URL: `http://localhost:4000`

## Authentication

Most APIs are planned to use:

```http
Authorization: Bearer <access_token>
```

In the first-commit baseline, only health route is actively wired.

## Implemented Endpoints (Current)

### GET `/api/health`

- Access: Public
- Purpose: Service health check
- Response:

```json
{
  "status": "ok",
  "service": "video-platform-backend-ts",
  "timestamp": "2026-04-09T00:00:00.000Z"
}
```

## Planned Endpoint Groups (Migration Patches)

- Auth: register/login
- Tenants: create/list/update/delete (super-admin)
- Users: create/manage (admin/super-admin)
- Videos: upload/list/processing/stream

## Swagger

- Swagger route is configured at `/api/docs`.
- Current spec is scaffold-level and will be expanded as endpoints are migrated.
