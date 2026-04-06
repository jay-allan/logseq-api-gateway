# Development Guide

## Prerequisites

- Node.js 20+
- npm 10+

```bash
npm install
cp .env.example .env
# Fill in JWT_SECRET, JWT_REFRESH_SECRET, LOGSEQ_TOKEN
```

## Project structure

```
src/
├── index.ts              # Entry point — wires config, DB, app, server
├── app.ts                # Fastify app factory (buildApp)
├── config.ts             # Zod-validated env vars; fails fast on startup
├── Logger.ts             # Winston logger (from ts-base scaffold)
├── auth/
│   ├── jwt.ts            # sign/verify helpers, buildJwtPayload
│   ├── password.ts       # bcrypt hash/verify; rounds=4 in test, 12 in prod
│   └── rbac.ts           # Permission matrix + requirePermission() preHandler
├── db/
│   ├── client.ts         # SQLite singleton + Drizzle init; initDb/closeDb
│   ├── schema.ts         # Drizzle table definitions — source of truth for schema
│   ├── migrations/       # Generated SQL files + meta/ (do not hand-edit)
│   └── repositories/
│       ├── user.repository.ts
│       └── refresh-token.repository.ts
├── logseq/
│   ├── client.ts         # typed call(method, args) via native fetch
│   └── methods.ts        # WRITE_METHODS set + method name constants
├── plugins/
│   ├── auth.ts           # JWT decode plugin; decorates app.authenticate
│   ├── swagger.ts        # OpenAPI config; registers shared schemas
│   └── error-handler.ts  # Normalizes all errors to {error:{code,message}}
├── routes/
│   ├── health.ts
│   ├── auth.ts
│   └── admin/
│       ├── users.ts
│       ├── roles.ts
│       └── queue.ts
├── types/
│   ├── api.ts            # Shared request/response body types
│   ├── fastify.d.ts      # FastifyInstance.authenticate augmentation
│   └── logseq.ts         # LogseqBlock, LogseqPage types
└── write-queue/
    └── index.ts          # async-mutex FIFO; enqueueWrite(); getQueueDepth()
test/
├── setup.ts              # process.env initialization (jest setupFiles)
├── helpers.ts            # buildTestApp() factory
└── routes/
    ├── health.test.ts
    ├── auth.test.ts
    └── admin/
        ├── users.test.ts
        ├── roles.test.ts
        └── queue.test.ts
scripts/
├── seed.ts               # Creates initial admin from ADMIN_USERNAME/ADMIN_PASSWORD
└── generate-openapi.ts   # Boots app without port; writes openapi/spec.json
```

## Development workflow

**Watch mode** (auto-restart on file changes):

```bash
npm run dev
```

This runs `tsc --watch` and `nodemon dist/index.js` concurrently via `concurrently`. The `predev` script copies migration files before watch starts.

**Running tests:**

```bash
npm test              # all tests
npm test -- --watch   # watch mode
npm test -- routes/auth   # single file
```

Tests use in-memory SQLite and `fastify.inject()` — no real server or Logseq instance needed.

## TDD approach

**Always write tests before implementation.** The project uses Jest + ts-jest + `fastify.inject()` for integration tests. The test database uses `:memory:` SQLite with migrations applied fresh per test suite.

Test structure:

```typescript
// test/routes/example.test.ts
import { buildTestApp } from '../helpers';
import type { FastifyInstance } from 'fastify';

describe('GET /example', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = await buildTestApp();
    });

    afterAll(async () => {
        await app.close();
    });

    it('returns 200', async () => {
        const res = await app.inject({ method: 'GET', url: '/example' });
        expect(res.statusCode).toBe(200);
    });
});
```

Use `beforeAll`/`afterAll` (not `beforeEach`) for the app instance when tests within the suite share state (e.g., users created early in the suite). Use `beforeEach`/`afterEach` only when full isolation is needed.

**Never use curl or Bash scripts to verify behavior.** Write a test instead.

## Adding a new route

1. Write the test file first under `test/routes/`.
2. Create the route file under `src/routes/`.
3. Register it in `src/app.ts` with the appropriate prefix.
4. Add OpenAPI schema fields: `summary`, `description`, all response codes.
5. Run `npm run lint:openapi` — it must pass before the build succeeds.

Every route needs:

```typescript
app.get('/path', {
    schema: {
        tags: ['TagName'],
        summary: 'Short summary (required by rmoa)',
        description: 'Longer description (required by rmoa)',
        // ...params, querystring, body schemas...
        response: {
            200: { $ref: 'SomeSchema#' },
            400: { $ref: 'ErrorResponse#' },
            401: { $ref: 'ErrorResponse#' },
            403: { $ref: 'ErrorResponse#' }
        }
    }
}, handler);
```

All response bodies must reference named component schemas (`$ref`), not inline objects. Named schemas are registered in `src/plugins/swagger.ts` via `app.addSchema()`.

### Routes that write to Logseq

Wrap the Logseq call in `enqueueWrite()`:

```typescript
import { enqueueWrite } from '../../write-queue';

const result = await enqueueWrite(() => logseqCall('logseq.Editor.createPage', [name, {}]));
```

The write queue serializes all operations; returning 503 when `WRITE_QUEUE_MAX_DEPTH` is reached.

### Routes requiring authentication

