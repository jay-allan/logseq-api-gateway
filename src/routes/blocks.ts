import type { FastifyInstance } from 'fastify';
import { callLogseq } from '../logseq/client';
import { Methods } from '../logseq/methods';
import { requirePermission } from '../auth/rbac';
import type { LogseqBlock } from '../types/logseq';

export default async function blocksRoute(
    app: FastifyInstance
): Promise<void> {
    const auth = [app.authenticate, requirePermission('blocks:read')];

    const uuidParams = {
        type: 'object',
        required: ['uuid'],
        properties: {
            uuid: {
                type: 'string',
                description: 'Block UUID'
            }
        }
    };

    /**
     * GET /blocks/:uuid
     * Returns a single block by UUID.
     */
    app.get(
        '/:uuid',
        {
            preHandler: auth,
            schema: {
                tags: ['Blocks'],
                operationId: 'getBlock',
                summary: 'Get a block',
                description:
                    'Returns the block with the given UUID. ' +
                    'Pass `?children=true` to include the full nested child tree.',
                security: [{ bearerAuth: [] }],
                params: uuidParams,
                querystring: {
                    type: 'object',
                    properties: {
                        children: {
                            type: 'boolean',
                            default: false,
                            description:
                                'When true, recursively include child blocks'
                        }
                    }
                },
                response: {
                    200: { $ref: 'LogseqBlock#' },
                    401: {
                        description: 'Missing or invalid access token',
                        $ref: 'ErrorResponse#'
                    },
                    403: {
                        description: 'Insufficient permissions',
                        $ref: 'ErrorResponse#'
                    },
                    404: {
                        description: 'Block not found',
                        $ref: 'ErrorResponse#'
                    },
                    502: {
                        description: 'Logseq instance is unreachable',
                        $ref: 'ErrorResponse#'
                    },
                    500: {
                        description: 'Internal server error',
                        $ref: 'ErrorResponse#'
                    }
                }
            }
        },
        async (request, reply) => {
            const { uuid } = request.params as { uuid: string };
            const { children } = request.query as { children: boolean };

            const args: unknown[] = children
                ? [uuid, { includeChildren: true }]
                : [uuid];

            const block = await callLogseq<LogseqBlock | null>(
                Methods.GET_BLOCK,
                args
            );

            if (!block) {
                return reply.code(404).send({
                    error: {
                        code: 'NOT_FOUND',
                        message: `Block '${uuid}' not found`
                    }
                });
            }

            return reply.code(200).send(block);
        }
    );

    /**
     * GET /blocks/:uuid/properties
     * Returns the properties map of a block.
     */
    app.get(
        '/:uuid/properties',
        {
            preHandler: auth,
            schema: {
                tags: ['Blocks'],
                operationId: 'getBlockProperties',
                summary: 'Get block properties',
                description:
                    'Returns the key/value property map attached to the block. ' +
                    'Returns 404 if the block does not exist.',
                security: [{ bearerAuth: [] }],
                params: uuidParams,
                response: {
                    200: { $ref: 'BlockProperties#' },
                    401: {
                        description: 'Missing or invalid access token',
                        $ref: 'ErrorResponse#'
                    },
                    403: {
                        description: 'Insufficient permissions',
                        $ref: 'ErrorResponse#'
                    },
                    404: {
                        description: 'Block not found',
                        $ref: 'ErrorResponse#'
                    },
                    502: {
                        description: 'Logseq instance is unreachable',
                        $ref: 'ErrorResponse#'
                    },
                    500: {
                        description: 'Internal server error',
                        $ref: 'ErrorResponse#'
                    }
                }
            }
        },
        async (request, reply) => {
            const { uuid } = request.params as { uuid: string };

            const properties = await callLogseq<
                Record<string, unknown> | null
            >(Methods.GET_BLOCK_PROPERTIES, [uuid]);

            if (properties === null) {
                return reply.code(404).send({
                    error: {
                        code: 'NOT_FOUND',
                        message: `Block '${uuid}' not found`
                    }
                });
            }

            return reply.code(200).send({ properties });
        }
    );

    // ── Write routes (editor+) ───────────────────────────────────────────────

    const writeAuth = [app.authenticate, requirePermission('blocks:write')];

    /**
     * POST /blocks/:uuid/children
     * Inserts a new child block under the specified block.
     */
    app.post(
        '/:uuid/children',
        {
            preHandler: writeAuth,
            schema: {
                tags: ['Blocks'],
                operationId: 'insertChildBlock',
                summary: 'Insert a child block',
                description:
                    'Inserts a new block as a child of the specified block. ' +
                    'Returns 404 if the parent block does not exist.',
                security: [{ bearerAuth: [] }],
                params: uuidParams,
                body: {
                    type: 'object',
                    required: ['content'],
                    properties: {
                        content: {
                            type: 'string',
                            description: 'Block content'
                        },
                        properties: {
                            type: 'object',
                            additionalProperties: true,
                            description: 'Block properties'
                        }
                    }
                },
                response: {
                    201: { $ref: 'LogseqBlock#' },
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
                    404: {
                        description: 'Parent block not found',
                        $ref: 'ErrorResponse#'
                    },
                    502: {
                        description: 'Logseq instance is unreachable',
                        $ref: 'ErrorResponse#'
                    },
                    500: {
                        description: 'Internal server error',
                        $ref: 'ErrorResponse#'
                    }
                }
            }
        },
        async (request, reply) => {
            const { uuid } = request.params as { uuid: string };
            const { content } = request.body as { content: string };

            const block = await callLogseq<LogseqBlock | null>(
                Methods.INSERT_BLOCK,
                [uuid, content, { sibling: false }]
            );

            if (!block) {
                return reply.code(404).send({
                    error: {
                        code: 'NOT_FOUND',
                        message: `Block '${uuid}' not found`
                    }
                });
            }

            return reply.code(201).send(block);
        }
    );

    /**
     * POST /blocks/:uuid/siblings
     * Inserts a new sibling block adjacent to the specified block.
     */
    app.post(
        '/:uuid/siblings',
        {
            preHandler: writeAuth,
            schema: {
                tags: ['Blocks'],
                operationId: 'insertSiblingBlock',
                summary: 'Insert a sibling block',
                description:
                    'Inserts a new block as a sibling of the specified block. ' +
                    'Pass `before: true` to insert before the reference block ' +
                    'instead of after.',
                security: [{ bearerAuth: [] }],
                params: uuidParams,
                body: {
                    type: 'object',
                    required: ['content'],
                    properties: {
                        content: {
                            type: 'string',
                            description: 'Block content'
                        },
                        before: {
                            type: 'boolean',
                            default: false,
                            description:
                                'When true, insert before the reference block'
                        },
                        properties: {
                            type: 'object',
                            additionalProperties: true,
                            description: 'Block properties'
                        }
                    }
                },
                response: {
                    201: { $ref: 'LogseqBlock#' },
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
                    404: {
                        description: 'Reference block not found',
                        $ref: 'ErrorResponse#'
                    },
                    502: {
                        description: 'Logseq instance is unreachable',
                        $ref: 'ErrorResponse#'
                    },
                    500: {
                        description: 'Internal server error',
                        $ref: 'ErrorResponse#'
                    }
                }
            }
        },
        async (request, reply) => {
            const { uuid } = request.params as { uuid: string };
            const { content, before = false } = request.body as {
                content: string;
                before?: boolean;
            };

            const block = await callLogseq<LogseqBlock | null>(
                Methods.INSERT_BLOCK,
                [uuid, content, { sibling: true, before }]
            );

            if (!block) {
                return reply.code(404).send({
                    error: {
                        code: 'NOT_FOUND',
                        message: `Block '${uuid}' not found`
                    }
                });
            }

            return reply.code(201).send(block);
        }
    );

    /**
     * POST /blocks/:uuid/batch
     * Inserts multiple blocks under the specified parent block.
     */
    app.post(
        '/:uuid/batch',
        {
            preHandler: writeAuth,
            schema: {
                tags: ['Blocks'],
                operationId: 'batchInsertBlocks',
                summary: 'Batch insert blocks',
                description:
                    'Inserts an array of blocks under the specified parent block ' +
                    'in a single operation. Blocks may include nested `children`.',
                security: [{ bearerAuth: [] }],
                params: uuidParams,
                body: {
                    type: 'object',
                    required: ['blocks'],
                    properties: {
                        blocks: {
                            type: 'array',
                            minItems: 1,
                            description: 'Blocks to insert',
                            items: {
                                type: 'object',
                                required: ['content'],
                                properties: {
                                    content: { type: 'string' },
                                    properties: {
                                        type: 'object',
                                        additionalProperties: true
                                    },
                                    children: { type: 'array' }
                                }
                            }
                        },
                        sibling: {
                            type: 'boolean',
                            default: false,
                            description:
                                'When true, insert as siblings instead of children'
                        }
                    }
                },
                response: {
                    201: { $ref: 'BlockList#' },
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
                    404: {
                        description: 'Parent block not found',
                        $ref: 'ErrorResponse#'
                    },
                    502: {
                        description: 'Logseq instance is unreachable',
                        $ref: 'ErrorResponse#'
                    },
                    500: {
                        description: 'Internal server error',
                        $ref: 'ErrorResponse#'
                    }
                }
            }
        },
        async (request, reply) => {
            const { uuid } = request.params as { uuid: string };
            const { blocks, sibling = false } = request.body as {
                blocks: unknown[];
                sibling?: boolean;
            };

            const inserted = await callLogseq<LogseqBlock[] | null>(
                Methods.INSERT_BATCH_BLOCK,
                [uuid, blocks, { sibling }]
            );

            if (!inserted) {
                return reply.code(404).send({
                    error: {
                        code: 'NOT_FOUND',
                        message: `Block '${uuid}' not found`
                    }
                });
            }

            return reply.code(201).send({ data: inserted });
        }
    );

    /**
     * PATCH /blocks/:uuid
     * Updates the content of an existing block.
     */
    app.patch(
        '/:uuid',
        {
            preHandler: writeAuth,
            schema: {
                tags: ['Blocks'],
                operationId: 'updateBlock',
                summary: 'Update block content',
                description: 'Replaces the content of the specified block.',
                security: [{ bearerAuth: [] }],
                params: uuidParams,
                body: {
                    type: 'object',
                    required: ['content'],
                    properties: {
                        content: {
                            type: 'string',
                            description: 'New block content'
                        }
                    }
                },
                response: {
                    204: { description: 'Block updated successfully', type: 'null' },
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
                    },
                    500: {
                        description: 'Internal server error',
                        $ref: 'ErrorResponse#'
                    }
                }
            }
        },
        async (request, reply) => {
            const { uuid } = request.params as { uuid: string };
            const { content } = request.body as { content: string };

            await callLogseq(Methods.UPDATE_BLOCK, [uuid, content, {}]);

            return reply.code(204).send();
        }
    );

    /**
     * PATCH /blocks/:uuid/properties
     * Creates or updates a single property on a block.
     */
    app.patch(
        '/:uuid/properties',
        {
            preHandler: writeAuth,
            schema: {
                tags: ['Blocks'],
                operationId: 'upsertBlockProperty',
                summary: 'Upsert a block property',
                description:
                    'Creates or updates the specified property on the block.',
                security: [{ bearerAuth: [] }],
                params: uuidParams,
                body: {
                    type: 'object',
                    required: ['key', 'value'],
                    properties: {
                        key: {
                            type: 'string',
                            description: 'Property key'
                        },
                        value: {
                            description: 'Property value'
                        }
                    }
                },
                response: {
                    204: {
                        description: 'Property upserted successfully',
                        type: 'null'
                    },
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
                    },
                    500: {
                        description: 'Internal server error',
                        $ref: 'ErrorResponse#'
                    }
                }
            }
        },
        async (request, reply) => {
            const { uuid } = request.params as { uuid: string };
            const { key, value } = request.body as {
                key: string;
                value: unknown;
            };

            await callLogseq(Methods.UPSERT_BLOCK_PROPERTY, [uuid, key, value]);

            return reply.code(204).send();
        }
    );

    /**
     * DELETE /blocks/:uuid/properties/:key
     * Removes a single property from a block.
     */
    app.delete(
        '/:uuid/properties/:key',
        {
            preHandler: writeAuth,
            schema: {
                tags: ['Blocks'],
                operationId: 'removeBlockProperty',
                summary: 'Remove a block property',
                description: 'Removes the specified property from the block.',
                security: [{ bearerAuth: [] }],
                params: {
                    type: 'object',
                    required: ['uuid', 'key'],
                    properties: {
                        uuid: {
                            type: 'string',
                            description: 'Block UUID'
                        },
                        key: {
                            type: 'string',
                            description: 'Property key to remove'
                        }
                    }
                },
                response: {
                    204: {
                        description: 'Property removed successfully',
                        type: 'null'
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
                    },
                    500: {
                        description: 'Internal server error',
                        $ref: 'ErrorResponse#'
                    }
                }
            }
        },
        async (request, reply) => {
            const { uuid, key } = request.params as {
                uuid: string;
                key: string;
            };

            await callLogseq(Methods.REMOVE_BLOCK_PROPERTY, [uuid, key]);

            return reply.code(204).send();
        }
    );

    /**
     * POST /blocks/:uuid/move
     * Moves a block to a new position relative to a target block.
     */
    app.post(
        '/:uuid/move',
        {
            preHandler: writeAuth,
            schema: {
                tags: ['Blocks'],
                operationId: 'moveBlock',
                summary: 'Move a block',
                description:
                    'Moves the specified block to a new position relative to ' +
                    'the target block. Pass `before: true` to insert before ' +
                    'the target.',
                security: [{ bearerAuth: [] }],
                params: uuidParams,
                body: {
                    type: 'object',
                    required: ['targetUuid'],
                    properties: {
                        targetUuid: {
                            type: 'string',
                            description: 'UUID of the target reference block'
                        },
                        before: {
                            type: 'boolean',
                            default: false,
                            description:
                                'When true, move before the target block'
                        }
                    }
                },
                response: {
                    204: { description: 'Block moved successfully', type: 'null' },
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
                    },
                    500: {
                        description: 'Internal server error',
                        $ref: 'ErrorResponse#'
                    }
                }
            }
        },
        async (request, reply) => {
            const { uuid } = request.params as { uuid: string };
            const { targetUuid, before = false } = request.body as {
                targetUuid: string;
                before?: boolean;
            };

            await callLogseq(Methods.MOVE_BLOCK, [uuid, targetUuid, { before }]);

            return reply.code(204).send();
        }
    );

    /**
     * DELETE /blocks/:uuid
     * Not yet implemented — Logseq method name unconfirmed.
     */
    app.delete(
        '/:uuid',
        {
            preHandler: auth,
            schema: {
                tags: ['Blocks'],
                operationId: 'deleteBlock',
                summary: 'Delete a block',
                description:
                    'Deletes the specified block. ' +
                    '**Not yet implemented** — the Logseq API method name is ' +
                    'unconfirmed. Returns 501 until verified.',
                security: [{ bearerAuth: [] }],
                params: uuidParams,
                response: {
                    501: {
                        description: 'Not yet implemented',
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
                    500: {
                        description: 'Internal server error',
                        $ref: 'ErrorResponse#'
                    }
                }
            }
        },
        async (_request, reply) => {
            return reply.code(501).send({
                error: {
                    code: 'NOT_IMPLEMENTED',
                    message:
                        'Block deletion is not yet available — ' +
                        'the Logseq API method name is unconfirmed'
                }
            });
        }
    );
}
