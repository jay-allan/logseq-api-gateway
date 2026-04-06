import type { FastifyInstance } from 'fastify';
import { callLogseq } from '../logseq/client';
import { Methods } from '../logseq/methods';
import { requirePermission } from '../auth/rbac';
import type { LogseqProperty } from '../types/logseq';
import { paginate, paginationQuerySchema } from './utils';

export default async function propertiesRoute(
    app: FastifyInstance
): Promise<void> {
    /**
     * GET /properties
     * Lists all property schemas defined in the graph.
     */
    app.get(
        '/',
        {
            preHandler: [app.authenticate, requirePermission('properties:read')],
            schema: {
                tags: ['Properties'],
                summary: 'List all property schemas',
                description:
                    'Returns a paginated list of all property schemas defined ' +
                    'in the Logseq graph.',
                security: [{ bearerAuth: [] }],
                querystring: paginationQuerySchema,
                response: {
                    200: { $ref: 'PropertyList#' },
                    401: {
                        description: 'Missing or invalid access token',
                        $ref: 'ErrorResponse#'
                    },
                    403: {
                        description: 'Insufficient permissions',
                        $ref: 'ErrorResponse#'
                    },
                    502: {
                        description: 'Logseq instance is unreachable',
                        $ref: 'ErrorResponse#'
                    }
                }
            }
        },
        async (request, reply) => {
            const { limit, offset } = request.query as {
                limit: number;
                offset: number;
            };

            const properties = await callLogseq<LogseqProperty[]>(
                Methods.GET_ALL_PROPERTIES
            );

            return reply
                .code(200)
                .send(paginate(properties ?? [], limit, offset));
        }
    );
}
