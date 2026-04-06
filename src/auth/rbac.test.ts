import {
    hasPermission,
    getRolePermissions,
    getAllRoles,
    requirePermission,
    type Permission
} from './rbac';

describe('hasPermission', () => {
    describe('viewer', () => {
        it('can read pages, blocks, journals, tags, and properties', () => {
            const readPerms: Permission[] = [
                'pages:read',
                'blocks:read',
                'journals:read',
                'tags:read',
                'properties:read'
            ];
            for (const perm of readPerms) {
                expect(hasPermission('viewer', perm)).toBe(true);
            }
        });

        it('cannot write or execute admin actions', () => {
            const denied: Permission[] = [
                'pages:write',
                'blocks:write',
                'journals:write',
                'query:execute',
                'admin:users',
                'admin:queue'
            ];
            for (const perm of denied) {
                expect(hasPermission('viewer', perm)).toBe(false);
            }
        });
    });

    describe('editor', () => {
        it('has all viewer permissions plus write and query', () => {
            const allowed: Permission[] = [
                'pages:read',
                'pages:write',
                'blocks:read',
                'blocks:write',
                'journals:read',
                'journals:write',
                'tags:read',
                'properties:read',
                'query:execute'
            ];
            for (const perm of allowed) {
                expect(hasPermission('editor', perm)).toBe(true);
            }
        });

        it('cannot access admin endpoints', () => {
            expect(hasPermission('editor', 'admin:users')).toBe(false);
            expect(hasPermission('editor', 'admin:queue')).toBe(false);
        });
    });

    describe('admin', () => {
        it('has every permission', () => {
            const allPerms: Permission[] = [
                'pages:read',
                'pages:write',
                'blocks:read',
                'blocks:write',
                'journals:read',
                'journals:write',
                'tags:read',
                'properties:read',
                'query:execute',
                'admin:users',
                'admin:queue'
            ];
            for (const perm of allPerms) {
                expect(hasPermission('admin', perm)).toBe(true);
            }
        });
    });
});

describe('getRolePermissions', () => {
    it('returns an array of permissions for each role', () => {
        expect(getRolePermissions('viewer').length).toBeGreaterThan(0);
        expect(getRolePermissions('editor').length).toBeGreaterThan(
            getRolePermissions('viewer').length
        );
        expect(getRolePermissions('admin').length).toBeGreaterThan(
            getRolePermissions('editor').length
        );
    });
});

describe('getAllRoles', () => {
    it('returns all three roles', () => {
        const roles = getAllRoles();
        expect(Object.keys(roles)).toEqual(
            expect.arrayContaining(['admin', 'editor', 'viewer'])
        );
    });
});

describe('requirePermission', () => {
    it('calls reply.code(403) when the user lacks the permission', async () => {
        const send = jest.fn();
        const reply = { code: jest.fn().mockReturnValue({ send }) };
        const request = { user: { role: 'viewer' } };

        const hook = requirePermission('admin:users');
        await hook(request as never, reply as never);

        expect(reply.code).toHaveBeenCalledWith(403);
        expect(send).toHaveBeenCalledWith(
            expect.objectContaining({ error: expect.objectContaining({ code: 'FORBIDDEN' }) })
        );
    });

    it('does not call reply when the user has the permission', async () => {
        const reply = { code: jest.fn() };
        const request = { user: { role: 'admin' } };

        const hook = requirePermission('admin:users');
        await hook(request as never, reply as never);

        expect(reply.code).not.toHaveBeenCalled();
    });
});
