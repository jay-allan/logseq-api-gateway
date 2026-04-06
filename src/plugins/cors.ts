import fp from 'fastify-plugin';
import fastifyCors from '@fastify/cors';
import type { FastifyInstance } from 'fastify';
import { config } from '../config';

async function corsPlugin(app: FastifyInstance): Promise<void> {
    await app.register(fastifyCors, {
        origin: config.NODE_ENV === 'production' ? false : true,
        methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS']
    });
}

export default fp(corsPlugin);
