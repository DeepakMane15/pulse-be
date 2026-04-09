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
2. Route module dispatches to controller → service layer.
3. Error middleware handles failures consistently.

## Messaging Flow

1. API and worker each connect to RabbitMQ (retry/backoff on startup).
2. **Video upload**: API writes multipart file to `VIDEO_UPLOAD_TMP_DIR`, inserts `queue_job_logs` (`pending`), publishes payload to `RABBITMQ_VIDEO_QUEUE`, responds `202` with `jobId`.
3. Worker consumes the queue: sets job `processing`, runs sensitivity stub (always `safe`), streams file to S3, creates `Video` on success and sets job `completed` (or `failed` + `errorMessage`).
4. Worker publishes to `RABBITMQ_VIDEO_EVENTS_QUEUE`; API consumer forwards `video:uploaded` on Socket.io.

## Planned Evolution

- Real sensitivity pipeline (frames + Rekognition or similar) before S3 when content may be flagged
- HTTP range streaming from S3 with auth
- DLQ / retries for failed queue jobs
