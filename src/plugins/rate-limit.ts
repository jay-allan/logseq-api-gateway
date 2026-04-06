import fp from 'fastify-plugin';
import fastifyRateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';

async function rateLimitPlugin(app: FastifyInstance): Promise<void> {
    await app.register(fastifyRateLimit, {
        max: 200,
        timeWindow: '1 minute',
        errorResponseBuilder: () => ({
            error: {
                code: 'TOO_MANY_REQUESTS',
                message: 'Rate limit exceeded — try again later'
            }
        })
    });
}

export default fp(rateLimitPlugin);
