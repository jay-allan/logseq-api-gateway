# Logseq API Gateway

A REST API Gateway that sits in front of a [Logseq](https://logseq.com) HTTP API instance. It exposes a clean, versioned REST interface to Logseq's graph data while adding multi-user security, write serialization, and full API documentation.

## Why this exists

Logseq's built-in HTTP API is a single `POST /api` endpoint designed for plugin use. It has no concept of multiple users, no access control, and no protection against concurrent write operations. This gateway solves all three:

- **Multi-user access** — JWT-based authentication with role-based access control
- **Write safety** — a serialization queue ensures only one write executes at a time, preventing data corruption in concurrent scenarios
- **API quality** — a proper REST interface with OpenAPI 3.1 documentation validated by `rmoa`

## Logseq built-in API vs this gateway

| Feature | Logseq built-in HTTP API | This gateway |
|---|:---:|---|
| **API style** | Single `POST /api` endpoint; callers specify the method name in the body | ✅ Resource-oriented REST (`GET /pages/:name`, `PATCH /blocks/:uuid`, …) |
| **Authentication** | ⚠️ Single shared token in the `Authorization` header | ✅ JWT access tokens (15 min) + rotating refresh tokens (7 days) per user |
| **Multiple users** | ❌ One token for all callers | ✅ Each user has their own credentials and session |
| **Access control** | ❌ Any token holder can call any method | ✅ Role-based: `viewer` (read-only), `editor` (read/write), `admin` (full) |
| **Concurrent write safety** | ❌ Parallel writes can corrupt graph data | ✅ In-memory FIFO mutex; at most one write runs at a time |
| **API documentation** | ❌ None | ✅ OpenAPI 3.1 spec + Swagger UI at `/docs`; validated by `rmoa` |
| **Rate limiting** | ❌ None | ✅ Global limit + stricter per-route limit on auth endpoints |
| **User management** | ❌ None | ✅ Full CRUD via `/admin/users`; password reset revokes existing sessions |
| **Health endpoint** | ❌ None | ✅ `GET /health` reports Logseq reachability and write queue depth |
| **Request tracing** | ❌ None | ✅ `X-Request-Id` echoed on every response; included in server logs |
| **Intended use** | Local plugin automation from the same machine | Multi-client remote access (scripts, CI, integrations, team tools) |

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

### Known limitations

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

## Administering users

There is no web interface. All user management is done through the REST API. This section is a complete operational guide for managing users, roles, and access using `curl`.

### Before you start — store your token

Typing a JWT on every command is error-prone. Store it in a shell variable immediately after login:

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username": "admin", "password": "your-password"}' \
  | jq -r '.accessToken')
```

All examples below use `$TOKEN`. Access tokens expire after 15 minutes (configurable via `JWT_ACCESS_TTL`). When the token expires, re-run the login command to get a fresh one, or use the refresh token flow described in the [Authentication](#authentication) section.

---

### Create a user

```bash
curl -s -X POST http://localhost:3000/admin/users \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "username": "alice",
    "password": "SecurePass1!",
    "role": "editor",
    "email": "alice@example.com"
  }'
```

- `username` — minimum 3 characters, must be unique
- `password` — minimum 8 characters
- `role` — one of `admin`, `editor`, or `viewer` (see [Roles and permissions](#roles-and-permissions))
- `email` — optional

**Response (201):**

```json
{
  "id": "3f2b1a00-...",
  "username": "alice",
  "email": "alice@example.com",
  "role": "editor",
  "isActive": true,
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T10:30:00.000Z"
}
```

Save the `id` from the response — you need it for all subsequent operations on that user.

**Error responses:**
- `400` — validation failure (username too short, password too short, invalid role)
- `409` — username already taken

---

### List all users

```bash
curl -s http://localhost:3000/admin/users \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.data[] | {id, username, role, isActive}'
```

This is the primary way to find a user's `id`. The response is an array under the `data` key:

```json
{
  "data": [
    {
      "id": "1a2b3c4d-...",
      "username": "admin",
      "role": "admin",
      "isActive": true,
      "createdAt": "...",
      "updatedAt": "..."
    },
    {
      "id": "3f2b1a00-...",
      "username": "alice",
      "email": "alice@example.com",
      "role": "editor",
      "isActive": true,
      "createdAt": "...",
      "updatedAt": "..."
    }
  ]
}
```

To find a user's ID by username:

```bash
curl -s http://localhost:3000/admin/users \
  -H "Authorization: Bearer $TOKEN" \
  | jq -r '.data[] | select(.username == "alice") | .id'
```

---

### Get a single user

```bash
curl -s http://localhost:3000/admin/users/<id> \
  -H "Authorization: Bearer $TOKEN"
