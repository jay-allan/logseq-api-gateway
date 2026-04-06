import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';

/**
 * Echoes the request ID back to the caller as an `X-Request-Id` response
 * header. The ID is either taken from the incoming `X-Request-Id` request
 * header (allowing callers to correlate their own IDs) or generated as a
 * UUID by Fastify's `genReqId` option set in `buildApp`.
 *
 * Fastify's built-in Pino HTTP logger automatically includes `reqId` in every
 * log line produced within the request lifecycle, so no additional wiring is
 * needed for HTTP-level request logging.
 */
async function requestIdPlugin(app: FastifyInstance): Promise<void> {
    app.addHook('onSend', (_request, reply, _payload, done) => {
        void reply.header('X-Request-Id', _request.id);
        done();
    });
}

export default fp(requestIdPlugin);
