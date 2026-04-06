import type { FastifyInstance } from 'fastify';
import { buildTestApp, teardownTestApp } from '../../test/helpers';

describe('X-Request-Id header', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = await buildTestApp();
    });

    afterAll(async () => {
        await teardownTestApp(app);
    });

    it('generates an X-Request-Id and echoes it in the response when none is sent', async () => {
        const res = await app.inject({ method: 'GET', url: '/health' });
        const id = res.headers['x-request-id'];
        expect(typeof id).toBe('string');
        expect(id).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        );
    });

    it('echoes back a caller-supplied X-Request-Id unchanged', async () => {
        const clientId = 'my-trace-id-abc123';
        const res = await app.inject({
            method: 'GET',
            url: '/health',
            headers: { 'x-request-id': clientId }
        });
        expect(res.headers['x-request-id']).toBe(clientId);
    });

    it('assigns a different ID to each request', async () => {
        const [r1, r2] = await Promise.all([
            app.inject({ method: 'GET', url: '/health' }),
            app.inject({ method: 'GET', url: '/health' })
        ]);
        expect(r1.headers['x-request-id']).not.toBe(r2.headers['x-request-id']);
    });
});
