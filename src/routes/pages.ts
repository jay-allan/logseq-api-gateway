import type { FastifyInstance } from 'fastify';
import { callLogseq } from '../logseq/client';
import { Methods } from '../logseq/methods';
import { requirePermission } from '../auth/rbac';
import type { LogseqPage, LogseqBlock } from '../types/logseq';
import { normalizePageForApi, paginate, paginationQuerySchema } from './utils';

export default async function pagesRoute(
    app: FastifyInstance
): Promise<void> {
    const auth = [app.authenticate, requirePermission('pages:read')];

    /**
     * GET /pages
     * Lists all pages in the Logseq graph.
     */
    app.get(
        '/',
        {
            preHandler: auth,
            schema: {
                tags: ['Pages'],
                operationId: 'listPages',
                summary: 'List all pages',
                description:
                    'Returns a paginated list of all pages in the Logseq graph. ' +
                    'Journal pages are included; use the `journal` field to filter them.',
                security: [{ bearerAuth: [] }],
                querystring: paginationQuerySchema,
                response: {
                    200: { $ref: 'PageList#' },
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
            const { limit, offset } = request.query as {
                limit: number;
                offset: number;
            };

            const pages = await callLogseq<LogseqPage[]>(
                Methods.GET_ALL_PAGES
            );

            const normalized = (pages ?? []).map(
                (p) => normalizePageForApi(p as unknown as Record<string, unknown>)
            );
            return reply.code(200).send(paginate(normalized, limit, offset));
        }
    );

    /**
     * GET /pages/:name
     * Returns a single page by name.
     */
    app.get(
        '/:name',
        {
            preHandler: auth,
            schema: {
                tags: ['Pages'],
                operationId: 'getPage',
                summary: 'Get a page',
                description:
                    'Returns the page with the given name. ' +
                    'The name is case-insensitive. ' +
                    'URL-encode namespace separators: ' +
                    '`namespace/page` → `/pages/namespace%2Fpage`.',
                security: [{ bearerAuth: [] }],
                params: {
                    type: 'object',
                    required: ['name'],
                    properties: {
                        name: {
                            type: 'string',
                            description: 'Page name (URL-encoded if it contains slashes)'
                        }
                    }
                },
                response: {
                    200: { $ref: 'LogseqPage#' },
                    401: {
                        description: 'Missing or invalid access token',
                        $ref: 'ErrorResponse#'
                    },
                    403: {
                        description: 'Insufficient permissions',
                        $ref: 'ErrorResponse#'
                    },
                    404: {
                        description: 'Page not found',
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
            const { name } = request.params as { name: string };

            const page = await callLogseq<LogseqPage | null>(
                Methods.GET_PAGE,
                [name]
            );

            if (!page) {
                return reply.code(404).send({
                    error: { code: 'NOT_FOUND', message: `Page '${name}' not found` }
                });
            }

            return reply.code(200).send(
                normalizePageForApi(page as unknown as Record<string, unknown>)
            );
        }
    );

    /**
     * GET /pages/:name/blocks
     * Returns the block tree for a page.
     */
    app.get(
        '/:name/blocks',
        {
            preHandler: auth,
            schema: {
                tags: ['Pages'],
                operationId: 'getPageBlocks',
                summary: 'Get page block tree',
                description:
                    'Returns the full block tree for the named page. ' +
                    'Blocks are nested; each block may have a `children` array.',
                security: [{ bearerAuth: [] }],
                params: {
                    type: 'object',
                    required: ['name'],
                    properties: {
                        name: {
                            type: 'string',
                            description: 'Page name (URL-encoded if it contains slashes)'
                        }
                    }
                },
                response: {
                    200: { $ref: 'BlockTree#' },
                    401: {
                        description: 'Missing or invalid access token',
                        $ref: 'ErrorResponse#'
                    },
                    403: {
                        description: 'Insufficient permissions',
                        $ref: 'ErrorResponse#'
                    },
                    404: {
                        description: 'Page not found',
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
            const { name } = request.params as { name: string };

            // getPageBlocksTree validates its argument as a UUID at runtime,
            // so we must resolve the page UUID before calling it.
            const page = await callLogseq<LogseqPage | null>(
                Methods.GET_PAGE,
                [name]
            );
            if (!page) {
                return reply.code(404).send({
                    error: { code: 'NOT_FOUND', message: `Page '${name}' not found` }
                });
            }

            const blocks = await callLogseq<LogseqBlock[] | null>(
                Methods.GET_PAGE_BLOCKS_TREE,
                [page.uuid]
            );

            if (!blocks) {
                return reply.code(404).send({
                    error: { code: 'NOT_FOUND', message: `Page '${name}' not found` }
                });
            }

            return reply.code(200).send({ data: blocks });
        }
    );

    /**
     * GET /pages/:name/links
     * Returns pages that reference this page, with their referencing blocks.
     */
    app.get(
        '/:name/links',
        {
            preHandler: auth,
            schema: {
                tags: ['Pages'],
                operationId: 'getPageLinks',
                summary: 'Get page linked references',
                description:
                    'Returns all pages that contain block references to the named page, ' +
                    'together with the specific blocks that contain the reference.',
                security: [{ bearerAuth: [] }],
                params: {
                    type: 'object',
                    required: ['name'],
                    properties: {
                        name: {
                            type: 'string',
                            description: 'Page name (URL-encoded if it contains slashes)'
                        }
                    }
                },
                response: {
                    200: { $ref: 'PageReferenceList#' },
                    401: {
                        description: 'Missing or invalid access token',
                        $ref: 'ErrorResponse#'
                    },
                    403: {
                        description: 'Insufficient permissions',
                        $ref: 'ErrorResponse#'
                    },
                    404: {
                        description: 'Page not found',
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
            const { name } = request.params as { name: string };

            // getPageLinkedReferences also requires a UUID, not a page name.
            const page = await callLogseq<LogseqPage | null>(
                Methods.GET_PAGE,
                [name]
            );
            if (!page) {
                return reply.code(404).send({
                    error: { code: 'NOT_FOUND', message: `Page '${name}' not found` }
                });
            }

            // Logseq returns [[sourcePage, [block, ...]], ...] or null
            const raw = await callLogseq<
                [LogseqPage, LogseqBlock[]][] | null
            >(Methods.GET_PAGE_LINKED_REFERENCES, [page.uuid]);

            const data = (raw ?? []).map(([sourcePage, blocks]) => ({
                page: normalizePageForApi(
                    sourcePage as unknown as Record<string, unknown>
                ),
                blocks: blocks ?? []
            }));

            return reply.code(200).send({ data });
        }
    );

    // ── Write routes (editor+) ───────────────────────────────────────────────

    const writeAuth = [app.authenticate, requirePermission('pages:write')];

    /**
     * POST /pages
     * Creates a new page in the Logseq graph.
     */
    app.post(
        '/',
        {
            preHandler: writeAuth,
            schema: {
                tags: ['Pages'],
                operationId: 'createPage',
                summary: 'Create a page',
                description:
                    'Creates a new page with the given name. ' +
                    'Returns 409 if the page could not be created ' +
                    '(e.g. a page with that name already exists).',
                security: [{ bearerAuth: [] }],
                body: {
                    type: 'object',
                    required: ['name'],
                    properties: {
                        name: {
                            type: 'string',
                            description: 'Page name'
                        },
                        properties: {
                            type: 'object',
                            additionalProperties: true,
                            description: 'Initial page properties'
                        },
                        journal: {
                            type: 'boolean',
                            default: false,
                            description: 'Create as a journal page'
                        }
                    }
                },
                response: {
                    201: { $ref: 'LogseqPage#' },
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
                    409: {
                        description: 'Page already exists or could not be created',
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
            const { name, properties = {}, journal = false } =
                request.body as {
                    name: string;
                    properties?: Record<string, unknown>;
                    journal?: boolean;
                };

            const page = await callLogseq<LogseqPage | null>(
                Methods.CREATE_PAGE,
                [name, properties, { journal }]
            );

            if (!page) {
                return reply.code(409).send({
                    error: {
                        code: 'CONFLICT',
                        message: `Page '${name}' already exists or could not be created`
                    }
                });
            }

            return reply.code(201).send(
                normalizePageForApi(page as unknown as Record<string, unknown>)
            );
        }
    );

    /**
     * PATCH /pages/:name
     * Renames a page.
     */
    app.patch(
        '/:name',
        {
            preHandler: writeAuth,
            schema: {
                tags: ['Pages'],
                operationId: 'renamePage',
                summary: 'Rename a page',
                description: 'Renames the specified page to a new name.',
                security: [{ bearerAuth: [] }],
                params: {
                    type: 'object',
                    required: ['name'],
                    properties: {
                        name: {
                            type: 'string',
                            description: 'Current page name (URL-encoded)'
                        }
                    }
                },
                body: {
                    type: 'object',
                    required: ['name'],
                    properties: {
                        name: {
                            type: 'string',
                            description: 'New page name'
                        }
                    }
                },
                response: {
                    204: { description: 'Page renamed successfully', type: 'null' },
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
            const { name } = request.params as { name: string };
            const { name: newName } = request.body as { name: string };

            await callLogseq(Methods.RENAME_PAGE, [name, newName]);

            return reply.code(204).send();
        }
    );

    /**
     * DELETE /pages/:name
     * Deletes a page from the Logseq graph.
     */
    app.delete(
        '/:name',
        {
            preHandler: writeAuth,
            schema: {
                tags: ['Pages'],
                operationId: 'deletePage',
                summary: 'Delete a page',
                description: 'Permanently deletes the named page from the graph.',
                security: [{ bearerAuth: [] }],
                params: {
                    type: 'object',
                    required: ['name'],
                    properties: {
                        name: {
                            type: 'string',
                            description: 'Page name to delete (URL-encoded)'
                        }
                    }
                },
                response: {
                    204: { description: 'Page deleted successfully', type: 'null' },
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
            const { name } = request.params as { name: string };
            await callLogseq(Methods.DELETE_PAGE, [name]);
            return reply.code(204).send();
        }
    );

    /**
     * POST /pages/:name/blocks
     * Appends a block to the end of the named page.
     */
    app.post(
        '/:name/blocks',
        {
            preHandler: [app.authenticate, requirePermission('blocks:write')],
            schema: {
                tags: ['Pages'],
                operationId: 'appendBlockToPage',
                summary: 'Append a block to a page',
                description:
                    'Appends a new block to the end of the named page. ' +
                    'Returns 404 if the page does not exist.',
                security: [{ bearerAuth: [] }],
                params: {
                    type: 'object',
                    required: ['name'],
                    properties: {
                        name: {
                            type: 'string',
                            description: 'Page name (URL-encoded)'
                        }
                    }
                },
                body: {
                    type: 'object',
                    required: ['content'],
                    properties: {
                        content: {
                            type: 'string',
                            description: 'Block content (Markdown or Org)'
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
                        description: 'Page not found',
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
            const { name } = request.params as { name: string };
            const { content, properties } = request.body as {
                content: string;
                properties?: Record<string, unknown>;
            };

            const opts = properties ? { properties } : {};

            const block = await callLogseq<LogseqBlock | null>(
                Methods.APPEND_BLOCK_IN_PAGE,
                [name, content, opts]
            );

            if (!block) {
                return reply.code(404).send({
                    error: {
                        code: 'NOT_FOUND',
                        message: `Page '${name}' not found`
                    }
                });
            }

            return reply.code(201).send(block);
        }
    );
}
