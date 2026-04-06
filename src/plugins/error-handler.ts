import type { FastifyInstance, FastifyError } from 'fastify';
import { Logger } from '../Logger';

/**
 * Registers a global error handler that normalises all errors to
 * `{ error: { code, message, details? } }` shape.
 */
export async function errorHandlerPlugin(app: FastifyInstance): Promise<void> {
    app.setErrorHandler((err: FastifyError, request, reply) => {
        const status = err.statusCode ?? 500;

        if (status >= 500) {
            Logger.error(
                `Unhandled error [${request.method} ${request.url}]: ${err.message}`
            );
        }

        if (err.validation) {
            reply.code(400).send({
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Request validation failed',
                    details: err.validation
                }
            });
            return;
        }

        reply.code(status).send({
            error: {
                code: err.code ?? httpStatusToCode(status),
                message: err.message
            }
        });
    });

    app.setNotFoundHandler((request, reply) => {
        reply.code(404).send({
            error: {
                code: 'NOT_FOUND',
                message: `Route ${request.method} ${request.url} not found`
            }
        });
    });
}

function httpStatusToCode(status: number): string {
    const codes: Record<number, string> = {
        400: 'BAD_REQUEST',
        401: 'UNAUTHORIZED',
        403: 'FORBIDDEN',
        404: 'NOT_FOUND',
        409: 'CONFLICT',
        422: 'UNPROCESSABLE_ENTITY',
        429: 'TOO_MANY_REQUESTS',
        500: 'INTERNAL_SERVER_ERROR',
        502: 'BAD_GATEWAY',
        503: 'SERVICE_UNAVAILABLE'
    };
    return codes[status] ?? 'INTERNAL_SERVER_ERROR';
}
