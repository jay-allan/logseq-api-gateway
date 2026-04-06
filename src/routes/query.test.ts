import type { FastifyInstance } from 'fastify';
import {
    buildTestApp,
    teardownTestApp,
    getTokenForRole
} from '../../test/helpers';

jest.mock('../logseq/client', () => ({
    callLogseq: jest.fn(),
    probeLogseq: jest.fn().mockResolvedValue(true)
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { callLogseq } = require('../logseq/client') as {
    callLogseq: jest.Mock;
};

describe('Query route', () => {
    let app: FastifyInstance;
    let viewerToken: string;
    let editorToken: string;

    beforeAll(async () => {
        app = await buildTestApp();
        [viewerToken, editorToken] = await Promise.all([
            getTokenForRole(app, 'viewer'),
            getTokenForRole(app, 'editor')
        ]);
    });

    afterAll(() => teardownTestApp(app));

    beforeEach(() => callLogseq.mockReset());

    // ── POST /query ─────────────────────────────────────────────────────────

    describe('POST /query', () => {
        const QUERY = '[:find ?name :where [?b :block/name ?name]]';

        it('returns 200 with the raw query result', async () => {
            const rawResult = [['page-one'], ['page-two']];
            callLogseq.mockResolvedValueOnce(rawResult);

            const res = await app.inject({
                method: 'POST',
                url: '/query',
                headers: { Authorization: `Bearer ${editorToken}` },
                payload: { query: QUERY }
            });

            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res.body);
            expect(body.result).toEqual(rawResult);
        });

        it('passes the query string to datascriptQuery', async () => {
            callLogseq.mockResolvedValueOnce([]);

            await app.inject({
                method: 'POST',
                url: '/query',
                headers: { Authorization: `Bearer ${editorToken}` },
                payload: { query: QUERY }
            });

            expect(callLogseq).toHaveBeenCalledWith(
                'logseq.DB.datascriptQuery',
                [QUERY]
            );
        });

        it('passes optional inputs to the query', async () => {
            callLogseq.mockResolvedValueOnce([]);

            await app.inject({
                method: 'POST',
                url: '/query',
                headers: { Authorization: `Bearer ${editorToken}` },
                payload: { query: QUERY, inputs: ['extra-arg'] }
            });

            expect(callLogseq).toHaveBeenCalledWith(
                'logseq.DB.datascriptQuery',
                [QUERY, 'extra-arg']
            );
        });

        it('returns 403 for viewer role', async () => {
            const res = await app.inject({
                method: 'POST',
                url: '/query',
                headers: { Authorization: `Bearer ${viewerToken}` },
                payload: { query: QUERY }
            });

            expect(res.statusCode).toBe(403);
        });

        it('returns 401 without token', async () => {
            const res = await app.inject({
                method: 'POST',
                url: '/query',
                payload: { query: QUERY }
            });
            expect(res.statusCode).toBe(401);
        });

        it('returns 400 when query is missing', async () => {
            const res = await app.inject({
                method: 'POST',
                url: '/query',
                headers: { Authorization: `Bearer ${editorToken}` },
                payload: {}
            });
            expect(res.statusCode).toBe(400);
        });

        it('returns 502 when Logseq is unreachable', async () => {
            callLogseq.mockRejectedValueOnce(
                Object.assign(new Error('Logseq unreachable'), {
                    statusCode: 502,
                    code: 'BAD_GATEWAY'
                })
            );

            const res = await app.inject({
                method: 'POST',
                url: '/query',
                headers: { Authorization: `Bearer ${editorToken}` },
                payload: { query: QUERY }
            });

            expect(res.statusCode).toBe(502);
        });
    });
});
