import fp from 'fastify-plugin';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import type { FastifyInstance } from 'fastify';

/**
 * Named schemas registered via addSchema so that `$ref: 'Name#'` works in
 * route schemas for both validation/serialization and OpenAPI generation.
 */
const SHARED_SCHEMAS = [
    {
        $id: 'ErrorResponse',
        type: 'object',
        description: 'Standard error envelope',
        required: ['error'],
        properties: {
            error: {
                type: 'object',
                required: ['code', 'message'],
                properties: {
                    code: {
                        type: 'string',
                        description: 'Machine-readable error code'
                    },
                    message: {
                        type: 'string',
                        description: 'Human-readable error message'
                    },
                    details: {
                        description: 'Additional error context'
                    }
                }
            }
        }
    },
    {
        $id: 'User',
        type: 'object',
        description: 'A gateway user account',
        required: ['id', 'username', 'role', 'isActive', 'createdAt', 'updatedAt'],
        properties: {
            id: {
                type: 'string',
                format: 'uuid',
                description: 'User identifier'
            },
            username: { type: 'string', description: 'Unique login name' },
            email: {
                type: 'string',
                format: 'email',
                description: 'Optional email address'
            },
            role: {
                type: 'string',
                enum: ['admin', 'editor', 'viewer'],
                description: 'Access role'
            },
            isActive: {
                type: 'boolean',
                description: 'Whether the account is active'
            },
            createdAt: {
                type: 'string',
                format: 'date-time',
                description: 'ISO 8601 creation timestamp'
            },
            updatedAt: {
                type: 'string',
                format: 'date-time',
                description: 'ISO 8601 last-update timestamp'
            }
        }
    },
    {
        $id: 'TokenPair',
        type: 'object',
        description: 'JWT access token and opaque refresh token pair',
        required: ['accessToken', 'refreshToken'],
        properties: {
            accessToken: {
                type: 'string',
                description: 'Short-lived JWT access token (15 min)'
            },
            refreshToken: {
                type: 'string',
                description: 'Long-lived opaque refresh token (7 days)'
            }
        }
    },
    {
        $id: 'HealthResponse',
        type: 'object',
        description: 'Service liveness and diagnostic information',
        required: ['status', 'queueDepth', 'logseqReachable'],
        properties: {
            status: {
                type: 'string',
                enum: ['ok', 'degraded'],
                description:
                    '"ok" when Logseq is reachable and write queue is empty'
            },
            queueDepth: {
                type: 'integer',
                minimum: 0,
                description: 'Number of writes waiting in the queue'
            },
            logseqReachable: {
                type: 'boolean',
                description:
                    'Whether the upstream Logseq instance responded to a probe'
            }
        }
    },
    {
        $id: 'PaginationMeta',
        type: 'object',
        description: 'Pagination metadata',
        required: ['total', 'limit', 'offset'],
        properties: {
            total: {
                type: 'integer',
                description: 'Total number of matching items'
            },
            limit: {
                type: 'integer',
                description: 'Page size used for this response'
            },
            offset: {
                type: 'integer',
                description: 'Zero-based offset of the first returned item'
            }
        }
    },
    {
        $id: 'LogseqPage',
        type: 'object',
        description: 'A Logseq page or journal entry',
        required: ['id', 'uuid', 'name'],
        additionalProperties: true,
        properties: {
            id: { type: 'integer', description: 'Internal Logseq page ID' },
            uuid: { type: 'string', description: 'Page UUID' },
            name: {
                type: 'string',
                description:
                    'Display name as entered by the user (original casing)'
            },
            normalizedName: {
                type: 'string',
                description:
                    'Lower-case normalized page name ' +
                    '(Logseq internal identifier, derived from `:block/name`)'
            },
            properties: {
                type: 'object',
                additionalProperties: true,
                description: 'Page-level properties'
            },
            isJournal: {
                type: 'boolean',
                description: 'True when this page is a journal entry'
            },
            journalDay: {
                type: 'integer',
                description: 'Journal date as YYYYMMDD integer'
            },
            createdAt: {
                type: 'integer',
                description: 'Creation timestamp (ms since epoch)'
            },
            updatedAt: {
                type: 'integer',
                description: 'Last-updated timestamp (ms since epoch)'
            }
        }
    },
    {
        $id: 'LogseqBlock',
        type: 'object',
        description: 'A Logseq block',
        required: ['uuid', 'content'],
        additionalProperties: true,
        properties: {
            uuid: { type: 'string', description: 'Block UUID' },
            content: {
                type: 'string',
                description: 'Raw block content (Markdown or Org)'
            },
            properties: {
                type: 'object',
                additionalProperties: true,
                description: 'Block-level properties'
            },
            format: {
                type: 'string',
                enum: ['markdown', 'org'],
                description: 'Block content format'
            },
            marker: {
                type: 'string',
                description: 'Task marker (TODO, DOING, DONE, etc.)'
            },
            priority: {
                type: 'string',
                description: 'Task priority (A, B, C)'
            },
            children: {
                type: 'array',
                description: 'Nested child blocks (present when includeChildren=true)'
            }
        }
    },
    {
        $id: 'LogseqTag',
        type: 'object',
        description: 'A Logseq tag (class page)',
        required: ['id', 'uuid', 'name'],
        additionalProperties: true,
        properties: {
            id: { type: 'integer', description: 'Internal Logseq tag ID' },
            uuid: { type: 'string', description: 'Tag UUID' },
            name: { type: 'string', description: 'Normalised tag name' },
            originalName: {
                type: 'string',
                description: 'Tag name as entered by the user'
            }
        }
    },
    {
        $id: 'LogseqProperty',
        type: 'object',
        description: 'A Logseq property schema entry',
        required: ['id', 'name'],
        additionalProperties: true,
        properties: {
            id: {
                type: 'integer',
                description: 'Internal Logseq property ID'
            },
            name: { type: 'string', description: 'Property key name' },
            schema: {
                type: 'object',
                additionalProperties: true,
                description: 'Property schema definition'
            }
        }
    },
    {
        $id: 'PageList',
        type: 'object',
        description: 'Paginated list of Logseq pages',
        required: ['data', 'meta'],
        properties: {
            data: {
                type: 'array',
                items: { $ref: 'LogseqPage#' },
                description: 'Page items for this page of results'
            },
            meta: { $ref: 'PaginationMeta#' }
        }
    },
    {
        $id: 'TagList',
        type: 'object',
        description: 'Paginated list of Logseq tags',
        required: ['data', 'meta'],
        properties: {
            data: {
                type: 'array',
                items: { $ref: 'LogseqTag#' },
                description: 'Tag items for this page of results'
            },
            meta: { $ref: 'PaginationMeta#' }
        }
    },
    {
        $id: 'PropertyList',
        type: 'object',
        description: 'Paginated list of Logseq property schemas',
        required: ['data', 'meta'],
        properties: {
            data: {
                type: 'array',
                items: { $ref: 'LogseqProperty#' },
                description: 'Property items for this page of results'
            },
            meta: { $ref: 'PaginationMeta#' }
        }
    },
    {
        $id: 'BlockTree',
        type: 'object',
        description: 'Block tree for a page (blocks may include nested children)',
        required: ['data'],
        properties: {
            data: {
                type: 'array',
                items: { $ref: 'LogseqBlock#' },
                description: 'Top-level blocks; each may have a children array'
            }
        }
    },
    {
        $id: 'BlockList',
        type: 'object',
        description: 'Flat list of Logseq blocks',
        required: ['data'],
        properties: {
            data: {
                type: 'array',
                items: { $ref: 'LogseqBlock#' },
                description: 'Block items'
            }
        }
    },
    {
        $id: 'BlockProperties',
        type: 'object',
        description: 'Key/value properties attached to a block',
        required: ['properties'],
        properties: {
            properties: {
                type: 'object',
                additionalProperties: true,
                description: 'Block property map'
            }
        }
    },
    {
        $id: 'UserList',
        type: 'object',
        description: 'List of gateway user accounts',
        required: ['data'],
        properties: {
            data: {
                type: 'array',
                items: { $ref: 'User#' },
                description: 'User accounts'
            }
        }
    },
    {
        $id: 'QueueStatus',
        type: 'object',
        description: 'Current state of the write-serialization queue',
        required: ['depth', 'maxDepth', 'timeoutMs'],
        properties: {
            depth: {
                type: 'integer',
                minimum: 0,
                description: 'Number of write operations currently waiting in the queue'
            },
            maxDepth: {
                type: 'integer',
                description: 'Queue depth at which new writes are rejected with 503'
            },
            timeoutMs: {
                type: 'integer',
                description: 'Per-operation timeout in milliseconds'
            }
        }
    },
    {
        $id: 'RoleMatrix',
        type: 'object',
        description: 'Static mapping of each role to its granted permissions',
        additionalProperties: {
            type: 'array',
            items: { type: 'string', description: 'Permission name' }
        }
    },
    {
        $id: 'QueryResult',
        type: 'object',
        description: 'Raw Datalog query result from Logseq',
        required: ['result'],
        properties: {
            result: {
                description:
                    'Raw query result — structure depends on the query ' +
                    ':find clause. Each element corresponds to one result tuple.'
            }
        }
    },
    {
        $id: 'PageReferenceList',
        type: 'object',
        description:
            'Pages that contain references to the requested page, ' +
            'together with the referencing blocks from each page',
        required: ['data'],
        properties: {
            data: {
                type: 'array',
                description: 'Referencing pages with their blocks',
                items: {
                    type: 'object',
                    additionalProperties: true,
                    properties: {
                        page: { $ref: 'LogseqPage#' },
                        blocks: {
                            type: 'array',
                            items: { $ref: 'LogseqBlock#' }
                        }
                    }
                }
            }
        }
    }
];

