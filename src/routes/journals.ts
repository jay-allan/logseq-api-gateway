import type { FastifyInstance } from 'fastify';
import { callLogseq } from '../logseq/client';
import { Methods } from '../logseq/methods';
import { requirePermission } from '../auth/rbac';
import type { LogseqPage } from '../types/logseq';
import { normalizeDatascriptEntity, paginate, paginationQuerySchema } from './utils';

/** Datascript query that fetches all journal pages. */
const ALL_JOURNALS_QUERY =
    '[:find (pull ?p [*]) :where [?p :block/journal? true]]';

export default async function journalsRoute(
    app: FastifyInstance
): Promise<void> {
    const auth = [app.authenticate, requirePermission('journals:read')];

    /**
     * GET /journals
     * Returns a paginated list of all journal pages, most-recent first.
     */
    app.get(
        '/',
        {
            preHandler: auth,
            schema: {
                tags: ['Journals'],
                operationId: 'listJournals',
                summary: 'List all journal pages',
                description:
                    'Returns a paginated list of all daily journal pages in the graph, ' +
                    'sorted by `journalDay` descending (most recent first).',
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

            // datascriptQuery returns [[page], [page], ...]; unwrap to flat array
            const raw = await callLogseq<[LogseqPage][]>(
                Methods.DATASCRIPT_QUERY,
                [ALL_JOURNALS_QUERY]
            );

            const pages = (raw ?? [])
                .map(([page]) => normalizeDatascriptEntity(
                    page as unknown as Record<string, unknown>
                ))
                .sort((a, b) =>
                    ((b.journalDay as number) ?? 0) -
                    ((a.journalDay as number) ?? 0)
                );

            return reply.code(200).send(paginate(pages, limit, offset));
        }
    );

    /**
     * GET /journals/:date
     * Returns the journal page for a specific date (YYYY-MM-DD).
     */
    app.get(
        '/:date',
        {
            preHandler: auth,
            schema: {
                tags: ['Journals'],
                operationId: 'getJournal',
                summary: 'Get a journal page by date',
                description:
                    'Returns the journal page for the given date. ' +
                    'The date must be in `YYYY-MM-DD` format.',
                security: [{ bearerAuth: [] }],
                params: {
                    type: 'object',
                    required: ['date'],
                    properties: {
                        date: {
                            type: 'string',
                            pattern: '^\\d{4}-\\d{2}-\\d{2}$',
                            description: 'Journal date in YYYY-MM-DD format'
                        }
                    }
                },
                response: {
                    200: { $ref: 'LogseqPage#' },
                    400: {
                        description: 'Invalid date format',
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
                        description: 'No journal page exists for this date',
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
            const { date } = request.params as { date: string };

            // Convert YYYY-MM-DD to the integer YYYYMMDD that Logseq stores
            const journalDay = parseInt(date.replace(/-/g, ''), 10);

            const query = `[:find (pull ?p [*]) :where [?p :block/journal-day ${journalDay}]]`;

            const raw = await callLogseq<[LogseqPage][]>(
                Methods.DATASCRIPT_QUERY,
                [query]
            );

            if (!raw || raw.length === 0) {
                return reply.code(404).send({
                    error: {
                        code: 'NOT_FOUND',
                        message: `No journal page found for date '${date}'`
                    }
                });
            }

            return reply.code(200).send(
                normalizeDatascriptEntity(
                    raw[0][0] as unknown as Record<string, unknown>
                )
            );
        }
    );

    /**
     * POST /journals/:date
     * Creates (or ensures) the journal page for the given date.
     */
    app.post(
        '/:date',
        {
            preHandler: [
                app.authenticate,
                requirePermission('journals:write')
            ],
            schema: {
                tags: ['Journals'],
                operationId: 'createJournal',
                summary: 'Create a journal page',
                description:
                    'Creates the daily journal page for the given date if it ' +
                    'does not already exist. Returns 404 if Logseq could not ' +
                    'create the page.',
                security: [{ bearerAuth: [] }],
                params: {
                    type: 'object',
                    required: ['date'],
                    properties: {
                        date: {
                            type: 'string',
                            pattern: '^\\d{4}-\\d{2}-\\d{2}$',
                            description: 'Journal date in YYYY-MM-DD format'
                        }
                    }
                },
                response: {
                    201: { $ref: 'LogseqPage#' },
                    400: {
                        description: 'Invalid date format',
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
                        description: 'Logseq could not create the journal page',
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
            const { date } = request.params as { date: string };
            const journalDay = parseInt(date.replace(/-/g, ''), 10);

            const page = await callLogseq<LogseqPage | null>(
                Methods.CREATE_JOURNAL_PAGE,
                [journalDay]
            );

            if (!page) {
                return reply.code(404).send({
                    error: {
                        code: 'NOT_FOUND',
                        message: `Could not create journal page for '${date}'`
                    }
                });
            }

            return reply.code(201).send(page);
        }
    );
}
