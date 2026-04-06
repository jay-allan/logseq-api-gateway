import type { FastifyInstance } from 'fastify';
import { callLogseq } from '../logseq/client';
import { Methods } from '../logseq/methods';
import { requirePermission } from '../auth/rbac';
import type { LogseqTag, LogseqBlock } from '../types/logseq';
import { paginate, paginationQuerySchema } from './utils';

export default async function tagsRoute(app: FastifyInstance): Promise<void> {
    const auth = [app.authenticate, requirePermission('tags:read')];

    /**
     * GET /tags
     * Lists all tags (class pages) in the graph.
     */
    app.get(
        '/',
        {
            preHandler: auth,
            schema: {
                tags: ['Tags'],
                summary: 'List all tags',
                description:
                    'Returns a paginated list of all tags (Logseq class pages) ' +
                    'defined in the graph.',
                security: [{ bearerAuth: [] }],
                querystring: paginationQuerySchema,
                response: {
                    200: { $ref: 'TagList#' },
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

            const tags = await callLogseq<LogseqTag[]>(Methods.GET_ALL_TAGS);

            return reply.code(200).send(paginate(tags ?? [], limit, offset));
        }
    );

    /**
     * GET /tags/:name/blocks
     * Returns all blocks that are tagged with the given tag.
     */
    app.get(
        '/:name/blocks',
        {
            preHandler: auth,
            schema: {
                tags: ['Tags'],
                summary: 'Get blocks for a tag',
                description:
                    'Returns all blocks in the graph that carry the specified tag.',
                security: [{ bearerAuth: [] }],
                params: {
                    type: 'object',
                    required: ['name'],
                    properties: {
                        name: {
                            type: 'string',
                            description: 'Tag name'
                        }
                    }
                },
                response: {
                    200: { $ref: 'BlockList#' },
                    401: {
                        description: 'Missing or invalid access token',
                        $ref: 'ErrorResponse#'
                    },
                    403: {
                        description: 'Insufficient permissions',
                        $ref: 'ErrorResponse#'
                    },
                    404: {
                        description: 'Tag not found',
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
            const { name } = request.params as { name: string };

            const blocks = await callLogseq<LogseqBlock[] | null>(
                Methods.GET_TAG_OBJECTS,
                [name]
            );

            if (!blocks) {
                return reply.code(404).send({
                    error: {
                        code: 'NOT_FOUND',
                        message: `Tag '${name}' not found`
                    }
                });
            }

            return reply.code(200).send({ data: blocks });
        }
    );
}
