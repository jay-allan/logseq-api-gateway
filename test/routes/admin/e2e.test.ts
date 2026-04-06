/**
 * Admin user management — end-to-end lifecycle test.
 *
 * This suite runs a single sequential narrative: create a user → verify it
 * appears in the list → read it by ID → update its role and email → verify
 * the changes → deactivate it → verify login is refused → delete it → verify
 * it is gone. Each step asserts both the HTTP status and the response body.
 */
import { buildTestApp, teardownTestApp, getTokenForRole } from '../../helpers';
import type { FastifyInstance } from 'fastify';

interface User {
    id: string;
    username: string;
    email?: string;
    role: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

describe('Admin user lifecycle (end-to-end)', () => {
    let app: FastifyInstance;
    let adminToken: string;
    let createdUserId: string;

    const USERNAME = 'e2e_lifecycle_user';
    const PASSWORD = 'Lifecycle1!';

    beforeAll(async () => {
        app = await buildTestApp();
        adminToken = await getTokenForRole(app, 'admin', 'e2e_admin');
    });

    afterAll(async () => {
        await teardownTestApp(app);
    });

    // ── 1. Create ─────────────────────────────────────────────────────────────

    it('creates a new viewer user', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/admin/users',
            headers: { Authorization: `Bearer ${adminToken}` },
            payload: { username: USERNAME, password: PASSWORD, role: 'viewer' }
        });

        expect(res.statusCode).toBe(201);
        const user: User = JSON.parse(res.body);
        expect(user.username).toBe(USERNAME);
        expect(user.role).toBe('viewer');
        expect(user.isActive).toBe(true);
        expect(user.id).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        );

        createdUserId = user.id;
    });

    // ── 2. Appears in list ────────────────────────────────────────────────────

    it('new user appears in GET /admin/users', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/admin/users',
            headers: { Authorization: `Bearer ${adminToken}` }
        });

        expect(res.statusCode).toBe(200);
        const { data }: { data: User[] } = JSON.parse(res.body);
        const found = data.find((u) => u.id === createdUserId);
        expect(found).toBeDefined();
        expect(found?.username).toBe(USERNAME);
    });

    // ── 3. Read by ID ─────────────────────────────────────────────────────────

    it('GET /admin/users/:id returns the correct user', async () => {
        const res = await app.inject({
            method: 'GET',
            url: `/admin/users/${createdUserId}`,
            headers: { Authorization: `Bearer ${adminToken}` }
        });

        expect(res.statusCode).toBe(200);
        const user: User = JSON.parse(res.body);
        expect(user.id).toBe(createdUserId);
        expect(user.username).toBe(USERNAME);
        expect(user.role).toBe('viewer');
    });

    // ── 4. Can log in with original password ──────────────────────────────────

    it('new user can log in with original password', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/auth/login',
            payload: { username: USERNAME, password: PASSWORD }
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(typeof body.accessToken).toBe('string');
    });

    // ── 5. Conflict on duplicate username ─────────────────────────────────────

    it('returns 409 when creating a user with the same username', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/admin/users',
            headers: { Authorization: `Bearer ${adminToken}` },
            payload: {
                username: USERNAME,
                password: 'Another1!',
                role: 'editor'
            }
        });

        expect(res.statusCode).toBe(409);
    });

    // ── 6. Update role and email ──────────────────────────────────────────────

    it('promotes user to editor and sets an email address', async () => {
        const res = await app.inject({
            method: 'PATCH',
            url: `/admin/users/${createdUserId}`,
            headers: { Authorization: `Bearer ${adminToken}` },
            payload: { role: 'editor', email: 'e2e@example.com' }
        });

        expect(res.statusCode).toBe(200);
        const user: User = JSON.parse(res.body);
        expect(user.role).toBe('editor');
        expect(user.email).toBe('e2e@example.com');
        expect(user.isActive).toBe(true);
    });

    // ── 7. Changes are persisted ──────────────────────────────────────────────

    it('GET /admin/users/:id reflects the updated role and email', async () => {
        const res = await app.inject({
            method: 'GET',
            url: `/admin/users/${createdUserId}`,
            headers: { Authorization: `Bearer ${adminToken}` }
        });

        const user: User = JSON.parse(res.body);
        expect(user.role).toBe('editor');
        expect(user.email).toBe('e2e@example.com');
    });

    // ── 8. Deactivate the account ─────────────────────────────────────────────

    it('deactivates the user account', async () => {
        const res = await app.inject({
            method: 'PATCH',
            url: `/admin/users/${createdUserId}`,
            headers: { Authorization: `Bearer ${adminToken}` },
            payload: { isActive: false }
        });

        expect(res.statusCode).toBe(200);
        const user: User = JSON.parse(res.body);
        expect(user.isActive).toBe(false);
    });

    // ── 9. Deactivated user cannot log in ─────────────────────────────────────

    it('deactivated user cannot log in', async () => {
        // findUserWithHashByUsername filters by isActive=true, so login is
        // refused as soon as the account is deactivated.
        const res = await app.inject({
            method: 'POST',
            url: '/auth/login',
            payload: { username: USERNAME, password: PASSWORD }
        });

        expect(res.statusCode).toBe(401);
    });

    // ── 10. Delete the user ───────────────────────────────────────────────────

    it('deletes the user', async () => {
        const res = await app.inject({
            method: 'DELETE',
            url: `/admin/users/${createdUserId}`,
            headers: { Authorization: `Bearer ${adminToken}` }
        });

        expect(res.statusCode).toBe(204);
    });

    // ── 11. User is gone ──────────────────────────────────────────────────────

    it('GET /admin/users/:id returns 404 after deletion', async () => {
        const res = await app.inject({
            method: 'GET',
            url: `/admin/users/${createdUserId}`,
            headers: { Authorization: `Bearer ${adminToken}` }
        });

        expect(res.statusCode).toBe(404);
    });

    it('user does not appear in GET /admin/users after deletion', async () => {
        const res = await app.inject({
            method: 'GET',
            url: '/admin/users',
            headers: { Authorization: `Bearer ${adminToken}` }
        });

        const { data }: { data: User[] } = JSON.parse(res.body);
        const found = data.find((u) => u.id === createdUserId);
        expect(found).toBeUndefined();
    });

    // ── 12. Non-existent ID returns 404 ──────────────────────────────────────

    it('PATCH on a non-existent ID returns 404', async () => {
        const res = await app.inject({
            method: 'PATCH',
            url: '/admin/users/00000000-0000-4000-8000-000000000000',
            headers: { Authorization: `Bearer ${adminToken}` },
            payload: { role: 'editor' }
        });

        expect(res.statusCode).toBe(404);
    });

    it('DELETE on a non-existent ID returns 404', async () => {
        const res = await app.inject({
            method: 'DELETE',
            url: '/admin/users/00000000-0000-4000-8000-000000000000',
            headers: { Authorization: `Bearer ${adminToken}` }
        });

        expect(res.statusCode).toBe(404);
    });
});
