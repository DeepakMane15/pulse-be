# backend

TypeScript backend scaffold for patch-based migration from the previous JavaScript backend.

## Documentation Package

- Installation and setup guide: `README.md` (this file)
- API documentation: `docs/API.md`
- User manual: `docs/USER_GUIDE.md`
- Architecture overview: `docs/ARCHITECTURE.md`
- Assumptions and design decisions: `docs/ASSUMPTIONS.md`

## Scripts

- `npm run dev` - run API in watch mode
- `npm run dev:api` - run API in watch mode
- `npm run dev:worker` - run worker in watch mode
- `npm run typecheck` - static type-check only
- `npm run build` - compile TypeScript to `dist/`
- `npm run start:api` - run compiled API server
- `npm run start:worker` - run compiled worker process

## Installation and Setup

1. Install dependencies

```bash
npm install
```

2. Configure local environment

```bash
cp .env.example .env
```

3. Start infra and services using Docker Compose

```bash
docker compose up -d --build
```

4. Verify containers

```bash
docker compose ps
docker compose logs api --tail=100
docker compose logs worker --tail=100
```

5. Local non-Docker run (optional)

```bash
npm run typecheck
npm run build
npm run dev:api
```

## Current Scope (First Commit Baseline)

- Node.js + TypeScript scaffold
- Docker setup with `api`, `worker`, `mongo`, `rabbitmq`
- MongoDB and RabbitMQ bootstrapping
- Winston logger setup
- Socket.io bootstrap and registry
- Basic route/controller/service skeletons
- Health endpoint wired

## Documentation Maintenance Rule

For every implementation patch:
- update `docs/API.md` when endpoints or payloads change
- update `docs/USER_GUIDE.md` when user flows or role behavior changes
- update `docs/ARCHITECTURE.md` when components/data flow changes
- update `docs/ASSUMPTIONS.md` when decisions/constraints change

## Migration Intent

Feature sync from previous JS backend will be done in progressive patches to preserve clean commit history and visible milestones.

See: `docs/MIGRATION_PATCH_PLAN.md`
