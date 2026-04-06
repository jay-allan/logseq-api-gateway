import { buildTestApp, teardownTestApp } from '../../test/helpers';
import type { FastifyInstance } from 'fastify';

describe('GET /health', () => {
    let app: FastifyInstance;

    beforeEach(async () => {
        app = await buildTestApp();
    });

    afterEach(async () => {
        await teardownTestApp(app);
    });

    it('returns 503 with degraded status when Logseq is not reachable', async () => {
        const res = await app.inject({ method: 'GET', url: '/health' });

        expect(res.statusCode).toBe(503);
        const body = JSON.parse(res.body);
        expect(body).toMatchObject({
            status: 'degraded',
            queueDepth: 0,
            logseqReachable: false
        });
    });

    it('returns the correct response shape', async () => {
        const res = await app.inject({ method: 'GET', url: '/health' });
        const body = JSON.parse(res.body);

        expect(typeof body.status).toBe('string');
        expect(typeof body.queueDepth).toBe('number');
        expect(typeof body.logseqReachable).toBe('boolean');
    });

    it('responds with Content-Type application/json', async () => {
        const res = await app.inject({ method: 'GET', url: '/health' });
        expect(res.headers['content-type']).toMatch(/application\/json/);
    });
});
