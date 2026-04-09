# Assumptions and Design Decisions

## Assumptions

1. TypeScript migration should preserve visible patch-by-patch progress.
2. Backend runs with Docker Compose in local development.
3. RabbitMQ and MongoDB are mandatory from early phase.
4. Worker remains in the same Node.js codebase (separate process, not separate app).

## Design Decisions

## Language and Runtime

- TypeScript with strict compiler settings.
- ESM module system.

## Infrastructure

- Docker Compose services: `api`, `worker`, `mongo`, `rabbitmq`.
- Dedicated `.env.docker` for container networking.
- Local `.env` supports host-based runs.

## Reliability

- RabbitMQ connection includes retry/backoff at startup to avoid race-condition crashes.

## Code Organization

- Modular layered structure:
  - config
  - routes
  - controllers
  - services
  - middleware
  - bootstrap

## Documentation Policy

All four docs under `docs/` are living documents and must be updated with each functional patch.
