# Architecture Overview

## High-Level Components

- **API Server**: `src/server.ts`, `src/app.ts`
- **Worker Process**: `src/workers/videoProcessor.ts`
- **Database**: MongoDB (via `src/config/db.ts`)
- **Message Broker**: RabbitMQ (via `src/config/rabbitmq.ts`)
- **Real-time Layer**: Socket.io bootstrap and registry
- **Logging**: Winston (`src/config/logger.ts`)

## Process Model

- One Node.js codebase.
- Two runtime entrypoints:
  - API process
  - Worker process
- Both are orchestrated through Docker Compose.

## Current Request Flow

1. Request enters Express app.
2. Route module dispatches to controller.
3. Controller returns response (scaffold stage).
4. Error middleware handles failures consistently.

## Messaging Flow (Current Baseline)

1. App establishes RabbitMQ channel.
2. Worker starts consumer bootstrap.
3. Retry/backoff guards startup timing for broker readiness.

## Planned Evolution

- Add auth + RBAC middleware flow
- Add tenant/user/video domain models and services
- Expand Swagger from scaffold to full endpoint contract
- Add full processing pipeline and streaming path
