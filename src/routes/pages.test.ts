import type { FastifyInstance } from 'fastify';
import {
    buildTestApp,
    teardownTestApp,
    getTokenForRole
} from '../../test/helpers';

jest.mock('../logseq/client', () => ({
    callLogseq: jest.fn(),
    probeLogseq: jest.fn().mockResolvedValue(null)
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { callLogseq } = require('../logseq/client') as {
    callLogseq: jest.Mock;
};

const MOCK_PAGE = {
    id: 1,
    uuid: 'aaaaaaaa-0000-0000-0000-000000000001',
    name: 'test page',
    originalName: 'Test Page',
    properties: {},
    journal: false,
    createdAt: 1700000000000,
    updatedAt: 1700000000000
};

const MOCK_BLOCK = {
    uuid: 'bbbbbbbb-0000-0000-0000-000000000001',
    content: 'Hello world',
    properties: {},
    format: 'markdown' as const
};

describe('Pages routes', () => {
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

    // ── GET /pages ──────────────────────────────────────────────────────────

    describe('GET /pages', () => {
        it('returns 200 with paginated list', async () => {
            callLogseq.mockResolvedValueOnce([MOCK_PAGE]);

            const res = await app.inject({
                method: 'GET',
                url: '/pages',
                headers: { Authorization: `Bearer ${viewerToken}` }
            });

            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res.body);
            expect(body.data).toHaveLength(1);
            expect(body.data[0].uuid).toBe(MOCK_PAGE.uuid);
            expect(body.meta).toEqual({ total: 1, limit: 50, offset: 0 });
        });

        it('applies limit and offset', async () => {
            callLogseq.mockResolvedValueOnce([
                MOCK_PAGE,
                { ...MOCK_PAGE, id: 2, uuid: 'aaaaaaaa-0000-0000-0000-000000000002' },
                { ...MOCK_PAGE, id: 3, uuid: 'aaaaaaaa-0000-0000-0000-000000000003' }
            ]);

            const res = await app.inject({
                method: 'GET',
                url: '/pages?limit=2&offset=1',
                headers: { Authorization: `Bearer ${viewerToken}` }
            });

            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res.body);
            expect(body.data).toHaveLength(2);
            expect(body.meta).toEqual({ total: 3, limit: 2, offset: 1 });
        });

        it('returns 401 without token', async () => {
            const res = await app.inject({ method: 'GET', url: '/pages' });
            expect(res.statusCode).toBe(401);
        });

        it('returns 502 when Logseq is unreachable', async () => {
            callLogseq.mockRejectedValueOnce(
                Object.assign(new Error('Logseq unreachable'), {
                    statusCode: 502,
                    code: 'BAD_GATEWAY'
                })
            );

            const res = await app.inject({
                method: 'GET',
                url: '/pages',
                headers: { Authorization: `Bearer ${viewerToken}` }
            });

            expect(res.statusCode).toBe(502);
        });
    });

    // ── GET /pages/:name ────────────────────────────────────────────────────

    describe('GET /pages/:name', () => {
        it('returns 200 with the page', async () => {
            callLogseq.mockResolvedValueOnce(MOCK_PAGE);

            const res = await app.inject({
                method: 'GET',
                url: '/pages/test%20page',
                headers: { Authorization: `Bearer ${viewerToken}` }
            });

            expect(res.statusCode).toBe(200);
            expect(JSON.parse(res.body).uuid).toBe(MOCK_PAGE.uuid);
        });

        it('returns 404 when Logseq returns null', async () => {
            callLogseq.mockResolvedValueOnce(null);

            const res = await app.inject({
                method: 'GET',
                url: '/pages/nonexistent',
                headers: { Authorization: `Bearer ${viewerToken}` }
            });

            expect(res.statusCode).toBe(404);
        });

        it('returns 401 without token', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/pages/test'
            });
            expect(res.statusCode).toBe(401);
        });
    });

    // ── GET /pages/:name/blocks ─────────────────────────────────────────────

    describe('GET /pages/:name/blocks', () => {
        it('returns 200 with block tree', async () => {
            // getPageBlocksTree accepts a page name directly — no UUID resolution
            callLogseq.mockResolvedValueOnce([MOCK_BLOCK]);

            const res = await app.inject({
                method: 'GET',
                url: '/pages/test%20page/blocks',
                headers: { Authorization: `Bearer ${viewerToken}` }
            });

            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res.body);
            expect(body.data).toHaveLength(1);
            expect(body.data[0].uuid).toBe(MOCK_BLOCK.uuid);
        });

        it('calls getPageBlocksTree with the decoded page name', async () => {
            callLogseq.mockResolvedValueOnce([MOCK_BLOCK]);

            await app.inject({
                method: 'GET',
                url: '/pages/test%20page/blocks',
                headers: { Authorization: `Bearer ${viewerToken}` }
            });

            expect(callLogseq).toHaveBeenCalledTimes(1);
            expect(callLogseq).toHaveBeenCalledWith(
                'logseq.Editor.getPageBlocksTree', ['test page']
            );
        });

        it('returns 404 when getPageBlocksTree returns null', async () => {
            callLogseq.mockResolvedValueOnce(null);

            const res = await app.inject({
                method: 'GET',
                url: '/pages/nonexistent/blocks',
                headers: { Authorization: `Bearer ${viewerToken}` }
            });

            expect(res.statusCode).toBe(404);
        });
    });

    // ── GET /pages/:name/links ──────────────────────────────────────────────

    describe('GET /pages/:name/links', () => {
        it('returns 200 with reference list', async () => {
            // Route resolves UUID first, then fetches linked references
            callLogseq
                .mockResolvedValueOnce(MOCK_PAGE)                   // GET_PAGE
                .mockResolvedValueOnce([[MOCK_PAGE, [MOCK_BLOCK]]]); // GET_PAGE_LINKED_REFERENCES

            const res = await app.inject({
                method: 'GET',
                url: '/pages/test%20page/links',
                headers: { Authorization: `Bearer ${viewerToken}` }
            });

            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res.body);
            expect(body.data).toHaveLength(1);
            expect(body.data[0].page.uuid).toBe(MOCK_PAGE.uuid);
            expect(body.data[0].blocks).toHaveLength(1);
        });

        it('calls getPageLinkedReferences with the resolved UUID', async () => {
            callLogseq
                .mockResolvedValueOnce(MOCK_PAGE)
                .mockResolvedValueOnce([[MOCK_PAGE, [MOCK_BLOCK]]]);

            await app.inject({
                method: 'GET',
                url: '/pages/test%20page/links',
                headers: { Authorization: `Bearer ${viewerToken}` }
            });

            expect(callLogseq).toHaveBeenNthCalledWith(
                1, 'logseq.Editor.getPage', ['test page']
            );
            expect(callLogseq).toHaveBeenNthCalledWith(
                2, 'logseq.Editor.getPageLinkedReferences', [MOCK_PAGE.uuid]
            );
        });

        it('returns 404 when page does not exist', async () => {
            callLogseq.mockResolvedValueOnce(null); // GET_PAGE returns null

            const res = await app.inject({
                method: 'GET',
                url: '/pages/nonexistent/links',
                headers: { Authorization: `Bearer ${viewerToken}` }
            });

            expect(res.statusCode).toBe(404);
        });

        it('returns 200 with empty list when no references', async () => {
            callLogseq
                .mockResolvedValueOnce(MOCK_PAGE)  // GET_PAGE succeeds
                .mockResolvedValueOnce(null);       // but no linked references

            const res = await app.inject({
                method: 'GET',
                url: '/pages/test%20page/links',
                headers: { Authorization: `Bearer ${viewerToken}` }
            });

            expect(res.statusCode).toBe(200);
            expect(JSON.parse(res.body).data).toHaveLength(0);
        });

        it('returns 200 with empty list when getPage response has no uuid', async () => {
            // Logseq occasionally returns a page object without a uuid field.
            // Without the guard this propagates undefined to getPageLinkedReferences
            // which throws '"uuid" is required'.
            const pageWithoutUuid = { ...MOCK_PAGE, uuid: undefined };
            callLogseq.mockResolvedValueOnce(pageWithoutUuid);

            const res = await app.inject({
                method: 'GET',
                url: '/pages/test%20page/links',
                headers: { Authorization: `Bearer ${viewerToken}` }
            });

            expect(res.statusCode).toBe(200);
            expect(JSON.parse(res.body).data).toHaveLength(0);
            // Must NOT make a second Logseq call with undefined uuid
            expect(callLogseq).toHaveBeenCalledTimes(1);
        });

        it('viewer can reach this endpoint', async () => {
            callLogseq
                .mockResolvedValueOnce(MOCK_PAGE)
                .mockResolvedValueOnce([]);

            const res = await app.inject({
                method: 'GET',
                url: '/pages/test%20page/links',
                headers: { Authorization: `Bearer ${viewerToken}` }
            });

            expect(res.statusCode).toBe(200);
        });
    });

    // ── POST /pages ─────────────────────────────────────────────────────────

    describe('POST /pages', () => {
        it('returns 201 with the created page', async () => {
            callLogseq.mockResolvedValueOnce(MOCK_PAGE);

            const res = await app.inject({
                method: 'POST',
                url: '/pages',
                headers: { Authorization: `Bearer ${editorToken}` },
                payload: { name: 'Test Page' }
            });

            expect(res.statusCode).toBe(201);
            expect(JSON.parse(res.body).uuid).toBe(MOCK_PAGE.uuid);
        });

        it('passes properties and journal flag to Logseq', async () => {
            callLogseq.mockResolvedValueOnce(MOCK_PAGE);

            await app.inject({
                method: 'POST',
                url: '/pages',
                headers: { Authorization: `Bearer ${editorToken}` },
                payload: {
                    name: 'Test Page',
                    properties: { type: 'project' },
                    journal: false
                }
            });

            expect(callLogseq).toHaveBeenCalledWith(
                'logseq.Editor.createPage',
                ['Test Page', { type: 'project' }, { journal: false }]
            );
        });

        it('returns 409 when Logseq returns null', async () => {
            callLogseq.mockResolvedValueOnce(null);

            const res = await app.inject({
                method: 'POST',
                url: '/pages',
                headers: { Authorization: `Bearer ${editorToken}` },
                payload: { name: 'Existing Page' }
            });

            expect(res.statusCode).toBe(409);
        });

        it('returns 403 for viewer role', async () => {
            const res = await app.inject({
                method: 'POST',
                url: '/pages',
                headers: { Authorization: `Bearer ${viewerToken}` },
                payload: { name: 'Test Page' }
            });

            expect(res.statusCode).toBe(403);
        });

        it('returns 401 without token', async () => {
            const res = await app.inject({
                method: 'POST',
                url: '/pages',
                payload: { name: 'Test Page' }
            });
            expect(res.statusCode).toBe(401);
        });

        it('returns 400 when name is missing', async () => {
            const res = await app.inject({
                method: 'POST',
                url: '/pages',
                headers: { Authorization: `Bearer ${editorToken}` },
                payload: {}
            });
            expect(res.statusCode).toBe(400);
        });
    });

    // ── PATCH /pages/:name ──────────────────────────────────────────────────

    describe('PATCH /pages/:name', () => {
        it('returns 204 on success', async () => {
            callLogseq.mockResolvedValueOnce(true);

            const res = await app.inject({
                method: 'PATCH',
                url: '/pages/test%20page',
                headers: { Authorization: `Bearer ${editorToken}` },
                payload: { name: 'New Name' }
            });

            expect(res.statusCode).toBe(204);
        });

        it('calls renamePage with correct args', async () => {
            callLogseq.mockResolvedValueOnce(true);

            await app.inject({
                method: 'PATCH',
                url: '/pages/test%20page',
                headers: { Authorization: `Bearer ${editorToken}` },
                payload: { name: 'New Name' }
            });

            expect(callLogseq).toHaveBeenCalledWith(
                'logseq.Editor.renamePage',
                ['test page', 'New Name']
            );
        });

        it('returns 403 for viewer role', async () => {
            const res = await app.inject({
                method: 'PATCH',
                url: '/pages/test%20page',
                headers: { Authorization: `Bearer ${viewerToken}` },
                payload: { name: 'New Name' }
            });
            expect(res.statusCode).toBe(403);
        });

        it('returns 400 when new name is missing', async () => {
            const res = await app.inject({
                method: 'PATCH',
                url: '/pages/test%20page',
                headers: { Authorization: `Bearer ${editorToken}` },
                payload: {}
            });
            expect(res.statusCode).toBe(400);
        });
    });

    // ── DELETE /pages/:name ─────────────────────────────────────────────────

    describe('DELETE /pages/:name', () => {
        it('returns 204 on success', async () => {
            callLogseq.mockResolvedValueOnce(true);

            const res = await app.inject({
                method: 'DELETE',
                url: '/pages/test%20page',
                headers: { Authorization: `Bearer ${editorToken}` }
            });

            expect(res.statusCode).toBe(204);
        });

        it('calls deletePage with the decoded page name', async () => {
            callLogseq.mockResolvedValueOnce(true);

            await app.inject({
                method: 'DELETE',
                url: '/pages/test%20page',
                headers: { Authorization: `Bearer ${editorToken}` }
            });

            expect(callLogseq).toHaveBeenCalledWith(
                'logseq.Editor.deletePage',
                ['test page']
            );
        });

        it('returns 403 for viewer role', async () => {
            const res = await app.inject({
                method: 'DELETE',
                url: '/pages/test%20page',
                headers: { Authorization: `Bearer ${viewerToken}` }
            });
            expect(res.statusCode).toBe(403);
        });
    });

    // ── POST /pages/:name/blocks ────────────────────────────────────────────

    describe('POST /pages/:name/blocks', () => {
        it('returns 201 with the appended block', async () => {
            callLogseq.mockResolvedValueOnce(MOCK_BLOCK);

            const res = await app.inject({
                method: 'POST',
                url: '/pages/test%20page/blocks',
                headers: { Authorization: `Bearer ${editorToken}` },
                payload: { content: 'Hello world' }
            });

            expect(res.statusCode).toBe(201);
            expect(JSON.parse(res.body).uuid).toBe(MOCK_BLOCK.uuid);
        });

        it('passes content and properties to Logseq', async () => {
            callLogseq.mockResolvedValueOnce(MOCK_BLOCK);

            await app.inject({
                method: 'POST',
                url: '/pages/test%20page/blocks',
                headers: { Authorization: `Bearer ${editorToken}` },
                payload: {
                    content: 'Hello world',
                    properties: { done: true }
                }
            });

            expect(callLogseq).toHaveBeenCalledWith(
                'logseq.Editor.appendBlockInPage',
                ['test page', 'Hello world', { properties: { done: true } }]
            );
        });

        it('returns 404 when page does not exist', async () => {
            callLogseq.mockResolvedValueOnce(null);

            const res = await app.inject({
                method: 'POST',
                url: '/pages/nonexistent/blocks',
                headers: { Authorization: `Bearer ${editorToken}` },
                payload: { content: 'Hello' }
            });

            expect(res.statusCode).toBe(404);
        });

        it('returns 403 for viewer role', async () => {
            const res = await app.inject({
                method: 'POST',
                url: '/pages/test%20page/blocks',
                headers: { Authorization: `Bearer ${viewerToken}` },
                payload: { content: 'Hello' }
            });
            expect(res.statusCode).toBe(403);
        });

        it('returns 400 when content is missing', async () => {
            const res = await app.inject({
                method: 'POST',
                url: '/pages/test%20page/blocks',
                headers: { Authorization: `Bearer ${editorToken}` },
                payload: {}
            });
            expect(res.statusCode).toBe(400);
        });
    });
});
