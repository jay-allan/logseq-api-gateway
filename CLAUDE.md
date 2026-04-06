# Claude Instructions

Instructions and learnings for Claude instances working on this project. Read [PLAN.md](PLAN.md) for the implementation roadmap and [DEVELOPMENT.md](DEVELOPMENT.md) for architecture and contributor guidelines before starting any work.

---

## Core working rules

**TDD first — no Bash scripts for testing.**
Write tests before implementation. All verification must go through Jest (`npm test`), not curl commands or Bash scripts. The test infrastructure uses in-memory SQLite and `fastify.inject()` — no real server or Logseq instance is needed. See DEVELOPMENT.md for test patterns.

**Keep documentation updated at milestones.**
After completing a meaningful phase or significant feature, update:
- `PLAN.md` — check off completed items, update phase status
- `README.md` — update "Currently available endpoints" table if new routes ship
- `DEVELOPMENT.md` — add gotchas or patterns discovered during implementation

---

## Project conventions

- **4 spaces, single quotes, no trailing commas, 80-char width** (Prettier config from ts-base)
- **CommonJS output** — TypeScript `import/export` compiles to `require()`; this is intentional
- **bcrypt rounds** — 4 in `NODE_ENV=test`, 12 in production (`src/auth/password.ts`)
- **`__dirname` paths** — never resolve migration paths inside `db/client.ts`; always pass `migrationsDir` explicitly from the call site (tsc, Parcel, and ts-node each place `__dirname` in a different location)
- **Drizzle camelCase** — `$inferSelect` maps `snake_case` DB columns to camelCase; use `storedToken.userId`, not `storedToken.user_id`
- **Shared schemas** — register via `app.addSchema()` in `src/plugins/swagger.ts` before the swagger plugin; inline response objects in route schemas will not appear in `/openapi.json`
- **Write queue** — all Logseq write operations go through `enqueueWrite()` from `src/write-queue/index.ts`; never call the Logseq client directly from a write route

## OpenAPI requirements (enforced by rmoa in prebuild)

Every route must have:
- `tags`, `summary`, `description`
- All 4xx/5xx response codes documented
- All response bodies use `$ref` to named component schemas
- All parameters have `description`

Run `npm run lint:openapi` to check before pushing.

## Key files

| File | Purpose |
|------|---------|
| `src/config.ts` | Zod env validation — add new env vars here |
| `src/db/schema.ts` | Drizzle schema — source of truth; `npm run db:generate` after changes |
| `src/auth/rbac.ts` | Permission matrix — add new permissions here |
| `src/plugins/swagger.ts` | Shared OpenAPI schemas — register here with `app.addSchema()` |
| `src/write-queue/index.ts` | Mutex write queue — wrap all Logseq writes |
| `test/helpers.ts` | `buildTestApp()` — use for all route tests |
| `test/setup.ts` | Jest `setupFiles` — sets process.env before module load |
