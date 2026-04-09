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

### GET `/api/users`

- Access: Protected (`MANAGE_USERS` clearance; admin + super-admin)
- Purpose: list users
- Behavior:
  - super-admin gets users across tenants
  - admin gets users only in own tenant

### GET `/api/users/:userId`

- Access: Protected (`MANAGE_USERS` clearance; admin + super-admin)
- Purpose: get user by id
- Behavior:
  - super-admin can access any user
  - admin can access only users in own tenant
- Common errors:
  - `400` invalid userId
  - `403` cross-tenant access denied
  - `404` user not found

### PATCH `/api/users/:userId`

- Access: Protected (`MANAGE_USERS` clearance; admin + super-admin)
- Purpose: update user
- Body:
  - one or more of `email`, `password`, `roleId`, `roleName`, `isActive`
- Behavior:
  - super-admin can update any user
  - admin can update only users in own tenant
- Common errors:
  - `400` invalid userId / empty payload
  - `403` cross-tenant update denied
  - `404` user not found
  - `409` email already exists

### DELETE `/api/users/:userId`

- Access: Protected (`MANAGE_USERS` clearance; admin + super-admin)
- Purpose: delete user
- Behavior:
  - super-admin can delete any user
  - admin can delete only users in own tenant
- Common errors:
  - `400` invalid userId
  - `403` cross-tenant delete denied
  - `404` user not found

### POST `/api/tenants`

- Access: Protected (`GLOBAL_ADMIN` only; super-admin)
- Purpose: create tenant
- Body:
  - `name` (required)
  - `slug` (optional)
  - `status` (optional: `active|suspended|archived`)
- Common errors:
  - `400` invalid payload
  - `403` insufficient clearance
  - `409` tenant slug already exists

### GET `/api/tenants`

- Access: Protected (`GLOBAL_ADMIN` only; super-admin)
- Purpose: list tenants
- Response:
  - ordered by `createdAt` descending

### PATCH `/api/tenants/:tenantId`

- Access: Protected (`GLOBAL_ADMIN` only; super-admin)
- Purpose: update tenant
- Body:
  - one or more of `name`, `slug`, `status`
- Common errors:
  - `400` invalid tenantId / empty payload
  - `403` insufficient clearance
  - `404` tenant not found
  - `409` tenant slug already exists

### DELETE `/api/tenants/:tenantId`

- Access: Protected (`GLOBAL_ADMIN` only; super-admin)
- Purpose: delete tenant
- Common errors:
  - `400` invalid tenantId
  - `403` insufficient clearance
  - `404` tenant not found

## Swagger

- Swagger route is configured at `/api/docs`.
- Swagger includes `health`, `auth/login`, full user APIs, and tenant CRUD routes.
