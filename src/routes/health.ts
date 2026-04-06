import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { getQueueDepth } from '../write-queue';
import { probeLogseq } from '../logseq/client';

interface HealthOptions extends FastifyPluginOptions {
    logseqConnect: boolean;
}

export default async function healthRoute(
    app: FastifyInstance,
    opts: HealthOptions
): Promise<void> {
    app.get(
        '/health',
        {
            schema: {
                tags: ['Health'],
                operationId: 'getHealth',
                summary: 'Service liveness check',
                description:
                    'Returns the current service status, write queue depth, and ' +
                    'whether the upstream Logseq instance is reachable.',
                security: [],
                response: {
                    200: { $ref: 'HealthResponse#' },
                    503: {
                        description: 'Service degraded (Logseq unreachable or queue backed up)',
                        $ref: 'HealthResponse#'
                    },
                    500: {
                        description: 'Internal server error',
                        $ref: 'ErrorResponse#'
                    }
                }
            }
        },
        async (_request, reply) => {
            const queueDepth = getQueueDepth();
            const logseqReachable = opts.logseqConnect
                ? (await probeLogseq()) === null
                : false;

            const degraded = !logseqReachable || queueDepth > 0;
            reply.code(degraded ? 503 : 200).send({
                status: degraded ? 'degraded' : 'ok',
                queueDepth,
                logseqReachable
            });
        }
    );
}
