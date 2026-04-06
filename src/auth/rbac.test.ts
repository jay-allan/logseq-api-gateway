import {
    hasPermission,
    getRolePermissions,
    getAllRoles,
    requirePermission,
    type Permission
} from './rbac';
import type { Role } from '../types/api';

// --------------------------------------------------------------------------
// Exhaustive truth table: every role × every permission
// --------------------------------------------------------------------------

const ALL_PERMISSIONS: Permission[] = [
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

/**
 * Complete expected matrix.
 * Any permission not listed for a role must be false.
 * If a permission is ever added to rbac.ts without updating this table,
 * the test will fail — which is intentional.
 */
const EXPECTED_MATRIX: Record<Role, Set<Permission>> = {
    viewer: new Set([
        'pages:read',
        'blocks:read',
        'journals:read',
        'tags:read',
        'properties:read'
    ]),
    editor: new Set([
        'pages:read',
        'pages:write',
        'blocks:read',
        'blocks:write',
        'journals:read',
        'journals:write',
        'tags:read',
        'properties:read',
        'query:execute'
    ]),
    admin: new Set([
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
    ])
};

const ROLES: Role[] = ['viewer', 'editor', 'admin'];

describe('RBAC matrix — exhaustive role × permission coverage', () => {
    for (const role of ROLES) {
        for (const permission of ALL_PERMISSIONS) {
            const expected = EXPECTED_MATRIX[role].has(permission);
            it(`${role} ${expected ? 'CAN' : 'CANNOT'} ${permission}`, () => {
                expect(hasPermission(role, permission)).toBe(expected);
            });
        }
    }

    it('admin has every permission in ALL_PERMISSIONS', () => {
        for (const perm of ALL_PERMISSIONS) {
            expect(hasPermission('admin', perm)).toBe(true);
        }
    });

    it('viewer has no write or admin permissions', () => {
        const viewerDenied: Permission[] = [
            'pages:write',
            'blocks:write',
            'journals:write',
            'query:execute',
            'admin:users',
            'admin:queue'
        ];
        for (const perm of viewerDenied) {
            expect(hasPermission('viewer', perm)).toBe(false);
        }
    });

    it('editor has all viewer permissions plus write and query', () => {
        const viewerPerms = [...EXPECTED_MATRIX.viewer];
        for (const perm of viewerPerms) {
            expect(hasPermission('editor', perm)).toBe(true);
        }
        expect(hasPermission('editor', 'pages:write')).toBe(true);
        expect(hasPermission('editor', 'blocks:write')).toBe(true);
        expect(hasPermission('editor', 'journals:write')).toBe(true);
        expect(hasPermission('editor', 'query:execute')).toBe(true);
    });

    it('editor cannot access admin permissions', () => {
        expect(hasPermission('editor', 'admin:users')).toBe(false);
        expect(hasPermission('editor', 'admin:queue')).toBe(false);
    });

    it('admin has strictly more permissions than editor', () => {
        const editorCount = getRolePermissions('editor').length;
        const adminCount = getRolePermissions('admin').length;
        expect(adminCount).toBeGreaterThan(editorCount);
    });

    it('editor has strictly more permissions than viewer', () => {
        const viewerCount = getRolePermissions('viewer').length;
        const editorCount = getRolePermissions('editor').length;
        expect(editorCount).toBeGreaterThan(viewerCount);
    });
});

// --------------------------------------------------------------------------
// getRolePermissions
// --------------------------------------------------------------------------

describe('getRolePermissions', () => {
    it('returns exactly the permissions in the truth table for each role', () => {
        for (const role of ROLES) {
            const returned = new Set(getRolePermissions(role));
            const expected = EXPECTED_MATRIX[role];
            expect(returned).toEqual(expected);
        }
    });

    it('returns an empty array for an unknown role', () => {
        expect(getRolePermissions('unknown' as Role)).toEqual([]);
    });
});

// --------------------------------------------------------------------------
// getAllRoles
// --------------------------------------------------------------------------

describe('getAllRoles', () => {
    it('returns all three roles', () => {
        const roles = Object.keys(getAllRoles());
        expect(roles.sort()).toEqual(['admin', 'editor', 'viewer']);
    });

    it('returns a copy — mutations do not affect the source', () => {
        const copy = getAllRoles() as Record<string, Permission[]>;
        copy['viewer'] = [];
        expect(getRolePermissions('viewer').length).toBeGreaterThan(0);
    });
});

// --------------------------------------------------------------------------
// requirePermission
// --------------------------------------------------------------------------

describe('requirePermission', () => {
    it('sends 403 when the user lacks the required permission', async () => {
        const send = jest.fn();
        const reply = { code: jest.fn().mockReturnValue({ send }) };
        const request = { user: { role: 'viewer' } };

        await requirePermission('admin:users')(request as never, reply as never);

        expect(reply.code).toHaveBeenCalledWith(403);
        expect(send).toHaveBeenCalledWith(
            expect.objectContaining({
                error: expect.objectContaining({ code: 'FORBIDDEN' })
            })
        );
    });

    it('does not call reply when the user has the required permission', async () => {
        const reply = { code: jest.fn() };
        const request = { user: { role: 'admin' } };

        await requirePermission('admin:users')(request as never, reply as never);

        expect(reply.code).not.toHaveBeenCalled();
    });

    it('sends 403 when request.user is undefined', async () => {
        const send = jest.fn();
        const reply = { code: jest.fn().mockReturnValue({ send }) };
        const request = { user: undefined };

        await requirePermission('pages:read')(request as never, reply as never);

        expect(reply.code).toHaveBeenCalledWith(403);
    });

    it('sends 403 for every denied permission across all roles', async () => {
        for (const role of ROLES) {
            const denied = ALL_PERMISSIONS.filter(
                (p) => !EXPECTED_MATRIX[role].has(p)
            );
            for (const permission of denied) {
                const send = jest.fn();
                const reply = { code: jest.fn().mockReturnValue({ send }) };
                const request = { user: { role } };
                await requirePermission(permission)(
                    request as never,
                    reply as never
                );
                expect(reply.code).toHaveBeenCalledWith(403);
            }
        }
    });
});
