import 'dotenv/config';
import path from 'path';
import { buildApp } from './app';
import { initDb } from './db/client';
import { config } from './config';
import { Logger } from './Logger';

async function main(): Promise<void> {
    // __dirname resolves correctly for tsc output (dist/), Parcel bundle (dist/),
    // and ts-node (src/) — all have db/migrations/ as a sibling.
    initDb(config.DB_PATH, path.join(__dirname, 'db', 'migrations'));

    const app = await buildApp();

    const shutdown = async (signal: string): Promise<void> => {
        Logger.info(`Received ${signal} — shutting down gracefully`);
        await app.close();
        process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    try {
        await app.listen({ port: config.PORT, host: '0.0.0.0' });
        Logger.info(`Server listening on port ${config.PORT}`);
    } catch (err) {
        Logger.error(`Failed to start: ${(err as Error).message}`);
        process.exit(1);
    }
}

main();
