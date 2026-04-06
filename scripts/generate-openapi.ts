/**
 * Boots the Fastify app without binding a port or connecting to Logseq,
 * then extracts the generated OpenAPI spec and writes it to openapi/spec.json.
 *
 * Run with: npm run generate:openapi
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { initDb } from '../src/db/client';
import { buildApp } from '../src/app';
import { config } from '../src/config';

async function generate(): Promise<void> {
    initDb(config.DB_PATH, path.join(__dirname, '../src/db/migrations'));

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
