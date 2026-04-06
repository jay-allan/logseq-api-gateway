import type { FastifyInstance } from 'fastify';
import { getAllRoles, requirePermission } from '../../auth/rbac';

export default async function rolesRoute(
    app: FastifyInstance
): Promise<void> {
    /** GET /admin/roles */
    app.get(
        '/roles',
        {
            preHandler: [
                app.authenticate.bind(app),
                requirePermission('admin:users')
            ],
            schema: {
                tags: ['Admin'],
                operationId: 'listRoles',
                summary: 'List roles and permissions',
                description:
                    'Returns the static role-to-permission mapping for all three roles ' +
                    '(admin, editor, viewer). Requires admin role.',
                security: [{ bearerAuth: [] }],
                response: {
                    200: { $ref: 'RoleMatrix#' },
                    401: { description: 'Unauthenticated', $ref: 'ErrorResponse#' },
                    403: { description: 'Forbidden', $ref: 'ErrorResponse#' },
                    500: { description: 'Internal server error', $ref: 'ErrorResponse#' }
                }
            }
        },
        async (_request, reply) => {
            return reply.code(200).send(getAllRoles());
        }
    );
}
