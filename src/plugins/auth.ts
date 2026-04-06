import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config';

/**
 * Registers JWT support and decorates the instance with an `authenticate`
 * preHandler that rejects requests without a valid Bearer token.
 */
async function authPlugin(app: FastifyInstance): Promise<void> {
    await app.register(fastifyJwt, {
        secret: config.JWT_SECRET,
        sign: {
            algorithm: 'HS256',
            expiresIn: config.JWT_ACCESS_TTL
        },
        verify: {
            algorithms: ['HS256']
        }
    });

    app.decorate(
        'authenticate',
        async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
            try {
                await request.jwtVerify();
            } catch {
                reply.code(401).send({
                    error: {
                        code: 'UNAUTHORIZED',
                        message: 'Valid Bearer token required'
                    }
                });
            }
        }
    );
}

export default fp(authPlugin);
