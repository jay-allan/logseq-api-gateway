import { buildTestApp, teardownTestApp, getTokenForRole } from '../../../test/helpers';
import type { FastifyInstance } from 'fastify';

describe('/admin/users', () => {
    let app: FastifyInstance;
    let adminToken: string;

    beforeAll(async () => {
        app = await buildTestApp();
        adminToken = await getTokenForRole(app, 'admin', 'admin');
    });

    afterAll(async () => {
        await teardownTestApp(app);
    });

    // ── helpers ──────────────────────────────────────────────────────────────

    async function createUser(
        username: string,
        role = 'viewer',
        password = 'Password1!'
    ) {
        return app.inject({
            method: 'POST',
            url: '/admin/users',
            headers: { Authorization: `Bearer ${adminToken}` },
            payload: { username, password, role }
        });
    }

    // ── GET /admin/users ──────────────────────────────────────────────────────

    describe('GET /admin/users', () => {
        it('returns 200 and a data array for admin', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/admin/users',
                headers: { Authorization: `Bearer ${adminToken}` }
            });

            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res.body);
            expect(Array.isArray(body.data)).toBe(true);
        });

        it('includes the admin user that was created for this test', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/admin/users',
                headers: { Authorization: `Bearer ${adminToken}` }
            });

            const body = JSON.parse(res.body);
            const names = body.data.map((u: { username: string }) => u.username);
            expect(names).toContain('admin');
        });

        it('returns 401 with no token', async () => {
            const res = await app.inject({ method: 'GET', url: '/admin/users' });
            expect(res.statusCode).toBe(401);
        });

        it('returns 403 for an editor', async () => {
            const editorToken = await getTokenForRole(app, 'editor');
            const res = await app.inject({
                method: 'GET',
                url: '/admin/users',
                headers: { Authorization: `Bearer ${editorToken}` }
            });
            expect(res.statusCode).toBe(403);
        });
    });

    // ── POST /admin/users ─────────────────────────────────────────────────────

    describe('POST /admin/users', () => {
        it('creates a user and returns 201 with the user object', async () => {
            const res = await createUser('newuser', 'editor');

            expect(res.statusCode).toBe(201);
            const body = JSON.parse(res.body);
            expect(body.username).toBe('newuser');
            expect(body.role).toBe('editor');
            expect(body.isActive).toBe(true);
            expect(typeof body.id).toBe('string');
            expect(body.passwordHash).toBeUndefined(); // never exposed
        });

        it('returns 409 when the username is already taken', async () => {
            await createUser('duplicate', 'viewer');
            const res = await createUser('duplicate', 'viewer');

            expect(res.statusCode).toBe(409);
            expect(JSON.parse(res.body)).toMatchObject({
                error: { code: 'CONFLICT' }
            });
        });

        it('returns 400 when required fields are missing', async () => {
            const res = await app.inject({
                method: 'POST',
                url: '/admin/users',
                headers: { Authorization: `Bearer ${adminToken}` },
                payload: { username: 'nopw' } // missing password and role
            });

            expect(res.statusCode).toBe(400);
        });

        it('returns 400 when the password is too short', async () => {
            const res = await app.inject({
                method: 'POST',
                url: '/admin/users',
                headers: { Authorization: `Bearer ${adminToken}` },
                payload: { username: 'shortpw', password: 'tiny', role: 'viewer' }
            });

            expect(res.statusCode).toBe(400);
        });

        it('returns 400 when the role is invalid', async () => {
            const res = await app.inject({
                method: 'POST',
                url: '/admin/users',
                headers: { Authorization: `Bearer ${adminToken}` },
                payload: {
                    username: 'badrole',
                    password: 'Password1!',
                    role: 'superadmin'
                }
            });

            expect(res.statusCode).toBe(400);
        });
    });

    // ── GET /admin/users/:id ──────────────────────────────────────────────────

    describe('GET /admin/users/:id', () => {
        it('returns the user for a valid id', async () => {
            const created = JSON.parse((await createUser('getme', 'viewer')).body);

            const res = await app.inject({
                method: 'GET',
                url: `/admin/users/${created.id}`,
                headers: { Authorization: `Bearer ${adminToken}` }
            });

            expect(res.statusCode).toBe(200);
            expect(JSON.parse(res.body).username).toBe('getme');
        });

        it('returns 404 for an unknown id', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/admin/users/00000000-0000-0000-0000-000000000000',
                headers: { Authorization: `Bearer ${adminToken}` }
            });

            expect(res.statusCode).toBe(404);
        });
    });

    // ── PATCH /admin/users/:id ────────────────────────────────────────────────

    describe('PATCH /admin/users/:id', () => {
        it('updates the role', async () => {
            const created = JSON.parse((await createUser('patchme', 'viewer')).body);

            const res = await app.inject({
                method: 'PATCH',
                url: `/admin/users/${created.id}`,
                headers: { Authorization: `Bearer ${adminToken}` },
                payload: { role: 'editor' }
            });

            expect(res.statusCode).toBe(200);
            expect(JSON.parse(res.body).role).toBe('editor');
        });

        it('deactivates a user via isActive: false', async () => {
            const created = JSON.parse((await createUser('deactivate', 'viewer')).body);

            const res = await app.inject({
                method: 'PATCH',
                url: `/admin/users/${created.id}`,
                headers: { Authorization: `Bearer ${adminToken}` },
                payload: { isActive: false }
            });

            expect(res.statusCode).toBe(200);
            expect(JSON.parse(res.body).isActive).toBe(false);
        });

        it('revokes all refresh tokens when the password is reset', async () => {
            const created = JSON.parse((await createUser('resetpw', 'viewer')).body);

            // Log in to obtain a refresh token
            const loginRes = await app.inject({
                method: 'POST',
                url: '/auth/login',
                payload: { username: 'resetpw', password: 'Password1!' }
            });
            const { refreshToken } = JSON.parse(loginRes.body);

            // Admin resets the password
            await app.inject({
                method: 'PATCH',
                url: `/admin/users/${created.id}`,
                headers: { Authorization: `Bearer ${adminToken}` },
                payload: { password: 'NewPassword1!' }
            });

            // The old refresh token must now be invalid
            const refreshRes = await app.inject({
                method: 'POST',
                url: '/auth/refresh',
                payload: { refreshToken }
            });
            expect(refreshRes.statusCode).toBe(401);
        });

        it('returns 404 for an unknown id', async () => {
            const res = await app.inject({
                method: 'PATCH',
                url: '/admin/users/00000000-0000-0000-0000-000000000000',
                headers: { Authorization: `Bearer ${adminToken}` },
                payload: { role: 'editor' }
            });

            expect(res.statusCode).toBe(404);
        });
    });

    // ── DELETE /admin/users/:id ───────────────────────────────────────────────

    describe('DELETE /admin/users/:id', () => {
        it('deletes a user and returns 204', async () => {
            const created = JSON.parse((await createUser('deleteme', 'viewer')).body);

            const deleteRes = await app.inject({
                method: 'DELETE',
                url: `/admin/users/${created.id}`,
                headers: { Authorization: `Bearer ${adminToken}` }
            });

            expect(deleteRes.statusCode).toBe(204);
        });

        it('the deleted user no longer appears in GET /admin/users', async () => {
            const created = JSON.parse((await createUser('gone', 'viewer')).body);

            await app.inject({
                method: 'DELETE',
                url: `/admin/users/${created.id}`,
                headers: { Authorization: `Bearer ${adminToken}` }
            });

            const listRes = await app.inject({
                method: 'GET',
                url: '/admin/users',
                headers: { Authorization: `Bearer ${adminToken}` }
            });

            const names = JSON.parse(listRes.body).data.map(
                (u: { username: string }) => u.username
            );
            expect(names).not.toContain('gone');
        });

        it('returns 404 for an unknown id', async () => {
            const res = await app.inject({
                method: 'DELETE',
                url: '/admin/users/00000000-0000-0000-0000-000000000000',
                headers: { Authorization: `Bearer ${adminToken}` }
            });

            expect(res.statusCode).toBe(404);
        });

        it('returns 409 when deleting the last active admin', async () => {
            // The test suite has exactly one admin ('admin' from beforeAll).
            // Resolve their ID via GET /admin/users.
            const listRes = await app.inject({
                method: 'GET',
                url: '/admin/users',
                headers: { Authorization: `Bearer ${adminToken}` }
            });
            const admins = JSON.parse(listRes.body).data.filter(
                (u: { role: string; username: string }) => u.role === 'admin' && u.username === 'admin'
            );
            expect(admins).toHaveLength(1);

            const res = await app.inject({
                method: 'DELETE',
                url: `/admin/users/${admins[0].id}`,
                headers: { Authorization: `Bearer ${adminToken}` }
            });

            expect(res.statusCode).toBe(409);
            expect(JSON.parse(res.body)).toMatchObject({
                error: { code: 'CONFLICT' }
            });
        });
    });
});

