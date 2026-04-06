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
                summary: 'Service liveness check',
                description:
                    'Returns the current service status, write queue depth, and ' +
                    'whether the upstream Logseq instance is reachable.',
                response: {
                    200: { $ref: 'HealthResponse#' },
                    503: { $ref: 'HealthResponse#' }
                }
            }
        },
        async (_request, reply) => {
            const queueDepth = getQueueDepth();
            const logseqReachable = opts.logseqConnect
                ? await probeLogseq()
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
