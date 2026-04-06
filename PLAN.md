# Implementation Plan

## Overview

Build a TypeScript REST API Gateway that sits in front of a Logseq HTTP API instance, translating clean RESTful resource operations into Logseq API calls while adding multi-user RBAC, write serialization, and OpenAPI documentation.

See [DEVELOPMENT.md](DEVELOPMENT.md) for architecture decisions and contributor guidelines.

---

## Phase 1 — Skeleton & Auth ✅ Complete

Infrastructure only; no Logseq integration.

- [x] Project setup from ts-base scaffold (TypeScript 5, CommonJS, Jest, Prettier)
- [x] `config.ts` — Zod-validated env vars; fail-fast on startup
- [x] SQLite client with Drizzle ORM (`initDb`, `closeDb`, explicit migrations path)
- [x] Drizzle schema (`users`, `refresh_tokens`) with generated migrations
- [x] bcrypt password hashing (`src/auth/password.ts`)
- [x] JWT access token helpers (`src/auth/jwt.ts`)
- [x] RBAC permission matrix + `requirePermission()` preHandler (`src/auth/rbac.ts`)
- [x] Fastify app factory with all plugins (swagger, auth, error-handler)
- [x] `GET /health` — liveness check; reports `queueDepth`, `logseqReachable`
- [x] `POST /auth/login` — username/password → JWT access + refresh token pair
- [x] `POST /auth/refresh` — rotate refresh token; return new access token
- [x] `GET/POST /admin/users`, `GET/PATCH/DELETE /admin/users/:id`
- [x] `GET /admin/roles` — static permission matrix
- [x] `GET /admin/queue` — write queue depth
- [x] Seed script (`npm run seed`) for initial admin user
- [x] ParcelJS production bundler with migration copy step
- [x] Full test suite (55 tests): health, auth, admin CRUD, write queue, RBAC
- [x] OpenAPI quality gate (`rmoa` in `prebuild`)
- [x] Documentation: README.md, DEVELOPMENT.md, PLAN.md, CLAUDE.md

**Milestone:** `POST /auth/login` returns JWT; admin CRUD works; all tests pass; `npm run build` succeeds.

---

## Phase 2 — Logseq client + read routes

Depends on: Phase 1

- [ ] `src/logseq/client.ts` — typed `call(method, args)` via native fetch to `POST /api`
- [ ] `src/logseq/methods.ts` — `WRITE_METHODS` set, method name constants
- [ ] `GET /pages` — list all pages (`getAllPages`)
- [ ] `GET /pages/:name` — get a page (`getPage`)
- [ ] `GET /pages/:name/blocks` — page block tree (`getPageBlocksTree`)
- [ ] `GET /pages/:name/links` — linked references (`getPageLinkedReferences`)
- [ ] `GET /blocks/:uuid` — get block, optional `?children=true` (`getBlock`)
- [ ] `GET /blocks/:uuid/properties` — block properties (`getBlockProperties`)
- [ ] `GET /journals` — all journal pages via datascript query
- [ ] `GET /journals/:date` — single journal page (YYYY-MM-DD)
- [ ] `GET /tags` — all tags (`getAllTags`)
- [ ] `GET /tags/:name/blocks` — blocks by tag (`getTagObjects`)
- [ ] `GET /properties` — all properties (`getAllProperties`)
- [ ] Error normalization: Logseq null → 404, network error → 502, validation → 400
- [ ] CORS plugin + rate limiting plugin
- [ ] Tests for all read routes (mocked Logseq client)

**Milestone:** `GET /pages` returns live Logseq data; `GET /health` shows `logseqReachable: true`.

---

## Phase 3 — Write routes

Depends on: Phase 2

All write operations route through `enqueueWrite()` from `src/write-queue/index.ts`.

- [ ] `POST /pages` — create page (`createPage`) ← write queue
- [ ] `PATCH /pages/:name` — rename page (`renamePage`) ← write queue
- [ ] `DELETE /pages/:name` — delete page (`deletePage`) ← write queue
- [ ] `POST /pages/:name/blocks` — append block (`appendBlockInPage`) ← write queue
- [ ] `POST /blocks/:uuid/children` — insert child block (`insertBlock`) ← write queue
- [ ] `POST /blocks/:uuid/siblings` — insert sibling block (`insertBlock`) ← write queue
- [ ] `POST /blocks/:uuid/batch` — batch insert (`insertBatchBlock`) ← write queue
- [ ] `PATCH /blocks/:uuid` — update block content (`updateBlock`) ← write queue
- [ ] `PATCH /blocks/:uuid/properties` — upsert property (`upsertBlockProperty`) ← write queue
- [ ] `DELETE /blocks/:uuid/properties/:key` — remove property (`removeBlockProperty`) ← write queue
- [ ] `POST /blocks/:uuid/move` — move block (`moveBlock`) ← write queue
- [ ] `DELETE /blocks/:uuid` — remove block (verify method name; 501 until confirmed) ← write queue
- [ ] `POST /journals/:date` — create/update journal entry ← write queue
- [ ] `POST /query` — Datalog passthrough (`datascriptQuery`); editor+ only
- [ ] Tests for all write routes verifying serialization behavior

**Milestone:** Full CRUD; 5 concurrent write requests execute in order (verifiable in logs).

---

## Phase 4 — Pagination & list hardening

Depends on: Phase 2

- [ ] `?limit=N&offset=N` query parameters on all list endpoints
- [ ] Response wrapper: `{ data: [...], meta: { total, limit, offset } }`
- [ ] `getAllPages` on large graphs: server-side pagination from day 1
- [ ] Page name URL encoding for namespaced pages (containing `/`)

---

## Phase 5 — OpenAPI quality gate

Depends on: Phase 3

- [ ] All routes have `summary` + `description`
- [ ] All parameters have `description`
- [ ] All 4xx/5xx responses documented on every route
- [ ] All response bodies reference named component schemas
- [ ] `npm run lint:openapi` exits 0 with `--min-score` threshold set
- [ ] Swagger UI renders all routes correctly at `/docs`

**Milestone:** `rmoa` passes in CI; Swagger UI shows complete documentation.

---

## Phase 6 — Hardening & tests

Depends on: Phase 5

- [ ] `X-Request-ID` header propagated through logs and responses
- [ ] Graceful shutdown: drain write queue before closing server
- [ ] Startup: warn (don't crash) if Logseq unreachable at boot
- [ ] Scheduled cleanup: `deleteExpiredTokens()` on interval
- [ ] Integration test: concurrent write serialization (timing assertions)
- [ ] Integration test: admin CRUD end-to-end flow
- [ ] Unit: RBAC matrix exhaustive coverage (all roles × all permissions)
- [ ] Coverage report: `npm test -- --coverage`

**Milestone:** All 6 phases complete; full test suite passes; `npm run build` succeeds; production deployment ready.

---

## Open questions

| # | Question | Status |
|---|----------|--------|
| 1 | `logseq.DB.datascriptQuery` vs `logseq.db.q` naming | Unresolved — verify against running Logseq instance |
| 2 | `deleteBlock` method name in Logseq API | Unresolved — return 501 until confirmed |
| 3 | Page name encoding for namespace pages (containing `/`) | Unresolved — define encoding rule before Phase 3 ships |
