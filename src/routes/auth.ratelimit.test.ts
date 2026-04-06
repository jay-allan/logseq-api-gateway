/**
 * Auth endpoint rate limiting tests.
 *
 * These tests verify that POST /auth/login and POST /auth/refresh
 * have a stricter rate limit than the global one, returning 429 after
 * the per-route threshold is exceeded.
 *
 * We override AUTH_RATE_LIMIT_MAX to 3 in the test environment so we don't
 * have to fire hundreds of requests in a test.
 */
import { buildTestApp, teardownTestApp } from '../../test/helpers';
import { createUser } from '../db/repositories/user.repository';
import { hashPassword } from '../auth/password';
import type { FastifyInstance } from 'fastify';

describe('Auth endpoint rate limiting', () => {
    let app: FastifyInstance;

    beforeEach(async () => {
        // Set a very low limit for tests so we can breach it cheaply
        process.env.AUTH_RATE_LIMIT_MAX = '3';
        app = await buildTestApp();
    });

    afterEach(async () => {
        delete process.env.AUTH_RATE_LIMIT_MAX;
        await teardownTestApp(app);
    });

    describe('POST /auth/login', () => {
        it('returns 429 after exceeding the auth rate limit', async () => {
            const responses = await Promise.all(
                Array.from({ length: 5 }, () =>
                    app.inject({
                        method: 'POST',
                        url: '/auth/login',
                        payload: { username: 'nobody', password: 'anything' }
                    })
                )
            );

            const statuses = responses.map((r) => r.statusCode);
            // At least one of the responses must be 429
            expect(statuses).toContain(429);
        });

        it('returns the standard error envelope on 429', async () => {
            const responses = await Promise.all(
                Array.from({ length: 5 }, () =>
                    app.inject({
                        method: 'POST',
                        url: '/auth/login',
                        payload: { username: 'nobody', password: 'anything' }
                    })
                )
            );

            const rateLimited = responses.find((r) => r.statusCode === 429);
            expect(rateLimited).toBeDefined();
            const body = JSON.parse(rateLimited!.body);
            expect(body).toMatchObject({
                error: { code: 'TOO_MANY_REQUESTS' }
            });
        });
    });

    describe('POST /auth/refresh', () => {
        it('returns 429 after exceeding the auth rate limit', async () => {
            const hash = await hashPassword('pass1234');
            createUser({ username: 'ratelimit_user', passwordHash: hash, role: 'viewer' });

            const loginRes = await app.inject({
                method: 'POST',
                url: '/auth/login',
                payload: { username: 'ratelimit_user', password: 'pass1234' }
            });
            const { refreshToken } = JSON.parse(loginRes.body);

            const responses = await Promise.all(
                Array.from({ length: 5 }, () =>
                    app.inject({
                        method: 'POST',
                        url: '/auth/refresh',
                        payload: { refreshToken }
                    })
                )
            );

            const statuses = responses.map((r) => r.statusCode);
            expect(statuses).toContain(429);
        });
    });
});
