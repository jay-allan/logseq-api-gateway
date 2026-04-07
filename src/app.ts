import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { v4 as uuidv4 } from 'uuid';

import authPlugin from './plugins/auth';
import corsPlugin from './plugins/cors';
import rateLimitPlugin from './plugins/rate-limit';
import requestIdPlugin from './plugins/request-id';
import securityHeadersPlugin from './plugins/security-headers';
import swaggerPlugin from './plugins/swagger';
import { errorHandlerPlugin } from './plugins/error-handler';

import healthRoute from './routes/health';
import authRoute from './routes/auth';
import adminRoutes from './routes/admin';
import pagesRoute from './routes/pages';
import blocksRoute from './routes/blocks';
import journalsRoute from './routes/journals';
import tagsRoute from './routes/tags';
import propertiesRoute from './routes/properties';
import queryRoute from './routes/query';

import { config } from './config';

export interface BuildAppOptions {
    /** When true, app starts without connecting to Logseq (used by OpenAPI generator) */
    logseqConnect?: boolean;
}

export async function buildApp(
    opts: BuildAppOptions = {}
): Promise<FastifyInstance> {
    const app = Fastify({
        logger: config.NODE_ENV !== 'test',
        requestIdHeader: 'x-request-id',
        genReqId: () => uuidv4(),
        ajv: {
            customOptions: {
                removeAdditional: true,
                coerceTypes: 'array',
                useDefaults: true
            }
        }
    });

    // Plugins (order matters: swagger → cors → rate-limit → auth → request-id)
    await app.register(swaggerPlugin);
    await app.register(corsPlugin);
    await app.register(rateLimitPlugin);
    await app.register(authPlugin);
    await app.register(requestIdPlugin);
    await app.register(securityHeadersPlugin);
    await errorHandlerPlugin(app);

    // Routes
    await app.register(healthRoute, { logseqConnect: opts.logseqConnect ?? true });
    await app.register(authRoute, { prefix: '/auth' });
    await app.register(adminRoutes, { prefix: '/admin' });
    await app.register(pagesRoute, { prefix: '/pages' });
    await app.register(blocksRoute, { prefix: '/blocks' });
    await app.register(journalsRoute, { prefix: '/journals' });
    await app.register(tagsRoute, { prefix: '/tags' });
    await app.register(propertiesRoute, { prefix: '/properties' });
    await app.register(queryRoute, { prefix: '/query' });

    return app;
}
