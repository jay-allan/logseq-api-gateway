import path from 'path';
import type { FastifyInstance } from 'fastify';
import { initDb, closeDb } from '../src/db/client';
import { buildApp } from '../src/app';
import { createUser } from '../src/db/repositories/user.repository';
import { hashPassword } from '../src/auth/password';
import type { Role } from '../src/types/api';

/**
 * Builds a fresh Fastify app backed by an in-memory SQLite database.
 * Call this in beforeEach; pair with teardownTestApp in afterEach.
 */
export async function buildTestApp(): Promise<FastifyInstance> {
    try {
        closeDb();
    } catch {
        // DB may not have been initialised yet — that is fine
    }
    initDb(':memory:', path.join(__dirname, '../src/db/migrations'));
    const app = await buildApp({ logseqConnect: false });
    await app.ready();
    return app;
}

export async function teardownTestApp(app: FastifyInstance): Promise<void> {
    await app.close();
    try {
        closeDb();
    } catch {
        // ignore
    }
}

/**
 * Creates a user with the given role in the test DB and returns a valid
 * JWT access token for that user, obtained via POST /auth/login.
 */
export async function getTokenForRole(
    app: FastifyInstance,
    role: Role,
    username?: string
): Promise<string> {
    const name = username ?? `${role}_${Date.now()}`;
    const password = 'TestPassword1!';
    const passwordHash = await hashPassword(password);
    createUser({ username: name, passwordHash, role });

    const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { username: name, password }
    });

    const body = JSON.parse(res.body) as { accessToken: string };
    return body.accessToken;
}
