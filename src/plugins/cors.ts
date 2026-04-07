import fp from 'fastify-plugin';
import fastifyCors from '@fastify/cors';
import type { FastifyInstance } from 'fastify';

/**
 * Configures CORS based on the CORS_ORIGIN environment variable.
 *
 * CORS_ORIGIN accepts:
 *   - unset / empty  → deny all cross-origin requests (safest default)
 *   - `*`            → allow all origins (not recommended for credentialed APIs)
 *   - comma-separated list of origins → allow exactly those origins
 *
 * Read from process.env at registration time so that tests can override the
 * value by setting the env var before calling buildTestApp().
 *
 * OWASP A05 — Security Misconfiguration
 */
async function corsPlugin(app: FastifyInstance): Promise<void> {
    const rawOrigin = process.env.CORS_ORIGIN;

    let origin: boolean | string | string[];
    if (!rawOrigin) {
        origin = false; // deny all cross-origin requests
    } else if (rawOrigin === '*') {
        origin = '*';
    } else {
        origin = rawOrigin
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
    }

    await app.register(fastifyCors, {
        origin,
        methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS']
    });
}

export default fp(corsPlugin);
