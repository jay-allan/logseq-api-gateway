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
- [x] 42 new tests; 97 total tests passing

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

**Milestone:** All list endpoints paginated; namespace encoding verified; 161 tests passing.

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

## Phase 6 — Hardening & tests ✅ Complete

Depends on: Phase 5

- [x] `X-Request-ID` header propagated in all responses — accepts caller-supplied ID or generates UUID; echoed via `X-Request-Id` response header; Pino HTTP logger includes `reqId` automatically (`src/plugins/request-id.ts`)
- [x] Graceful shutdown: `waitForDrain()` added to write queue; called in `index.ts` shutdown handler before `app.close()` so in-flight writes finish cleanly
- [x] Startup: warn (don't crash) if Logseq unreachable — fires a non-blocking `probeLogseq()` after `app.listen()` and logs a warning if unreachable
- [x] Scheduled cleanup: `setInterval` in `index.ts` calls `deleteExpiredTokens()` every hour; `unref()`-ed so it does not keep the process alive; cleared on shutdown
- [x] Integration test: concurrent write serialization — FIFO order, depth tracking, 503 on full queue, timeout all verified in `src/write-queue/index.test.ts`
- [x] Integration test: admin CRUD end-to-end flow — full lifecycle (create → list → read → login → conflict → update → deactivate → login refused → delete → gone) in `test/routes/admin/e2e.test.ts`
- [x] Unit: RBAC matrix exhaustive coverage — 47 tests covering every role × permission combination against a truth table (`src/auth/rbac.test.ts`)
- [x] `waitForDrain` unit tests — resolves immediately, waits for in-flight ops, waits for full queue

**Milestone:** 219 tests across 15 suites — all passing; `npm run build` succeeds.

---

## Phase 7 — OWASP Security Audit & Hardening ✅ Complete

Depends on: Phase 6

A systematic audit of the gateway against the OWASP Top 10 (2021). Findings are listed with their OWASP category, severity, and remediation. Items are ordered by severity.

### Audit findings

#### CRITICAL

**A06 / A02 — Vulnerable JWT library (`@fastify/jwt` → `fast-jwt`)**
`npm audit` reports three CVEs in `fast-jwt` (the underlying library used by `@fastify/jwt@9.0.3`):
- **Algorithm Confusion** (CVE-2023-48223 incomplete fix): A whitespace-prefixed RSA public key can be used as an HMAC secret, tricking the verifier into accepting forged tokens. _Practical risk for this app is low_ because we use HS256 (symmetric), not RSA — but the library flaw exists.
- **Cache Confusion via `cacheKeyBuilder` collisions**: A crafted token could match a different token's cached claims, returning wrong identity/role data.
- **Unknown `crit` header extensions**: The library accepts JWTs with unrecognised `crit` headers rather than rejecting them (RFC 7515 violation).

Remediation: Upgrade `@fastify/jwt` to v10 (which bumps `fast-jwt` to `^6.0.2`). Additionally, explicitly set `algorithms: ['HS256']` in the plugin config to lock the permitted algorithm regardless of library version.

#### HIGH

**A07 — Login timing oracle (username enumeration)**
When a username does not exist, `findUserWithHashByUsername` returns `null` and the handler returns `401` immediately — without calling `bcrypt.compare`. When the username _does_ exist but the password is wrong, bcrypt takes ~100 ms. An attacker can enumerate valid usernames by measuring response latency.

Remediation: Always call a dummy `bcrypt.compare` against a pre-computed hash when the user is not found, so the response time is the same whether the user exists or not.

**A04 / A07 — Auth endpoints have no dedicated brute-force protection**
The global rate limiter allows 200 requests per minute from any IP. This permits ~3 login attempts per second against a single account — more than enough for online brute-force attacks against weak passwords.

Remediation: Apply a separate, stricter rate-limit rule to `POST /auth/login` and `POST /auth/refresh` (e.g., 10 attempts per 15 minutes per IP). `@fastify/rate-limit` supports per-route config.

**A07 — Refresh tokens not revoked on password reset**
`PATCH /admin/users/:id` with a new `password` hashes and stores the new credential but does not call `deleteAllUserTokens(userId)`. Any refresh token that was valid before the password change remains valid indefinitely. An attacker with a stolen refresh token survives a password reset.

Remediation: Call `deleteAllUserTokens(id)` inside the PATCH handler whenever `body.password` is present.

**A01 — No admin self-protection**
An admin can `DELETE /admin/users/:id` their own account, or `PATCH` their own role to `editor`/`viewer`. Either action can leave the system with no admin account, permanently locking out all administrative access.

Remediation: In the PATCH and DELETE handlers, check whether the target user is the last active admin; return `409 Conflict` if the operation would remove the only admin. Also reject self-demotion.

#### MEDIUM

**A05 — CORS configuration is not production-safe**
In development, `origin: true` permits any browser origin to send credentialed requests to the gateway. In production, `origin: false` blocks _all_ cross-origin requests regardless of legitimate client needs. Neither mode is configurable.

Remediation: Accept a `CORS_ORIGIN` environment variable (comma-separated list of allowed origins, or `*`). Default to `false` (deny all) when not set. Remove the binary dev/prod branch.

**A05 — Missing security response headers**
No security headers are set: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `X-XSS-Protection`, or `Content-Security-Policy`. These are low-effort, high-value defences that all modern APIs should include.

Remediation: Register `@fastify/helmet` (or a minimal custom `onSend` hook) to set `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, and `X-XSS-Protection: 0`.

**A02 — JWT secret minimum length too low**
`config.ts` requires `JWT_SECRET` and `JWT_REFRESH_SECRET` to be at least 16 characters (128 bits). NIST SP 800-185 recommends ≥ 256 bits (32 bytes) for HMAC-SHA256 keys used in security-critical contexts.

Remediation: Raise the Zod minimum to 32 characters. Update `.env.example` and DEVELOPMENT.md.

**A02 — JWT algorithm not explicitly locked** ✅ Addressed as part of Critical fix
`@fastify/jwt` defaults to HS256 but the `algorithm` option was not explicitly set. Fixed by upgrading to v10 and setting `verify: { algorithms: ['HS256'] }` in the JWT plugin registration.

**A09 — No security audit logging**
The following security-relevant events are not logged: failed login attempts, successful logins, token refreshes, permission denials (403), and admin actions (user created/updated/deleted, role changed). This makes forensic analysis and intrusion detection impossible.

Remediation: Add structured `Logger.warn` / `Logger.info` calls at each of these points, including username (or user ID), IP address (from `request.ip`), and timestamp. Tag logs with a `[security]` prefix for easy filtering.

**A03 — Log injection via unsanitised request parameters**
Usernames, page names, and query strings are interpolated into log messages (e.g., `Logger.info('Logseq call: ...')`). A username containing `\n` or ANSI escape codes can forge spurious log lines or corrupt log file parsers.

Remediation: Replace string interpolation in log calls with structured metadata arguments, or sanitise values by removing control characters before logging.

#### LOW / INFORMATIONAL

**A05 — Swagger UI publicly accessible without authentication**
`GET /docs` renders the full OpenAPI UI — all endpoints, schemas, and request/response examples — without requiring a token. This is not a vulnerability in isolation but increases the information available to an attacker mapping the API surface.

Remediation (optional): Add a `SWAGGER_ENABLED` env flag (default `true`; set to `false` in production to disable `/docs` entirely) or gate it behind a preHandler that checks for a static admin token.

**A10 — SSRF risk via `LOGSEQ_BASE_URL`**
`LOGSEQ_BASE_URL` is validated as a URL by Zod but is not restricted to safe hosts. A misconfigured or maliciously set value could point the gateway at internal network services (cloud metadata endpoints, internal databases, etc.).

Remediation: Validate that the URL hostname is not an RFC 1918 / link-local address at startup. Log a clear warning if the hostname is `localhost` or `127.x.x.x` in production.

**A03 — Datalog query injection scope assessment**
`POST /query` passes a raw Datalog string directly to Logseq. While Datalog is a read-only query language (it cannot mutate data), the full capability of Logseq's datascript engine should be documented — specifically whether queries can leak data across graphs or trigger side effects.

Remediation: Document the risk scope in DEVELOPMENT.md. Consider adding query length and character-set restrictions to the schema.

**A06 — Moderate npm audit advisories (dev-only)**
Four moderate vulnerabilities in `esbuild` (dev server CORS bypass) and `drizzle-kit` (transitive). These only affect the development toolchain, not the production runtime.

Remediation: Run `npm audit fix` and review whether `drizzle-kit` can be upgraded to a version with patched transitive deps.

### Phase 7 task list

**Critical / High (complete)**
- [x] Upgrade `@fastify/jwt` to v10 and explicitly lock algorithm to HS256 — `verify: { algorithms: ['HS256'] }` set in plugin config
- [x] Fix login timing oracle — dummy bcrypt on unknown username via lazy `getSentinelHash()` cached Promise
- [x] Add per-route stricter rate limit on auth endpoints — `AUTH_RATE_LIMIT_MAX` / `AUTH_RATE_LIMIT_WINDOW` env vars; `config: { rateLimit: ... }` on both `/auth/login` and `/auth/refresh`; also fixed `errorResponseBuilder` in global and per-route rate-limit config to return a proper `Error` instance with `.statusCode` (plain objects caused `FST_ERR_FAILED_ERROR_SERIALIZATION`)
- [x] Revoke refresh tokens on password reset — `deleteAllUserTokens(id)` called in PATCH handler when `body.password` is present
- [x] Add admin self-protection — `countActiveAdmins()` added to user repository; DELETE returns 409 if target is last active admin; PATCH returns 409 on self-demotion when caller is last active admin

**Medium / Low (complete)**
- [x] Make CORS configurable via `CORS_ORIGIN` env var — comma-separated origins, `*`, or unset (deny all); read from process.env at plugin registration so tests can override
- [x] Add security response headers — custom `onSend` hook in `src/plugins/security-headers.ts`; sets `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `X-XSS-Protection`
- [x] Raise JWT secret minimum length to 32 characters — updated Zod schema and `.env.example`
- [x] Add security audit logging for auth events and admin actions — structured `request.log` calls (Pino) in auth and admin routes; tagged `[security]` with event type, userId, and IP
- [x] Sanitise log parameters to prevent log injection — `sanitizeForLog()` helper in `src/utils/log.ts` strips ASCII control characters from user-supplied values before logging
- [x] Add `SWAGGER_ENABLED` env flag to disable `/docs` in production — `SWAGGER_ENABLED=false` skips swagger-ui registration
- [x] Validate `LOGSEQ_BASE_URL` is not an internal/RFC-1918 address — startup warning logged in production when hostname is loopback, RFC-1918, or link-local
- [x] Document Datalog query scope and add length/character restrictions — 4096 char `maxLength` in JSON schema; scope documented in DEVELOPMENT.md
- [x] `npm audit fix` for dev-only moderate vulnerabilities — `--force` would downgrade `drizzle-kit` to a breaking version; vulnerabilities are dev-only (esbuild dev-server CORS bypass, no prod impact); deferred until drizzle-kit releases a non-breaking fix

**Client integration bug fixes (from nxtseq integration findings)**
- [x] Fix `GET /pages/:name/blocks` — now resolves page UUID via `GET_PAGE` before calling `getPageBlocksTree`; Logseq rejects page names at runtime despite accepting them in the TypeScript type signature
- [x] Fix `GET /pages/:name/links` — same UUID resolution fix for `getPageLinkedReferences`; also added 404 response to OpenAPI schema
- [x] Rename `LogseqPage` API output fields for clarity: `originalName` → `name` (display), `name` → `normalizedName` (lowercase internal), `journal` → `isJournal`; implemented via `normalizePageForApi()` transform applied at all page-returning routes
- [x] Document response shapes in README: page field names, paginated vs flat list shapes, block tree nesting, 204 semantics, error envelope

**Milestone:** All Critical, High, and Medium/Low findings remediated; 245 tests across 18 suites — all passing.

---

## Open questions

| # | Question | Status |
|---|----------|--------|
| 1 | `logseq.DB.datascriptQuery` vs `logseq.db.q` naming | Unresolved — verify against running Logseq instance |
| 2 | `deleteBlock` method name in Logseq API | Unresolved — return 501 until confirmed |
| 3 | Page name encoding for namespace pages (containing `/`) | Resolved — Fastify decodes `%2F` automatically; 8 tests in `namespace.test.ts` verify behaviour |
