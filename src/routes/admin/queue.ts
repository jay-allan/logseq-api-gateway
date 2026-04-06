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
                summary: 'Write queue status',
                description:
                    'Returns the current write queue depth and configuration. ' +
                    'Requires admin role.',
                security: [{ bearerAuth: [] }],
                response: {
                    200: {
                        description: 'Queue status',
                        type: 'object',
                        required: ['depth', 'maxDepth', 'timeoutMs'],
                        properties: {
                            depth: {
                                type: 'integer',
                                minimum: 0,
                                description: 'Number of writes currently waiting'
                            },
                            maxDepth: {
                                type: 'integer',
                                description: 'Queue size at which 503s are returned'
                            },
                            timeoutMs: {
                                type: 'integer',
                                description: 'Per-operation timeout in milliseconds'
                            }
                        }
                    },
                    401: { description: 'Unauthenticated', $ref: 'ErrorResponse#' },
                    403: { description: 'Forbidden', $ref: 'ErrorResponse#' }
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
