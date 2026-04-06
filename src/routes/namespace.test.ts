/**
 * Namespace page encoding tests.
 *
 * Logseq uses `/` as a namespace separator in page names, e.g. `projects/alpha`.
 * When accessing these pages via REST the `/` must be percent-encoded as `%2F`
 * so the router treats the whole string as a single path parameter:
 *
 *   GET /pages/projects%2Falpha   →   callLogseq('getPage', ['projects/alpha'])
 *
 * These tests verify that Fastify decodes `%2F` back to `/` in path params
 * before the handler passes the name to Logseq, and that a literal unencoded
 * slash in the URL produces a 404 (router finds no match).
 */
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

const NAMESPACE_PAGE = {
    id: 99,
    uuid: 'eeeeeeee-0000-0000-0000-000000000001',
    name: 'projects/alpha',
    originalName: 'Projects/Alpha',
    properties: {},
    journal: false
};

const MOCK_BLOCK = {
    uuid: 'ffffffff-0000-0000-0000-000000000001',
    content: 'Namespace block',
    properties: {},
    format: 'markdown' as const
};

describe('Namespace page encoding', () => {
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

    // ── GET /pages/:name ────────────────────────────────────────────────────

    describe('GET /pages/:name with %2F-encoded name', () => {
        it('decodes %2F and passes the slash to Logseq', async () => {
            callLogseq.mockResolvedValueOnce(NAMESPACE_PAGE);

            const res = await app.inject({
                method: 'GET',
                url: '/pages/projects%2Falpha',
                headers: { Authorization: `Bearer ${viewerToken}` }
            });

            expect(res.statusCode).toBe(200);
            expect(callLogseq).toHaveBeenCalledWith(
                'logseq.Editor.getPage',
                ['projects/alpha']
            );
        });

        it('handles deeper namespaces (multiple %2F)', async () => {
            callLogseq.mockResolvedValueOnce({
                ...NAMESPACE_PAGE,
                name: 'a/b/c',
                originalName: 'A/B/C'
            });

            const res = await app.inject({
                method: 'GET',
                url: '/pages/a%2Fb%2Fc',
                headers: { Authorization: `Bearer ${viewerToken}` }
            });

            expect(res.statusCode).toBe(200);
            expect(callLogseq).toHaveBeenCalledWith(
                'logseq.Editor.getPage',
                ['a/b/c']
            );
        });

        it('returns 404 for an unencoded slash (treated as unknown route)', async () => {
            // /pages/projects/alpha is NOT the same as /pages/projects%2Falpha
            // The router sees two extra segments and finds no matching route.
            const res = await app.inject({
                method: 'GET',
                url: '/pages/projects/alpha',
                headers: { Authorization: `Bearer ${viewerToken}` }
            });

            // The router will return 404 because no route matches this path shape.
            expect(res.statusCode).toBe(404);
        });
    });

    // ── GET /pages/:name/blocks ─────────────────────────────────────────────

    describe('GET /pages/:name/blocks with %2F-encoded name', () => {
        it('decodes %2F and passes the slash to Logseq', async () => {
            callLogseq.mockResolvedValueOnce([MOCK_BLOCK]);

            const res = await app.inject({
                method: 'GET',
                url: '/pages/projects%2Falpha/blocks',
                headers: { Authorization: `Bearer ${viewerToken}` }
            });

            expect(res.statusCode).toBe(200);
            expect(callLogseq).toHaveBeenCalledWith(
                'logseq.Editor.getPageBlocksTree',
                ['projects/alpha']
            );
        });
    });

    // ── GET /pages/:name/links ──────────────────────────────────────────────

    describe('GET /pages/:name/links with %2F-encoded name', () => {
        it('decodes %2F and passes the slash to Logseq', async () => {
            callLogseq.mockResolvedValueOnce([[NAMESPACE_PAGE, [MOCK_BLOCK]]]);

            const res = await app.inject({
                method: 'GET',
                url: '/pages/projects%2Falpha/links',
                headers: { Authorization: `Bearer ${viewerToken}` }
            });

            expect(res.statusCode).toBe(200);
            expect(callLogseq).toHaveBeenCalledWith(
                'logseq.Editor.getPageLinkedReferences',
                ['projects/alpha']
            );
        });
    });

    // ── POST /pages/:name/blocks ────────────────────────────────────────────

    describe('POST /pages/:name/blocks with %2F-encoded name', () => {
        it('decodes %2F and passes the slash to Logseq', async () => {
            callLogseq.mockResolvedValueOnce(MOCK_BLOCK);

            const res = await app.inject({
                method: 'POST',
                url: '/pages/projects%2Falpha/blocks',
                headers: { Authorization: `Bearer ${editorToken}` },
                payload: { content: 'New block' }
            });

            expect(res.statusCode).toBe(201);
            expect(callLogseq).toHaveBeenCalledWith(
                'logseq.Editor.appendBlockInPage',
                ['projects/alpha', 'New block', {}]
            );
        });
    });

    // ── PATCH /pages/:name ──────────────────────────────────────────────────

    describe('PATCH /pages/:name with %2F-encoded name', () => {
        it('decodes %2F and passes the slash to Logseq', async () => {
            callLogseq.mockResolvedValueOnce(true);

            const res = await app.inject({
                method: 'PATCH',
                url: '/pages/projects%2Falpha',
                headers: { Authorization: `Bearer ${editorToken}` },
                payload: { name: 'Projects/Beta' }
            });

            expect(res.statusCode).toBe(204);
            expect(callLogseq).toHaveBeenCalledWith(
                'logseq.Editor.renamePage',
                ['projects/alpha', 'Projects/Beta']
            );
        });
    });

    // ── DELETE /pages/:name ─────────────────────────────────────────────────

    describe('DELETE /pages/:name with %2F-encoded name', () => {
        it('decodes %2F and passes the slash to Logseq', async () => {
            callLogseq.mockResolvedValueOnce(true);

            const res = await app.inject({
                method: 'DELETE',
                url: '/pages/projects%2Falpha',
                headers: { Authorization: `Bearer ${editorToken}` }
            });

            expect(res.statusCode).toBe(204);
            expect(callLogseq).toHaveBeenCalledWith(
                'logseq.Editor.deletePage',
                ['projects/alpha']
            );
        });
    });
});
