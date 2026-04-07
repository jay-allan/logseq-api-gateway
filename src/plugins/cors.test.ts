/**
 * Tests for the configurable CORS_ORIGIN behaviour.
 *
 * cors.ts reads CORS_ORIGIN from process.env at plugin-registration time,
 * so we can override it per-test by setting the env var before buildTestApp().
 */
import type { FastifyInstance } from 'fastify';
import { buildTestApp, teardownTestApp } from '../../test/helpers';

describe('CORS origin configuration', () => {
    let app: FastifyInstance;

    afterEach(async () => {
        await teardownTestApp(app);
        delete process.env.CORS_ORIGIN;
    });

    it('denies cross-origin requests when CORS_ORIGIN is not set', async () => {
        // test/setup.ts does not set CORS_ORIGIN → default deny
        app = await buildTestApp();
        const res = await app.inject({
            method: 'GET',
            url: '/health',
            headers: { Origin: 'https://evil.com' }
        });
        expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('allows any origin when CORS_ORIGIN=*', async () => {
        process.env.CORS_ORIGIN = '*';
        app = await buildTestApp();
        const res = await app.inject({
            method: 'GET',
            url: '/health',
            headers: { Origin: 'https://example.com' }
        });
        // @fastify/cors sets the header to the concrete origin when wildcard
        expect(res.headers['access-control-allow-origin']).toBeDefined();
    });

    it('allows a specific origin when CORS_ORIGIN matches', async () => {
        process.env.CORS_ORIGIN = 'https://app.example.com';
        app = await buildTestApp();
        const res = await app.inject({
            method: 'GET',
            url: '/health',
            headers: { Origin: 'https://app.example.com' }
        });
        expect(res.headers['access-control-allow-origin']).toBe(
            'https://app.example.com'
        );
    });

    it('denies an unlisted origin when CORS_ORIGIN is a specific domain', async () => {
        process.env.CORS_ORIGIN = 'https://app.example.com';
        app = await buildTestApp();
        const res = await app.inject({
            method: 'GET',
            url: '/health',
            headers: { Origin: 'https://evil.com' }
        });
        // Origin is not in the list — no allow header
        expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('allows multiple listed origins', async () => {
        process.env.CORS_ORIGIN = 'https://a.example.com,https://b.example.com';
        app = await buildTestApp();
        const res = await app.inject({
            method: 'GET',
            url: '/health',
            headers: { Origin: 'https://b.example.com' }
        });
        expect(res.headers['access-control-allow-origin']).toBe(
            'https://b.example.com'
        );
    });
});
