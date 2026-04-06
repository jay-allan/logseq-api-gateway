import type { FastifyInstance } from 'fastify';
import { callLogseq } from '../logseq/client';
import { Methods } from '../logseq/methods';
import { requirePermission } from '../auth/rbac';

export default async function queryRoute(
    app: FastifyInstance
): Promise<void> {
    /**
     * POST /query
     * Executes a Datalog query against the Logseq graph.
     */
    app.post(
        '/',
        {
            preHandler: [
                app.authenticate,
                requirePermission('query:execute')
            ],
            schema: {
                tags: ['Query'],
                summary: 'Execute a Datalog query',
                description:
                    'Passes a Datalog query directly to Logseq and returns the ' +
                    'raw result. The result structure depends on the query ' +
                    '`:find` clause. Requires `editor` role or above.',
                security: [{ bearerAuth: [] }],
                body: {
                    type: 'object',
                    required: ['query'],
                    properties: {
                        query: {
                            type: 'string',
                            description:
                                'Datalog query string ' +
                                '(e.g. `[:find ?name :where [?b :block/name ?name]]`)'
                        },
                        inputs: {
                            type: 'array',
                            description:
                                'Optional positional inputs bound to `?inputs` ' +
                                'in the query',
                            items: {}
                        }
                    }
                },
                response: {
                    200: { $ref: 'QueryResult#' },
                    400: {
                        description: 'Invalid request body',
                        $ref: 'ErrorResponse#'
                    },
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
            const { query, inputs = [] } = request.body as {
                query: string;
                inputs?: unknown[];
            };

            const result = await callLogseq(Methods.DATASCRIPT_QUERY, [
                query,
                ...inputs
            ]);

            return reply.code(200).send({ result });
        }
    );
}
