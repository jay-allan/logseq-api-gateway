import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Role } from '../types/api';

export type Permission =
    | 'pages:read'
    | 'pages:write'
    | 'blocks:read'
    | 'blocks:write'
    | 'journals:read'
    | 'journals:write'
    | 'tags:read'
    | 'properties:read'
    | 'query:execute'
    | 'admin:users'
    | 'admin:queue';

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
    viewer: [
        'pages:read',
        'blocks:read',
        'journals:read',
        'tags:read',
        'properties:read'
    ],
    editor: [
        'pages:read',
        'pages:write',
        'blocks:read',
        'blocks:write',
        'journals:read',
        'journals:write',
        'tags:read',
        'properties:read',
        'query:execute'
    ],
    admin: [
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
    ]
};

export function hasPermission(role: Role, permission: Permission): boolean {
    return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function getRolePermissions(role: Role): Permission[] {
    return ROLE_PERMISSIONS[role] ?? [];
}

export function getAllRoles(): Record<Role, Permission[]> {
    return { ...ROLE_PERMISSIONS };
}

/**
 * Returns a Fastify preHandler that enforces the given permission.
 * Requires the `authenticate` preHandler to have run first so that
 * `request.user` is populated.
 */
export function requirePermission(permission: Permission) {
    return async (
        request: FastifyRequest,
        reply: FastifyReply
    ): Promise<void> => {
        const user = request.user;
        if (!user || !hasPermission(user.role, permission)) {
            reply.code(403).send({
                error: {
                    code: 'FORBIDDEN',
                    message: `Permission required: ${permission}`
                }
            });
        }
    };
}