async function swaggerPlugin(app: FastifyInstance): Promise<void> {
    // Register shared schemas for $ref resolution in route schemas
    for (const schema of SHARED_SCHEMAS) {
        app.addSchema(schema);
    }

    await app.register(fastifySwagger, {
        openapi: {
            openapi: '3.1.0',
            info: {
                title: 'Logseq API Gateway',
                description:
                    'REST API Gateway for Logseq with role-based access control, ' +
                    'write serialization, and full OpenAPI documentation.',
                version: '0.1.0',
                contact: { name: 'API Support' }
            },
            servers: [{ url: 'http://localhost:3000', description: 'Local' }],
            components: {
                securitySchemes: {
                    bearerAuth: {
                        type: 'http',
                        scheme: 'bearer',
                        bearerFormat: 'JWT',
                        description:
                            'JWT access token obtained from POST /auth/login'
                    }
                }
            },
            tags: [
                {
                    name: 'Auth',
                    description: 'Authentication and token management'
                },
                {
                    name: 'Health',
                    description: 'Service liveness and diagnostics'
                },
                { name: 'Pages', description: 'Logseq page operations' },
                { name: 'Blocks', description: 'Logseq block operations' },
                {
                    name: 'Journals',
                    description: 'Logseq journal page operations'
                },
                {
                    name: 'Tags',
                    description: 'Logseq tag and class operations'
                },
                {
                    name: 'Properties',
                    description: 'Logseq property schema operations'
                },
                { name: 'Query', description: 'Datalog query passthrough' },
                {
                    name: 'Admin',
                    description: 'User and system administration'
                }
            ]
        }
    });

    // Swagger UI can be disabled at runtime (e.g. in production) by setting
    // SWAGGER_ENABLED=false. Read from process.env so tests can override.
    const swaggerEnabled = process.env.SWAGGER_ENABLED !== 'false';
    if (swaggerEnabled) {
        await app.register(fastifySwaggerUi, {
            routePrefix: '/docs',
            uiConfig: { docExpansion: 'list', deepLinking: true }
        });
    }
}

export default fp(swaggerPlugin);
