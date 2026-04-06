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

    await app.register(fastifySwaggerUi, {
        routePrefix: '/docs',
        uiConfig: { docExpansion: 'list', deepLinking: true }
    });
}

export default fp(swaggerPlugin);
