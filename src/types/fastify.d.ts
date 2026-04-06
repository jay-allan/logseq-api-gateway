import '@fastify/jwt';
import 'fastify';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { JwtPayload } from './api';

declare module '@fastify/jwt' {
    interface FastifyJWT {
        payload: JwtPayload;
        user: JwtPayload;
    }
}

declare module 'fastify' {
    interface FastifyInstance {
        authenticate(
            request: FastifyRequest,
            reply: FastifyReply
        ): Promise<void>;
    }
}
