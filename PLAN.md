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

## Phase 2 — Logseq client + read routes ✅ Complete

Depends on: Phase 1

- [x] `src/logseq/client.ts` — typed `call(method, args)` via native fetch to `POST /api`
- [x] `src/logseq/methods.ts` — `WRITE_METHODS` set, method name constants
- [x] `GET /pages` — list all pages (`getAllPages`)
- [x] `GET /pages/:name` — get a page (`getPage`)
- [x] `GET /pages/:name/blocks` — page block tree (`getPageBlocksTree`)
- [x] `GET /pages/:name/links` — linked references (`getPageLinkedReferences`)
- [x] `GET /blocks/:uuid` — get block, optional `?children=true` (`getBlock`)
- [x] `GET /blocks/:uuid/properties` — block properties (`getBlockProperties`)
- [x] `GET /journals` — all journal pages via datascript query (sorted most-recent first)
- [x] `GET /journals/:date` — single journal page (YYYY-MM-DD); 400 on bad format
- [x] `GET /tags` — all tags (`getAllTags`)
- [x] `GET /tags/:name/blocks` — blocks by tag (`getTagObjects`)
- [x] `GET /properties` — all properties (`getAllProperties`)
- [x] Error normalization: Logseq null → 404, network error → 502
- [x] CORS plugin + rate limiting plugin
- [x] Pagination (`?limit` / `?offset`) on all list endpoints with `meta` wrapper
- [x] 42 tests across 5 test files; 97 total tests passing

**Milestone:** All read endpoints implemented and tested; `GET /pages` returns live Logseq data when connected.

---

## Phase 3 — Write routes ✅ Complete

Depends on: Phase 2

All write operations route through `enqueueWrite()` automatically via the Logseq client's `WRITE_METHODS` set.

- [x] `POST /pages` — create page (`createPage`) ← write queue
- [x] `PATCH /pages/:name` — rename page (`renamePage`) ← write queue
- [x] `DELETE /pages/:name` — delete page (`deletePage`) ← write queue
- [x] `POST /pages/:name/blocks` — append block (`appendBlockInPage`) ← write queue
- [x] `POST /blocks/:uuid/children` — insert child block (`insertBlock`) ← write queue
- [x] `POST /blocks/:uuid/siblings` — insert sibling block (`insertBlock`) ← write queue
- [x] `POST /blocks/:uuid/batch` — batch insert (`insertBatchBlock`) ← write queue
- [x] `PATCH /blocks/:uuid` — update block content (`updateBlock`) ← write queue
- [x] `PATCH /blocks/:uuid/properties` — upsert property (`upsertBlockProperty`) ← write queue
- [x] `DELETE /blocks/:uuid/properties/:key` — remove property (`removeBlockProperty`) ← write queue
- [x] `POST /blocks/:uuid/move` — move block (`moveBlock`) ← write queue
- [x] `DELETE /blocks/:uuid` — returns 501 until Logseq method name confirmed ← write queue
- [x] `POST /journals/:date` — create journal page (`createJournalPage`) ← write queue
- [x] `POST /query` — Datalog passthrough (`datascriptQuery`); editor+ only
- [x] 56 new tests; 153 total tests passing

**Milestone:** Full CRUD implemented; all write operations serialized through write queue.

---

## Phase 4 — Pagination & list hardening ✅ Complete

Depends on: Phase 2

- [x] `?limit=N&offset=N` query parameters on all list endpoints
- [x] Response wrapper: `{ data: [...], meta: { total, limit, offset } }`
- [x] `getAllPages` on large graphs: server-side pagination from day 1
- [x] Page name URL encoding for namespaced pages (containing `/`)
  - Fastify decodes `%2F` in path params automatically — no code changes needed
  - `GET /pages/projects%2Falpha` → `callLogseq('getPage', ['projects/alpha'])`
  - Unencoded slashes (`/pages/projects/alpha`) return 404 (no route match), which is correct
  - Verified with 8 dedicated namespace encoding tests in `src/routes/namespace.test.ts`
- [x] 8 new tests; 161 total tests passing

---

## Phase 5 — OpenAPI quality gate ✅ Complete

Depends on: Phase 3

- [x] All routes have `summary` + `description`
- [x] All parameters have `description`
- [x] All 4xx/5xx responses documented on every route (including `500` and `502`)
- [x] All response bodies reference named component schemas
- [x] `operationId` on every operation (required for SDK generation score)
- [x] `security: []` on public routes (health, login, refresh) to declare intentional no-auth
- [x] `npm run lint:openapi` exits 0 at 87/100 (threshold: 80)
- [x] Dev tooling config separated from app runtime config: `dev.config.json` (gitignored) holds `rmoaApiKey`; `.env` holds only app runtime vars
- [x] `scripts/lint-openapi.ts` reads API key from `dev.config.json` with clear error if missing
- [x] Swagger UI renders all routes correctly at `/docs`

**Milestone:** `rmoa` passes at 87/100 (threshold 80); Swagger UI shows complete documentation; 161 tests passing.

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
| 3 | Page name encoding for namespace pages (containing `/`) | Resolved — Fastify decodes `%2F` automatically; 8 tests in `namespace.test.ts` verify behaviour |
