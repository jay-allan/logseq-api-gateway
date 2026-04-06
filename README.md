# Logseq API Gateway

A REST API Gateway that sits in front of a [Logseq](https://logseq.com) HTTP API instance. It exposes a clean, versioned REST interface to Logseq's graph data while adding multi-user security, write serialization, and full API documentation.

## Why this exists

Logseq's built-in HTTP API is a single `POST /api` endpoint designed for plugin use. It has no concept of multiple users, no access control, and no protection against concurrent write operations. This gateway solves all three:

- **Multi-user access** — JWT-based authentication with role-based access control
- **Write safety** — a serialization queue ensures only one write executes at a time, preventing data corruption in concurrent scenarios
- **API quality** — a proper REST interface with OpenAPI 3.1 documentation validated by `rmoa`

## Prerequisites

- Node.js 20+
- A running Logseq desktop instance with the HTTP API server enabled
  - In Logseq: *Settings → Features → HTTP APIs server* → enable and copy the token

## Installation

```bash
git clone <repo-url>
cd logseq-api-gateway
npm install
cp .env.example .env
# Edit .env with your values (see Configuration below)
```

## Configuration

All configuration is via environment variables. Copy `.env.example` to `.env` and set:

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `3000` | Port to listen on |
| `NODE_ENV` | No | `development` | `development`, `production`, or `test` |
| `JWT_SECRET` | Yes | — | Secret for signing access tokens (min 16 chars) |
| `JWT_REFRESH_SECRET` | Yes | — | Secret for signing refresh tokens (min 16 chars) |
| `JWT_ACCESS_TTL` | No | `900` | Access token lifetime in seconds (default: 15 min) |
| `JWT_REFRESH_TTL` | No | `604800` | Refresh token lifetime in seconds (default: 7 days) |
| `LOGSEQ_BASE_URL` | No | `http://localhost:12315` | URL of the Logseq HTTP API server |
| `LOGSEQ_TOKEN` | Yes | — | Logseq HTTP API token |
| `DB_PATH` | No | `./data/gateway.db` | Path to the SQLite database file |
| `WRITE_QUEUE_MAX_DEPTH` | No | `50` | Max queued writes before returning 503 |
| `WRITE_QUEUE_TIMEOUT_MS` | No | `30000` | Per-write operation timeout in ms |
| `ADMIN_USERNAME` | Seed only | — | Initial admin username (used by `npm run seed`) |
| `ADMIN_PASSWORD` | Seed only | — | Initial admin password (used by `npm run seed`) |

Generate secure secrets with:

```bash
openssl rand -base64 64
```

## First-time setup

Create the initial admin user:

```bash
ADMIN_USERNAME=admin ADMIN_PASSWORD=your-password npm run seed
```

## Running

**Development** (watch mode, auto-restart on changes):

```bash
npm run dev
```

**Production build and start:**

```bash
npm run build   # type-checks, lints OpenAPI, bundles with Parcel
npm start
```

## API

Once running, the full interactive API documentation is available at:

```
http://localhost:3000/docs
```

The raw OpenAPI 3.1 spec is at:

```
http://localhost:3000/openapi.json
```

### Authentication

All endpoints except `/health`, `/auth/login`, `/auth/refresh`, and `/docs` require a Bearer token.

**Login:**

```bash
curl -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username": "admin", "password": "your-password"}'
```

Response:

```json
{
  "accessToken": "<jwt>",
  "refreshToken": "<opaque-token>"
}
```

Use the `accessToken` in subsequent requests:

```bash
curl http://localhost:3000/admin/users \
  -H 'Authorization: Bearer <accessToken>'
```

**Refresh an expired access token:**

```bash
curl -X POST http://localhost:3000/auth/refresh \
  -H 'Content-Type: application/json' \
  -d '{"refreshToken": "<refreshToken>"}'
```

Refresh tokens are single-use and rotated on every call.

### Roles and permissions

| Permission | viewer | editor | admin |
|---|:---:|:---:|:---:|
| Read pages, blocks, journals, tags, properties | ✓ | ✓ | ✓ |
| Write pages, blocks, journals | | ✓ | ✓ |
| Execute Datalog queries | | ✓ | ✓ |
| Manage users (`/admin/users`) | | | ✓ |
| View queue status (`/admin/queue`) | | | ✓ |

### Planned endpoints (Phase 4+)

The following are planned but not yet available:

| Group | Endpoint | Notes |
|---|---|---|
| Blocks | `DELETE /blocks/:uuid` | Returns 501 — Logseq method name unconfirmed |

### Currently available endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | None | Liveness check; reports Logseq reachability and queue depth |
| `POST` | `/auth/login` | None | Exchange credentials for token pair |
| `POST` | `/auth/refresh` | None | Rotate refresh token |
| `GET` | `/admin/users` | admin | List all users |
| `POST` | `/admin/users` | admin | Create a user |
| `GET` | `/admin/users/:id` | admin | Get a user |
| `PATCH` | `/admin/users/:id` | admin | Update a user |
| `DELETE` | `/admin/users/:id` | admin | Delete a user |
| `GET` | `/admin/roles` | admin | View the role permission matrix |
| `GET` | `/admin/queue` | admin | View write queue status |
| `GET` | `/pages` | viewer+ | List all pages (paginated) |
| `GET` | `/pages/:name` | viewer+ | Get a page by name |
| `GET` | `/pages/:name/blocks` | viewer+ | Get page block tree |
| `GET` | `/pages/:name/links` | viewer+ | Get pages that reference this page |
| `GET` | `/blocks/:uuid` | viewer+ | Get a block (`?children=true` for tree) |
| `GET` | `/blocks/:uuid/properties` | viewer+ | Get block properties |
| `GET` | `/journals` | viewer+ | List all journal pages (paginated, newest first) |
| `GET` | `/journals/:date` | viewer+ | Get journal page for a date (YYYY-MM-DD) |
| `GET` | `/tags` | viewer+ | List all tags (paginated) |
| `GET` | `/tags/:name/blocks` | viewer+ | Get blocks carrying a tag |
| `GET` | `/properties` | viewer+ | List all property schemas (paginated) |
| `POST` | `/pages` | editor+ | Create a page |
| `PATCH` | `/pages/:name` | editor+ | Rename a page |
| `DELETE` | `/pages/:name` | editor+ | Delete a page |
| `POST` | `/pages/:name/blocks` | editor+ | Append a block to a page |
| `POST` | `/blocks/:uuid/children` | editor+ | Insert a child block |
| `POST` | `/blocks/:uuid/siblings` | editor+ | Insert a sibling block |
| `POST` | `/blocks/:uuid/batch` | editor+ | Batch insert blocks |
| `PATCH` | `/blocks/:uuid` | editor+ | Update block content |
| `PATCH` | `/blocks/:uuid/properties` | editor+ | Upsert a block property |
| `DELETE` | `/blocks/:uuid/properties/:key` | editor+ | Remove a block property |
| `POST` | `/blocks/:uuid/move` | editor+ | Move a block |
| `POST` | `/journals/:date` | editor+ | Create journal page (YYYY-MM-DD) |
| `POST` | `/query` | editor+ | Execute a Datalog query |
| `GET` | `/docs` | None | Swagger UI |
| `GET` | `/openapi.json` | None | Raw OpenAPI 3.1 spec |

## Write queue

Logseq was not designed for concurrent writes. The gateway serializes all write operations through an in-memory FIFO mutex. At most one write executes against Logseq at any given time; others wait in a queue.

If the queue is full (`WRITE_QUEUE_MAX_DEPTH`) or an operation exceeds `WRITE_QUEUE_TIMEOUT_MS`, the gateway returns `503 Service Unavailable` with a `Retry-After: 5` header. The current queue depth is always visible on `GET /health` and `GET /admin/queue`.

## Health check

```bash
curl http://localhost:3000/health
```

```json
{
  "status": "ok",
  "queueDepth": 0,
  "logseqReachable": true
}
```

`status` is `"degraded"` and the response code is `503` when Logseq is unreachable or the write queue is non-empty. The gateway does not crash on startup if Logseq is unavailable — it will reconnect on the next request.
