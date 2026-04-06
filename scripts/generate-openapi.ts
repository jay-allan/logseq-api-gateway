/**
 * Boots the Fastify app without binding a port or connecting to Logseq,
 * then extracts the generated OpenAPI spec and writes it to openapi/spec.json.
 *
 * Run with: npm run generate:openapi
 *
 * Works without a .env file — stub values are set for any required env vars
 * that are missing so that Zod config validation passes. The stubs are never
 * used at runtime and carry no security implications.
 */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// 1. Load .env if it exists.
dotenv.config();

// 2. Set stub values for required vars that are absent.
//    These must be assigned BEFORE any require() that loads src/config,
//    which is why the app modules below are loaded via dynamic require()
//    rather than static import.
process.env.JWT_SECRET ??= 'openapi-generation-placeholder-32ch';
process.env.JWT_REFRESH_SECRET ??= 'openapi-generation-placeholder-32ch';
process.env.LOGSEQ_TOKEN ??= 'openapi-generation-placeholder';

// 3. Dynamic requires — evaluated after the stubs above are set.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { initDb } = require('../src/db/client') as typeof import('../src/db/client');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { buildApp } = require('../src/app') as typeof import('../src/app');

async function generate(): Promise<void> {
    // Use an in-memory DB — no file system side-effects during spec generation.
    initDb(':memory:', path.join(__dirname, '../src/db/migrations'));

    const app = await buildApp({ logseqConnect: false });
    await app.ready();

    const spec = app.swagger();
    const outDir = path.resolve(__dirname, '../openapi');
    const outFile = path.join(outDir, 'spec.json');

    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    fs.writeFileSync(outFile, JSON.stringify(spec, null, 2));
    console.log(`OpenAPI spec written to ${outFile}`);

    await app.close();
}

generate().catch((err) => {
    console.error('OpenAPI generation failed:', err);
    process.exit(1);
});