// ── Self-demotion guard ────────────────────────────────────────────────────────

describe('Admin self-demotion guard', () => {
    let app: FastifyInstance;
    let adminToken: string;

    beforeAll(async () => {
        app = await buildTestApp();
        adminToken = await getTokenForRole(app, 'admin', 'solo_admin');
    });

    afterAll(async () => {
        await teardownTestApp(app);
    });

    it('returns 409 when the last admin tries to demote themselves', async () => {
        const listRes = await app.inject({
            method: 'GET',
            url: '/admin/users',
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        const me = JSON.parse(listRes.body).data.find(
            (u: { username: string }) => u.username === 'solo_admin'
        );

        const res = await app.inject({
            method: 'PATCH',
            url: `/admin/users/${me.id}`,
            headers: { Authorization: `Bearer ${adminToken}` },
            payload: { role: 'editor' }
        });

        expect(res.statusCode).toBe(409);
        expect(JSON.parse(res.body)).toMatchObject({
            error: { code: 'CONFLICT' }
        });
    });

    it('allows role change when a second admin exists', async () => {
        // Create a second admin so self-demotion is no longer the last
        await app.inject({
            method: 'POST',
            url: '/admin/users',
            headers: { Authorization: `Bearer ${adminToken}` },
            payload: { username: 'second_admin', password: 'Password1!', role: 'admin' }
        });

        const listRes = await app.inject({
            method: 'GET',
            url: '/admin/users',
            headers: { Authorization: `Bearer ${adminToken}` }
        });
        const me = JSON.parse(listRes.body).data.find(
            (u: { username: string }) => u.username === 'solo_admin'
        );

        const res = await app.inject({
            method: 'PATCH',
            url: `/admin/users/${me.id}`,
            headers: { Authorization: `Bearer ${adminToken}` },
            payload: { role: 'editor' }
        });

        expect(res.statusCode).toBe(200);
    });
});

// ── GET /admin/roles ──────────────────────────────────────────────────────────

describe('GET /admin/roles', () => {
    let app: FastifyInstance;
    let adminToken: string;

    beforeAll(async () => {
        app = await buildTestApp();
        adminToken = await getTokenForRole(app, 'admin');
    });

    afterAll(async () => {
        await teardownTestApp(app);
    });

    it('returns the role permission matrix', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/admin/roles',
            headers: { Authorization: `Bearer ${adminToken}` }
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body).toHaveProperty('admin');
        expect(body).toHaveProperty('editor');
        expect(body).toHaveProperty('viewer');
        expect(body.admin).toContain('admin:users');
        expect(body.viewer).not.toContain('admin:users');
    });
});

// ── GET /admin/queue ──────────────────────────────────────────────────────────

describe('GET /admin/queue', () => {
    let app: FastifyInstance;
    let adminToken: string;

    beforeAll(async () => {
        app = await buildTestApp();
        adminToken = await getTokenForRole(app, 'admin');
    });

    afterAll(async () => {
        await teardownTestApp(app);
    });

    it('returns queue depth and configuration', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/admin/queue',
            headers: { Authorization: `Bearer ${adminToken}` }
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(typeof body.depth).toBe('number');
        expect(typeof body.maxDepth).toBe('number');
        expect(typeof body.timeoutMs).toBe('number');
        expect(body.depth).toBe(0);
    });
});
