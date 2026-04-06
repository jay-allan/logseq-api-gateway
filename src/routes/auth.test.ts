import { buildTestApp, teardownTestApp, getTokenForRole } from '../../test/helpers';
import { createUser } from '../db/repositories/user.repository';
import { hashPassword } from '../auth/password';
import type { FastifyInstance } from 'fastify';

describe('POST /auth/login', () => {
    let app: FastifyInstance;

    beforeEach(async () => {
        app = await buildTestApp();
    });

    afterEach(async () => {
        await teardownTestApp(app);
    });

    it('returns 401 for an unknown user', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/auth/login',
            payload: { username: 'nobody', password: 'anything' }
        });

        expect(res.statusCode).toBe(401);
        expect(JSON.parse(res.body)).toMatchObject({
            error: { code: 'UNAUTHORIZED' }
        });
    });

    it('returns 401 for a wrong password', async () => {
        const hash = await hashPassword('correctpassword');
        createUser({ username: 'alice', passwordHash: hash, role: 'viewer' });

        const res = await app.inject({
            method: 'POST',
            url: '/auth/login',
            payload: { username: 'alice', password: 'wrongpassword' }
        });

        expect(res.statusCode).toBe(401);
    });

    it('returns 400 when the body is missing required fields', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/auth/login',
            payload: { username: 'alice' } // missing password
        });

        expect(res.statusCode).toBe(400);
    });

    it('returns accessToken and refreshToken on valid credentials', async () => {
        const hash = await hashPassword('mypassword');
        createUser({ username: 'bob', passwordHash: hash, role: 'editor' });

        const res = await app.inject({
            method: 'POST',
            url: '/auth/login',
            payload: { username: 'bob', password: 'mypassword' }
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(typeof body.accessToken).toBe('string');
        expect(typeof body.refreshToken).toBe('string');
        expect(body.accessToken.split('.').length).toBe(3); // valid JWT shape
    });

    it('returns 401 for an inactive user', async () => {
        const hash = await hashPassword('mypassword');
        const user = createUser({
            username: 'inactive',
            passwordHash: hash,
            role: 'viewer'
        });

        const { updateUser } = await import('../db/repositories/user.repository');
        updateUser(user.id, { isActive: false });

        const res = await app.inject({
            method: 'POST',
            url: '/auth/login',
            payload: { username: 'inactive', password: 'mypassword' }
        });

        expect(res.statusCode).toBe(401);
    });
});

describe('POST /auth/refresh', () => {
    let app: FastifyInstance;

    beforeEach(async () => {
        app = await buildTestApp();
    });

    afterEach(async () => {
        await teardownTestApp(app);
    });

    async function loginAndGetTokens(
        username: string,
        password: string
    ): Promise<{ accessToken: string; refreshToken: string }> {
        const hash = await hashPassword(password);
        createUser({ username, passwordHash: hash, role: 'viewer' });

        const res = await app.inject({
            method: 'POST',
            url: '/auth/login',
            payload: { username, password }
        });
        return JSON.parse(res.body);
    }

    it('returns a new access token given a valid refresh token', async () => {
        const { refreshToken } = await loginAndGetTokens('carol', 'pass1234');

        const res = await app.inject({
            method: 'POST',
            url: '/auth/refresh',
            payload: { refreshToken }
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(typeof body.accessToken).toBe('string');
        expect(typeof body.refreshToken).toBe('string');
    });

    it('rotates the refresh token (old token rejected after use)', async () => {
        const { refreshToken: original } = await loginAndGetTokens(
            'dave',
            'pass1234'
        );

        // First use — should succeed
        await app.inject({
            method: 'POST',
            url: '/auth/refresh',
            payload: { refreshToken: original }
        });

        // Second use of the same token — should be rejected
        const res = await app.inject({
            method: 'POST',
            url: '/auth/refresh',
            payload: { refreshToken: original }
        });

        expect(res.statusCode).toBe(401);
    });

    it('returns 401 for an invalid refresh token', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/auth/refresh',
            payload: { refreshToken: 'not-a-real-token' }
        });

        expect(res.statusCode).toBe(401);
    });

    it('returns 400 when refreshToken field is missing', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/auth/refresh',
            payload: {}
        });

        expect(res.statusCode).toBe(400);
    });
});

describe('JWT protection', () => {
    let app: FastifyInstance;

    beforeEach(async () => {
        app = await buildTestApp();
    });

    afterEach(async () => {
        await teardownTestApp(app);
    });

    it('returns 401 when no token is provided on a protected route', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/admin/users'
        });
        expect(res.statusCode).toBe(401);
    });

    it('returns 401 for a malformed token', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/admin/users',
            headers: { Authorization: 'Bearer not.a.jwt' }
        });
        expect(res.statusCode).toBe(401);
    });

    it('returns 403 when authenticated but lacking permission', async () => {
        const token = await getTokenForRole(app, 'viewer');

        const res = await app.inject({
            method: 'GET',
            url: '/admin/users',
            headers: { Authorization: `Bearer ${token}` }
        });
        expect(res.statusCode).toBe(403);
    });
});
