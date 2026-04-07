import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';

/**
 * Sets defensive HTTP security headers on every response.
 *
 * These are low-effort, high-value headers that all APIs should include
 * regardless of whether they serve browser clients.
 *
 * OWASP A05 — Security Misconfiguration
 */
async function securityHeadersPlugin(app: FastifyInstance): Promise<void> {
    app.addHook('onSend', (_request, reply, _payload, done) => {
        reply.header('X-Content-Type-Options', 'nosniff');
        reply.header('X-Frame-Options', 'DENY');
        reply.header('Referrer-Policy', 'no-referrer');
        // Disable legacy XSS filter — modern browsers no longer support it
        // and it can introduce vulnerabilities when enabled.
        reply.header('X-XSS-Protection', '0');
        done();
    });
}

export default fp(securityHeadersPlugin);
