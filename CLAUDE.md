# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Agent Rules

## Clarification
- Never guess when there is a concern — ask immediately and wait for confirmation before proceeding
- If the source differs from the plan or requirements → describe the difference and ask, do not decide unilaterally
- Do not assume behavior of code that has not been read

## Reading Source
- Only read files directly related to the current task — do not scan the entire codebase
- Always read before writing any code
- If a required file cannot be found → ask, do not guess the path

## Reuse & Convention
- Prefer reusing existing components, utilities, and patterns in the codebase
- Do not create new abstractions if an equivalent already exists
- Respect existing naming conventions — if reality differs from the plan, follow reality
- Do not change existing behavior unless explicitly instructed

## Commands

**Package manager:** pnpm

```bash
# Development
pnpm run dev          # Watch mode (preferred for local dev)
pnpm run start        # Non-watch dev mode
pnpm run build        # Production build (NestJS CLI + alias resolution)

# Code quality
pnpm run lint         # ESLint with auto-fix
pnpm run format       # Prettier format

# Testing
pnpm run test         # Unit tests (Jest)
pnpm run test:watch   # Watch mode
pnpm run test:cov     # With coverage report
pnpm run test:e2e     # E2E tests (supertest)

# Run a single test file
pnpm run test -- --testPathPattern=post.service

# Docker (local infrastructure)
pnpm run docker:up    # Start app + Redis
pnpm run docker:down  # Stop containers
pnpm run docker:logs  # Tail logs
```

**Git hooks:** Lefthook runs ESLint + Jest on staged files at pre-commit, and full test suite at pre-push.

## Architecture

NestJS backend for a social platform (Snaplet). Uses MongoDB via Mongoose, Redis for caching and pub/sub, BullMQ for job queues, Socket.io for real-time communication, and Firebase for push notifications.

**Entry point:** `src/main.ts` → bootstraps with Helmet, CORS, global validation pipe, Redis WebSocket adapter.

**Root module:** `src/app.module.ts` registers global providers:
- `FingerprintGuard` — validates every request has a recognized device fingerprint
- `HttpExceptionFilter` + `DeviceRegistrationCleanupFilter` — error handling
- `LoggingInterceptor` + `TransformInterceptor` — request/response pipeline

### Path Aliases

Configured in `tsconfig.json` and resolved at build time:
- `@common/*` → `src/common/*`
- `@config/*` → `src/config/*`
- `@database/*` → `src/database/*`
- `@modules/*` → `src/modules/*`
- `@infrastructure/*` → `src/infrastructure/*`

### Module Structure

Each feature module under `src/modules/` follows: `controller → service → repository → schema`.

| Module | Responsibility |
|---|---|
| `auth` | JWT auth, Google OAuth, device registration, token refresh |
| `posts` | Post CRUD, reactions, unread tracking via BullMQ queue |
| `relationships` | Friend requests/follows with Redis caching |
| `users` | User profiles |
| `media` | File uploads to Cloudflare R2 (S3-compatible), presigned URLs, scheduled cleanup |
| `notifications` | Firebase push notifications via BullMQ queue |
| `socket` | WebSocket gateway with Redis pub/sub adapter |
| `cache` | Redis-backed cache service with tag-based invalidation |
| `health` | Health check endpoints |

### Key Patterns

- **Repositories** (`*.repository.ts`) wrap Mongoose models and extend `AbstractRepository` from `@database/abstract.repository`.
- **Event-driven** flow via `EventEmitter2`: e.g., post creation events trigger notification and unread jobs.
- **BullMQ workers** handle async work: `posts-unread` queue and `notifications` queue, each with configurable drain delays and lock durations via environment.
- **Caching** uses a custom `CacheService` in `src/common/redis/` — invalidate by tag when mutating entities.
- **Schemas** extend `AbstractSchema` (`src/database/abstract.schema.ts`) for common fields (`_id`, timestamps).

### Configuration

All environment variables are centralized in `src/config/configuration.ts` (130+ vars) and validated via Joi schema in `src/config/env.validation.ts`. Key groups: MongoDB, JWT, Redis, BullMQ tuning, R2/S3, Firebase, Google OAuth, throttling, CORS.

## CI/CD

GitHub Actions (`.github/workflows/staging.yml`):
- **PR to `staging`/`master`**: lint + test
- **Push to `staging`**: deploy to staging EC2 via SSH
- **Push to `master`**: deploy to production EC2 via SSH
