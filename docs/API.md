# API Documentation

Base URL: `http://localhost:4000`

## Authentication

Protected APIs require:

```http
Authorization: Bearer <access_token>
```

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

### POST `/api/auth/login`

- Access: Public
- Purpose: authenticate user and return access token
- Body:
  - `email` (required)
  - `password` (required)
- Success:
  - `data.accessToken`
  - `data.user` (id, email, tenantId, role, roleId, clearanceLevel, status/timestamps)

### POST `/api/users`

- Access: Protected (`MANAGE_USERS` clearance; admin + super-admin)
- Purpose: create user under tenant scope
- Body:
  - `email` (required)
  - `password` (required)
  - `tenantId` (optional for super-admin, ignored for tenant admin)
  - `roleId` or `roleName` (one required)
  - `isActive` (optional)
- Common errors:
  - `400` invalid payload / missing role / invalid tenant
  - `401` missing/invalid token
  - `403` insufficient clearance
  - `404` tenant not found
  - `409` user already exists

## Swagger

- Swagger route is configured at `/api/docs`.
- Swagger includes `health`, `auth/login`, and `users/create`.
