import 'dotenv/config';
import path from 'path';
import { buildApp } from './app';
import { initDb } from './db/client';
import { config } from './config';
import { Logger } from './Logger';
import { waitForDrain } from './write-queue';
import { probeLogseq } from './logseq/client';
import { deleteExpiredTokens } from './db/repositories/refresh-token.repository';

async function main(): Promise<void> {
    // __dirname resolves correctly for tsc output (dist/), Parcel bundle (dist/),
    // and ts-node (src/) — all have db/migrations/ as a sibling.
    initDb(config.DB_PATH, path.join(__dirname, 'db', 'migrations'));

    const app = await buildApp();

    // Scheduled expired-token cleanup — runs once per hour
    const TOKEN_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
    const cleanupInterval = setInterval(() => {
        try {
            const purged = deleteExpiredTokens();
            if (purged > 0) {
                Logger.info(`Token cleanup: purged ${purged} expired refresh token(s)`);
            }
        } catch (err) {
            Logger.error(`Token cleanup failed: ${(err as Error).message}`);
        }
    }, TOKEN_CLEANUP_INTERVAL_MS);
    cleanupInterval.unref(); // do not keep process alive for cleanup alone

    const shutdown = async (signal: string): Promise<void> => {
        Logger.info(`Received ${signal} — shutting down gracefully`);
        clearInterval(cleanupInterval);
        Logger.info('Draining write queue...');
        await waitForDrain();
        Logger.info('Write queue drained');
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

    // Warn (don't crash) if Logseq is unreachable at startup
    probeLogseq().then((err) => {
        if (err !== null) {
            Logger.warn(
                `Logseq is not reachable at startup (${err}). ` +
                'The gateway will continue to run; Logseq routes will return 502 ' +
                'until the connection is restored.'
            );
        } else {
            Logger.info('Logseq reachable — gateway ready');
        }
    }).catch(() => {
        Logger.warn('Logseq reachability probe failed at startup');
    });
}

main();
