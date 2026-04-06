import type { FastifyInstance } from 'fastify';
import {
    listUsers,
    findUserById,
    createUser,
    updateUser,
    deleteUser,
    countActiveAdmins
} from '../../db/repositories/user.repository';
import { hashPassword } from '../../auth/password';
import { deleteAllUserTokens } from '../../db/repositories/refresh-token.repository';
import { requirePermission } from '../../auth/rbac';
import type { Role } from '../../types/api';

const AUTHENTICATE = { onRequest: [] as unknown[] };
const ADMIN_GUARD = [requirePermission('admin:users')];

export default async function usersRoute(
    app: FastifyInstance
): Promise<void> {
    const preHandler = [
        app.authenticate.bind(app),
        ...ADMIN_GUARD
    ];

    /** GET /admin/users */
    app.get(
        '/users',
        {
            preHandler,
            schema: {
                tags: ['Admin'],
                operationId: 'listUsers',
                summary: 'List all users',
                description: 'Returns all user accounts. Requires admin role.',
                security: [{ bearerAuth: [] }],
                response: {
                    200: { $ref: 'UserList#' },
                    401: { description: 'Unauthenticated', $ref: 'ErrorResponse#' },
                    403: { description: 'Forbidden', $ref: 'ErrorResponse#' },
                    500: { description: 'Internal server error', $ref: 'ErrorResponse#' }
                }
            }
        },
        async (_request, reply) => {
            return reply.code(200).send({ data: listUsers() });
        }
    );

    /** POST /admin/users */
    app.post(
        '/users',
        {
            preHandler,
            schema: {
                tags: ['Admin'],
                operationId: 'createUser',
                summary: 'Create a user',
                description: 'Creates a new user account. Requires admin role.',
                security: [{ bearerAuth: [] }],
                body: {
                    type: 'object',
                    required: ['username', 'password', 'role'],
                    properties: {
                        username: {
                            type: 'string',
                            minLength: 3,
                            description: 'Unique username'
                        },
                        email: {
                            type: 'string',
                            format: 'email',
                            description: 'Optional email address'
                        },
                        password: {
                            type: 'string',
                            minLength: 8,
                            description: 'Initial password (min 8 chars)'
                        },
                        role: {
                            type: 'string',
                            enum: ['admin', 'editor', 'viewer'],
                            description: 'Access role'
                        }
                    }
                },
                response: {
                    201: { $ref: 'User#' },
                    400: { description: 'Validation error', $ref: 'ErrorResponse#' },
                    401: { description: 'Unauthenticated', $ref: 'ErrorResponse#' },
                    403: { description: 'Forbidden', $ref: 'ErrorResponse#' },
                    409: { description: 'Username already exists', $ref: 'ErrorResponse#' }
                }
            }
        },
        async (request, reply) => {
            const { username, email, password, role } = request.body as {
                username: string;
                email?: string;
                password: string;
                role: Role;
            };

            try {
                const passwordHash = await hashPassword(password);
                const user = createUser({ username, email, passwordHash, role });
                return reply.code(201).send(user);
            } catch (err) {
                const msg = (err as Error).message ?? '';
                if (msg.includes('UNIQUE constraint')) {
                    return reply.code(409).send({
                        error: {
                            code: 'CONFLICT',
                            message: `Username '${username}' is already taken`
                        }
                    });
                }
                throw err;
            }
        }
    );

    /** GET /admin/users/:id */
    app.get(
        '/users/:id',
        {
            preHandler,
            schema: {
                tags: ['Admin'],
                operationId: 'getUser',
                summary: 'Get a user',
                description: 'Returns a single user by ID. Requires admin role.',
                security: [{ bearerAuth: [] }],
                params: {
                    type: 'object',
                    required: ['id'],
                    properties: {
                        id: { type: 'string', format: 'uuid', description: 'User ID' }
                    }
                },
                response: {
                    200: { $ref: 'User#' },
                    401: { description: 'Unauthenticated', $ref: 'ErrorResponse#' },
                    403: { description: 'Forbidden', $ref: 'ErrorResponse#' },
                    404: { description: 'User not found', $ref: 'ErrorResponse#' }
                }
            }
        },
        async (request, reply) => {
            const { id } = request.params as { id: string };
            const user = findUserById(id);
            if (!user) {
                return reply.code(404).send({
                    error: { code: 'NOT_FOUND', message: 'User not found' }
                });
            }
            return reply.code(200).send(user);
        }
    );

    /** PATCH /admin/users/:id */
    app.patch(
        '/users/:id',
        {
            preHandler,
            schema: {
                tags: ['Admin'],
                operationId: 'updateUser',
                summary: 'Update a user',
                description:
                    'Updates role, email, password, or active status of a user. ' +
                    'Requires admin role.',
                security: [{ bearerAuth: [] }],
                params: {
                    type: 'object',
                    required: ['id'],
                    properties: {
                        id: { type: 'string', format: 'uuid', description: 'User ID' }
                    }
                },
                body: {
                    type: 'object',
                    properties: {
                        email: {
                            type: 'string',
                            format: 'email',
                            description: 'New email address'
                        },
                        password: {
                            type: 'string',
                            minLength: 8,
                            description: 'New password (min 8 chars)'
                        },
                        role: {
                            type: 'string',
                            enum: ['admin', 'editor', 'viewer'],
                            description: 'New access role'
                        },
                        isActive: {
                            type: 'boolean',
                            description: 'Set to false to deactivate the account'
                        }
                    }
                },
                response: {
                    200: { $ref: 'User#' },
                    400: { description: 'Validation error', $ref: 'ErrorResponse#' },
                    401: { description: 'Unauthenticated', $ref: 'ErrorResponse#' },
                    403: { description: 'Forbidden', $ref: 'ErrorResponse#' },
                    404: { description: 'User not found', $ref: 'ErrorResponse#' },
                    409: { description: 'Cannot demote last active admin', $ref: 'ErrorResponse#' },
                    500: { description: 'Internal server error', $ref: 'ErrorResponse#' }
                }
            }
        },
        async (request, reply) => {
            const { id } = request.params as { id: string };
            const body = request.body as {
                email?: string;
                password?: string;
                role?: Role;
                isActive?: boolean;
            };

            const target = findUserById(id);
            if (!target) {
                return reply.code(404).send({
                    error: { code: 'NOT_FOUND', message: 'User not found' }
                });
            }

            // Prevent the caller from demoting themselves away from admin when
            // they are the last active admin.
            if (
                body.role !== undefined &&
                body.role !== 'admin' &&
                target.role === 'admin' &&
                request.user.sub === id &&
                countActiveAdmins() <= 1
            ) {
                return reply.code(409).send({
                    error: {
                        code: 'CONFLICT',
                        message: 'Cannot demote the last active admin'
                    }
                });
            }

            const passwordHash = body.password
                ? await hashPassword(body.password)
                : undefined;

            if (passwordHash) {
                deleteAllUserTokens(id);
            }

            const updated = updateUser(id, {
                email: body.email,
                passwordHash,
                role: body.role,
                isActive: body.isActive
            });

            return reply.code(200).send(updated);
        }
    );

    /** DELETE /admin/users/:id */
    app.delete(
        '/users/:id',
        {
            preHandler,
            schema: {
                tags: ['Admin'],
                operationId: 'deleteUser',
                summary: 'Delete a user',
                description:
                    'Permanently deletes a user and all their refresh tokens. ' +
                    'Requires admin role.',
                security: [{ bearerAuth: [] }],
                params: {
                    type: 'object',
                    required: ['id'],
                    properties: {
                        id: { type: 'string', format: 'uuid', description: 'User ID' }
                    }
                },
                response: {
                    204: { description: 'User deleted', type: 'null' },
                    401: { description: 'Unauthenticated', $ref: 'ErrorResponse#' },
                    403: { description: 'Forbidden', $ref: 'ErrorResponse#' },
                    404: { description: 'User not found', $ref: 'ErrorResponse#' },
                    409: { description: 'Cannot delete last active admin', $ref: 'ErrorResponse#' },
                    500: { description: 'Internal server error', $ref: 'ErrorResponse#' }
                }
            }
        },
        async (request, reply) => {
            const { id } = request.params as { id: string };

            const target = findUserById(id);
            if (!target) {
                return reply.code(404).send({
                    error: { code: 'NOT_FOUND', message: 'User not found' }
                });
            }

            if (target.role === 'admin' && target.isActive && countActiveAdmins() <= 1) {
                return reply.code(409).send({
                    error: {
                        code: 'CONFLICT',
                        message: 'Cannot delete the last active admin'
                    }
                });
            }

            deleteAllUserTokens(id);
            deleteUser(id);
            return reply.code(204).send();
        }
    );

    void AUTHENTICATE; // suppress unused variable warning
}
