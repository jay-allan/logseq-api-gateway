import type { FastifyInstance } from 'fastify';
import { getQueueDepth } from '../../write-queue';
import { requirePermission } from '../../auth/rbac';
import { config } from '../../config';

export default async function queueRoute(
    app: FastifyInstance
): Promise<void> {
    /** GET /admin/queue */
    app.get(
        '/queue',
        {
            preHandler: [
                app.authenticate.bind(app),
                requirePermission('admin:queue')
            ],
            schema: {
                tags: ['Admin'],
                operationId: 'getQueueStatus',
                summary: 'Write queue status',
                description:
                    'Returns the current write queue depth and configuration. ' +
                    'Requires admin role.',
                security: [{ bearerAuth: [] }],
                response: {
                    200: { $ref: 'QueueStatus#' },
                    401: { description: 'Unauthenticated', $ref: 'ErrorResponse#' },
                    403: { description: 'Forbidden', $ref: 'ErrorResponse#' },
                    500: { description: 'Internal server error', $ref: 'ErrorResponse#' }
                }
            }
        },
        async (_request, reply) => {
            return reply.code(200).send({
                depth: getQueueDepth(),
                maxDepth: config.WRITE_QUEUE_MAX_DEPTH,
                timeoutMs: config.WRITE_QUEUE_TIMEOUT_MS
            });
        }
    );
}