```

Returns `404` if the ID does not exist.

---

### Change a user's role

```bash
curl -s -X PATCH http://localhost:3000/admin/users/<id> \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"role": "viewer"}'
```

Valid values: `admin`, `editor`, `viewer`. The change takes effect immediately — the user's next authenticated request will use the new role. Any existing access token they hold remains valid until it expires (up to 15 minutes); the new role is enforced on the next login.

---

### Update a user's email

```bash
curl -s -X PATCH http://localhost:3000/admin/users/<id> \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"email": "newemail@example.com"}'
```

---

### Reset a user's password

```bash
curl -s -X PATCH http://localhost:3000/admin/users/<id> \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"password": "NewPassword1!"}'
```

The new password is hashed immediately and all of the user's existing refresh tokens are revoked. Their current access token remains valid until it expires (up to 15 minutes), after which they must log in again with the new password.

---

### Deactivate a user

Deactivation is **reversible** and prevents the user from logging in or refreshing their session without deleting their account or history.

```bash
curl -s -X PATCH http://localhost:3000/admin/users/<id> \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"isActive": false}'
```

A deactivated user:
- Cannot log in (login returns `401`)
- Cannot use their refresh token to get a new access token (refresh returns `401`)
- Retains their account, role, and refresh token records in the database

To reactivate:

```bash
curl -s -X PATCH http://localhost:3000/admin/users/<id> \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"isActive": true}'
```

---

### Combine multiple updates in one request

`PATCH` accepts any combination of `role`, `email`, `password`, and `isActive` in a single request:

```bash
curl -s -X PATCH http://localhost:3000/admin/users/<id> \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "role": "viewer",
    "email": "readonly@example.com",
    "isActive": true
  }'
```

---

### Delete a user

Deletion is **permanent**. The user's account and all their refresh tokens are removed immediately.

```bash
curl -s -X DELETE http://localhost:3000/admin/users/<id> \
  -H "Authorization: Bearer $TOKEN"
```

Returns `204 No Content` on success, `404` if the ID does not exist. There is no confirmation step — double-check the ID before running this command.

> **Tip:** if you are unsure, deactivate the user first (`"isActive": false`) to cut off their access while you confirm the decision. Delete once confirmed.

---

### View the role permission matrix

To see the exact permissions granted to each role:

```bash
curl -s http://localhost:3000/admin/roles \
  -H "Authorization: Bearer $TOKEN" \
  | jq
```

```json
{
  "viewer": [
    "pages:read", "blocks:read", "journals:read", "tags:read", "properties:read"
  ],
  "editor": [
    "pages:read", "pages:write", "blocks:read", "blocks:write",
    "journals:read", "journals:write", "tags:read", "properties:read", "query:execute"
  ],
  "admin": [
    "pages:read", "pages:write", "blocks:read", "blocks:write",
    "journals:read", "journals:write", "tags:read", "properties:read",
    "query:execute", "admin:users", "admin:queue"
  ]
}
```

---

### Monitor the write queue

```bash
curl -s http://localhost:3000/admin/queue \
  -H "Authorization: Bearer $TOKEN"
```

```json
{
  "depth": 0,
  "maxDepth": 50,
  "timeoutMs": 30000
}
```

- `depth` — number of write operations currently waiting to execute
- `maxDepth` — threshold at which new writes are rejected with `503`
- `timeoutMs` — maximum time a single write operation is allowed to run

A non-zero `depth` that is not clearing indicates a write operation is hung. Check the gateway logs for timeout errors.

---

### Quick-reference cheat sheet

```bash
# Store token
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"<pw>"}' | jq -r '.accessToken')

# List users (show id + username + role)
curl -s http://localhost:3000/admin/users \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.data[] | {id, username, role, isActive}'

# Find a user's ID by username
ID=$(curl -s http://localhost:3000/admin/users \
  -H "Authorization: Bearer $TOKEN" \
  | jq -r '.data[] | select(.username=="alice") | .id')

# Create viewer
curl -s -X POST http://localhost:3000/admin/users \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"username":"bob","password":"Pass1234!","role":"viewer"}'

# Promote to editor
curl -s -X PATCH http://localhost:3000/admin/users/$ID \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"role":"editor"}'

# Reset password
curl -s -X PATCH http://localhost:3000/admin/users/$ID \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"password":"NewPass1!"}'

# Deactivate (reversible)
curl -s -X PATCH http://localhost:3000/admin/users/$ID \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"isActive":false}'

# Reactivate
curl -s -X PATCH http://localhost:3000/admin/users/$ID \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"isActive":true}'

# Delete (permanent)
curl -s -X DELETE http://localhost:3000/admin/users/$ID \
  -H "Authorization: Bearer $TOKEN"
```

---

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
