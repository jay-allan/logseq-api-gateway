import fp from 'fastify-plugin';
import fastifyRateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';

async function rateLimitPlugin(app: FastifyInstance): Promise<void> {
    await app.register(fastifyRateLimit, {
        max: 200,
        timeWindow: '1 minute',
        errorResponseBuilder: (_req, context) => {
            const err = new Error(
                `Rate limit exceeded — try again in ${context.after}`
            ) as Error & { statusCode: number };
            err.statusCode = context.statusCode;
            return err;
        }
    });
}

export default fp(rateLimitPlugin);
