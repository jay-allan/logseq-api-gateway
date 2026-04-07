import type { FastifyInstance } from 'fastify';
import { buildTestApp, teardownTestApp } from '../../test/helpers';

describe('Security headers', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = await buildTestApp();
    });

    afterAll(() => teardownTestApp(app));

    it('sets X-Content-Type-Options: nosniff', async () => {
        const res = await app.inject({ method: 'GET', url: '/health' });
        expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('sets X-Frame-Options: DENY', async () => {
        const res = await app.inject({ method: 'GET', url: '/health' });
        expect(res.headers['x-frame-options']).toBe('DENY');
    });

    it('sets Referrer-Policy: no-referrer', async () => {
        const res = await app.inject({ method: 'GET', url: '/health' });
        expect(res.headers['referrer-policy']).toBe('no-referrer');
    });

    it('sets X-XSS-Protection: 0', async () => {
        const res = await app.inject({ method: 'GET', url: '/health' });
        expect(res.headers['x-xss-protection']).toBe('0');
    });

    it('applies headers to non-2xx responses too', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/auth/login',
            payload: { username: 'nobody', password: 'bad' }
        });
        expect(res.statusCode).toBe(401);
        expect(res.headers['x-content-type-options']).toBe('nosniff');
    });
});