Use `preHandler: [app.authenticate, requirePermission('pages:read')]`:

```typescript
import { requirePermission } from '../../auth/rbac';

app.get('/pages', {
    preHandler: [app.authenticate, requirePermission('pages:read')],
    schema: { ... }
}, async (request, reply) => {
    const user = request.user; // typed as JwtPayload
    // ...
});
```

## Database schema changes

Schema is defined in `src/db/schema.ts`. Drizzle generates migration SQL from it.

**To add a column or table:**

1. Edit `src/db/schema.ts`.
2. Generate the migration:
   ```bash
   npm run db:generate
   ```
   This writes a new numbered SQL file under `src/db/migrations/` and updates `meta/_journal.json`.
3. Commit both the schema change and the generated migration files.
4. Update the relevant repository to use the new column.

**Never hand-edit migration SQL files.** Drizzle's journal tracks applied migrations by filename hash; manual edits will corrupt the migration state.

**Never delete old migration files.** Each file represents an applied change. To revert a schema change, generate a new migration that undoes it.

## RBAC permission matrix

Defined in `src/auth/rbac.ts`. Three roles: `admin`, `editor`, `viewer`.

```
viewer:  pages:read, blocks:read, journals:read, tags:read, properties:read
editor:  + pages:write, blocks:write, journals:write, query:execute
admin:   + admin:users, admin:queue  (all permissions)
```

To add a new permission:

1. Add it to the `Permission` union type in `src/types/api.ts`.
2. Add it to the appropriate roles in the `ROLE_PERMISSIONS` matrix in `src/auth/rbac.ts`.
3. Apply it to the route via `requirePermission('new:permission')`.
4. Add tests for all three roles (allowed + denied cases).

## Build system

### Development builds

```bash
npm run build:dev   # tsc + copy migrations to dist/
```

Output goes to `dist/`. TypeScript paths: `dist/index.js`, `dist/db/migrations/`.

### Production builds

```bash
npm run build       # typecheck + lint:openapi + parcel + copy migrations
```

Parcel bundles `src/index.ts` to `dist/index.js`. `node_modules` are kept external (`includeNodeModules: false`). The `copy:migrations` step copies `src/db/migrations/` → `dist/db/migrations/`.

**`__dirname` in the Parcel bundle** resolves to `dist/`. The `initDb()` call in `src/index.ts` uses `path.join(__dirname, 'db', 'migrations')` which correctly resolves to `dist/db/migrations/` in both the tsc output and the Parcel bundle.

Never resolve the migrations path inside `src/db/client.ts` — the path must be passed by the caller.

### OpenAPI generation

```bash
npm run generate:openapi   # writes openapi/spec.json
npm run lint:openapi       # generate + rmoa quality check
```

`scripts/generate-openapi.ts` boots the Fastify app with `logseqConnect: false` (no real Logseq instance needed) and calls `fastify.swagger()`. The spec is written to `openapi/spec.json` and scored by `rmoa`. The `prebuild` script runs this automatically.

**rmoa API key required.** `npm run lint:openapi` calls `rmoa lint` which uses the [Rate My OpenAPI](https://api.ratemyopenapi.com/docs) cloud service. API keys belong in `dev.config.json` — a gitignored JSON file for development tooling secrets, separate from `.env` which is for application runtime config.

1. Sign up at https://api.ratemyopenapi.com/docs to get a free API key.
2. Copy the example config:
   ```bash
   cp dev.config.example.json dev.config.json
   ```
3. Fill in your key:
   ```json
   {
       "rmoaApiKey": "your-actual-key-here"
   }
   ```
4. Run normally — no env vars needed:
   ```bash
   npm run lint:openapi
   ```

**Never commit your API key.** `dev.config.json` is in `.gitignore`. `dev.config.example.json` contains only the placeholder value and is safe to commit. The minimum passing score is 80/100 (`--minimum-score 80` in `scripts/lint-openapi.ts`).

> `openapi/spec.json` is also gitignored — it is always regenerated from source.

## Key gotchas

**bcrypt rounds in tests:** `src/auth/password.ts` uses 4 rounds when `NODE_ENV=test` and 12 in production. Without this, every test that creates a user takes ~200ms and suites time out.

**Schema `$ref` registration order:** Shared schemas must be registered with `app.addSchema()` before the `@fastify/swagger` plugin is registered. The swagger plugin collects schemas at registration time.

**Drizzle `null` vs `undefined`:** SQLite nullable columns return `string | null` from Drizzle. The `User` API type uses `email?: string`. The `toUser()` mapper in the user repository is the single conversion point (`row.email ?? undefined`).

**`storedToken.userId` not `storedToken.user_id`:** Drizzle maps snake_case column names to camelCase in `$inferSelect`. Always use camelCase when accessing row properties from Drizzle queries.

**Migration meta/ folder:** `src/db/migrations/meta/` contains `_journal.json` and snapshot files generated by drizzle-kit. These must be committed and copied to `dist/` — Drizzle's migrator requires them. The `copy:migrations` script uses `cp -r` to include the meta/ subdirectory.

**Write queue `pendingDepth`:** The depth counter increments before `mutex.acquire()` and decrements after. This means it counts waiting operations, not the currently executing one. The 503 check (`pendingDepth >= maxDepth`) fires before acquiring the lock.
