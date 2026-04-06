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

const BLOCK_UUID = 'bbbbbbbb-0000-0000-0000-000000000001';

const MOCK_BLOCK = {
    uuid: BLOCK_UUID,
    content: 'Hello world',
    properties: { foo: 'bar' },
    format: 'markdown' as const,
    page: { id: 1 }
};

describe('Blocks routes', () => {
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

    // ── GET /blocks/:uuid ───────────────────────────────────────────────────

    describe('GET /blocks/:uuid', () => {
        it('returns 200 with the block', async () => {
            callLogseq.mockResolvedValueOnce(MOCK_BLOCK);

            const res = await app.inject({
                method: 'GET',
                url: `/blocks/${BLOCK_UUID}`,
                headers: { Authorization: `Bearer ${viewerToken}` }
            });

            expect(res.statusCode).toBe(200);
            expect(JSON.parse(res.body).uuid).toBe(BLOCK_UUID);
        });

        it('passes includeChildren=true when children=true', async () => {
            callLogseq.mockResolvedValueOnce({
                ...MOCK_BLOCK,
                children: [{ uuid: 'child-uuid', content: 'child' }]
            });

            const res = await app.inject({
                method: 'GET',
                url: `/blocks/${BLOCK_UUID}?children=true`,
                headers: { Authorization: `Bearer ${viewerToken}` }
            });

            expect(res.statusCode).toBe(200);
            // Verify callLogseq was called with includeChildren option
            expect(callLogseq).toHaveBeenCalledWith(
                'logseq.Editor.getBlock',
                [BLOCK_UUID, { includeChildren: true }]
            );
        });

        it('returns 404 when Logseq returns null', async () => {
            callLogseq.mockResolvedValueOnce(null);

            const res = await app.inject({
                method: 'GET',
                url: `/blocks/${BLOCK_UUID}`,
                headers: { Authorization: `Bearer ${viewerToken}` }
            });

            expect(res.statusCode).toBe(404);
        });

        it('returns 401 without token', async () => {
            const res = await app.inject({
                method: 'GET',
                url: `/blocks/${BLOCK_UUID}`
            });
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
                url: `/blocks/${BLOCK_UUID}`,
                headers: { Authorization: `Bearer ${viewerToken}` }
            });

            expect(res.statusCode).toBe(502);
        });
    });

    // ── GET /blocks/:uuid/properties ────────────────────────────────────────

    describe('GET /blocks/:uuid/properties', () => {
        it('returns 200 with the properties object', async () => {
            callLogseq.mockResolvedValueOnce({ foo: 'bar', count: 42 });

            const res = await app.inject({
                method: 'GET',
                url: `/blocks/${BLOCK_UUID}/properties`,
                headers: { Authorization: `Bearer ${viewerToken}` }
            });

            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res.body);
            expect(body.properties).toEqual({ foo: 'bar', count: 42 });
        });

        it('returns 404 when Logseq returns null', async () => {
            callLogseq.mockResolvedValueOnce(null);

            const res = await app.inject({
                method: 'GET',
                url: `/blocks/${BLOCK_UUID}/properties`,
                headers: { Authorization: `Bearer ${viewerToken}` }
            });

            expect(res.statusCode).toBe(404);
        });

        it('returns 401 without token', async () => {
            const res = await app.inject({
                method: 'GET',
                url: `/blocks/${BLOCK_UUID}/properties`
            });
            expect(res.statusCode).toBe(401);
        });
    });

    // ── POST /blocks/:uuid/children ─────────────────────────────────────────

    describe('POST /blocks/:uuid/children', () => {
        it('returns 201 with the inserted child block', async () => {
            const child = { ...MOCK_BLOCK, uuid: 'child-uuid-001' };
            callLogseq.mockResolvedValueOnce(child);

            const res = await app.inject({
                method: 'POST',
                url: `/blocks/${BLOCK_UUID}/children`,
                headers: { Authorization: `Bearer ${editorToken}` },
                payload: { content: 'Child block' }
            });

            expect(res.statusCode).toBe(201);
            expect(JSON.parse(res.body).uuid).toBe(child.uuid);
        });

        it('calls insertBlock with sibling=false', async () => {
            callLogseq.mockResolvedValueOnce(MOCK_BLOCK);

            await app.inject({
                method: 'POST',
                url: `/blocks/${BLOCK_UUID}/children`,
                headers: { Authorization: `Bearer ${editorToken}` },
                payload: { content: 'Child block' }
            });

            expect(callLogseq).toHaveBeenCalledWith(
                'logseq.Editor.insertBlock',
                [BLOCK_UUID, 'Child block', { sibling: false }]
            );
        });

        it('returns 404 when parent block not found', async () => {
            callLogseq.mockResolvedValueOnce(null);

            const res = await app.inject({
                method: 'POST',
                url: `/blocks/${BLOCK_UUID}/children`,
                headers: { Authorization: `Bearer ${editorToken}` },
                payload: { content: 'Child block' }
            });

            expect(res.statusCode).toBe(404);
        });

        it('returns 403 for viewer role', async () => {
            const res = await app.inject({
                method: 'POST',
                url: `/blocks/${BLOCK_UUID}/children`,
                headers: { Authorization: `Bearer ${viewerToken}` },
                payload: { content: 'Child block' }
            });
            expect(res.statusCode).toBe(403);
        });
    });

    // ── POST /blocks/:uuid/siblings ─────────────────────────────────────────

    describe('POST /blocks/:uuid/siblings', () => {
        it('returns 201 with the inserted sibling block', async () => {
            const sibling = { ...MOCK_BLOCK, uuid: 'sibling-uuid-001' };
            callLogseq.mockResolvedValueOnce(sibling);

            const res = await app.inject({
                method: 'POST',
                url: `/blocks/${BLOCK_UUID}/siblings`,
                headers: { Authorization: `Bearer ${editorToken}` },
                payload: { content: 'Sibling block' }
            });

            expect(res.statusCode).toBe(201);
            expect(JSON.parse(res.body).uuid).toBe(sibling.uuid);
        });

        it('calls insertBlock with sibling=true', async () => {
            callLogseq.mockResolvedValueOnce(MOCK_BLOCK);

            await app.inject({
                method: 'POST',
                url: `/blocks/${BLOCK_UUID}/siblings`,
                headers: { Authorization: `Bearer ${editorToken}` },
                payload: { content: 'Sibling block', before: true }
            });

            expect(callLogseq).toHaveBeenCalledWith(
                'logseq.Editor.insertBlock',
                [BLOCK_UUID, 'Sibling block', { sibling: true, before: true }]
            );
        });

        it('returns 404 when reference block not found', async () => {
            callLogseq.mockResolvedValueOnce(null);

            const res = await app.inject({
                method: 'POST',
                url: `/blocks/${BLOCK_UUID}/siblings`,
                headers: { Authorization: `Bearer ${editorToken}` },
                payload: { content: 'Sibling block' }
            });

            expect(res.statusCode).toBe(404);
        });
    });

    // ── POST /blocks/:uuid/batch ────────────────────────────────────────────

    describe('POST /blocks/:uuid/batch', () => {
        it('returns 201 with the inserted blocks', async () => {
            const inserted = [MOCK_BLOCK, { ...MOCK_BLOCK, uuid: 'batch-2' }];
            callLogseq.mockResolvedValueOnce(inserted);

            const res = await app.inject({
                method: 'POST',
                url: `/blocks/${BLOCK_UUID}/batch`,
                headers: { Authorization: `Bearer ${editorToken}` },
                payload: {
                    blocks: [
                        { content: 'Block 1' },
                        { content: 'Block 2' }
                    ]
                }
            });

            expect(res.statusCode).toBe(201);
            expect(JSON.parse(res.body).data).toHaveLength(2);
        });

        it('returns 404 when parent block not found', async () => {
            callLogseq.mockResolvedValueOnce(null);

            const res = await app.inject({
                method: 'POST',
                url: `/blocks/${BLOCK_UUID}/batch`,
                headers: { Authorization: `Bearer ${editorToken}` },
                payload: { blocks: [{ content: 'Block 1' }] }
            });

            expect(res.statusCode).toBe(404);
        });

        it('returns 403 for viewer role', async () => {
            const res = await app.inject({
                method: 'POST',
                url: `/blocks/${BLOCK_UUID}/batch`,
                headers: { Authorization: `Bearer ${viewerToken}` },
                payload: { blocks: [{ content: 'Block 1' }] }
            });
            expect(res.statusCode).toBe(403);
        });
    });

    // ── PATCH /blocks/:uuid ─────────────────────────────────────────────────

    describe('PATCH /blocks/:uuid', () => {
        it('returns 204 on success', async () => {
            callLogseq.mockResolvedValueOnce(undefined);

            const res = await app.inject({
                method: 'PATCH',
                url: `/blocks/${BLOCK_UUID}`,
                headers: { Authorization: `Bearer ${editorToken}` },
                payload: { content: 'Updated content' }
            });

            expect(res.statusCode).toBe(204);
        });

        it('calls updateBlock with correct args', async () => {
            callLogseq.mockResolvedValueOnce(undefined);

            await app.inject({
                method: 'PATCH',
                url: `/blocks/${BLOCK_UUID}`,
                headers: { Authorization: `Bearer ${editorToken}` },
                payload: { content: 'Updated content' }
            });

            expect(callLogseq).toHaveBeenCalledWith(
                'logseq.Editor.updateBlock',
                [BLOCK_UUID, 'Updated content', {}]
            );
        });

        it('returns 403 for viewer role', async () => {
            const res = await app.inject({
                method: 'PATCH',
                url: `/blocks/${BLOCK_UUID}`,
                headers: { Authorization: `Bearer ${viewerToken}` },
                payload: { content: 'Updated' }
            });
            expect(res.statusCode).toBe(403);
        });

        it('returns 400 when content is missing', async () => {
            const res = await app.inject({
                method: 'PATCH',
                url: `/blocks/${BLOCK_UUID}`,
                headers: { Authorization: `Bearer ${editorToken}` },
                payload: {}
            });
            expect(res.statusCode).toBe(400);
        });
    });

    // ── PATCH /blocks/:uuid/properties ──────────────────────────────────────

    describe('PATCH /blocks/:uuid/properties', () => {
        it('returns 204 on success', async () => {
            callLogseq.mockResolvedValueOnce(undefined);

            const res = await app.inject({
                method: 'PATCH',
                url: `/blocks/${BLOCK_UUID}/properties`,
                headers: { Authorization: `Bearer ${editorToken}` },
                payload: { key: 'status', value: 'done' }
            });

            expect(res.statusCode).toBe(204);
        });

        it('calls upsertBlockProperty with correct args', async () => {
            callLogseq.mockResolvedValueOnce(undefined);

            await app.inject({
                method: 'PATCH',
                url: `/blocks/${BLOCK_UUID}/properties`,
                headers: { Authorization: `Bearer ${editorToken}` },
                payload: { key: 'status', value: 'done' }
            });

            expect(callLogseq).toHaveBeenCalledWith(
                'logseq.Editor.upsertBlockProperty',
                [BLOCK_UUID, 'status', 'done']
            );
        });

        it('returns 403 for viewer role', async () => {
            const res = await app.inject({
                method: 'PATCH',
                url: `/blocks/${BLOCK_UUID}/properties`,
                headers: { Authorization: `Bearer ${viewerToken}` },
                payload: { key: 'status', value: 'done' }
            });
            expect(res.statusCode).toBe(403);
        });
    });

    // ── DELETE /blocks/:uuid/properties/:key ────────────────────────────────

    describe('DELETE /blocks/:uuid/properties/:key', () => {
        it('returns 204 on success', async () => {
            callLogseq.mockResolvedValueOnce(undefined);

            const res = await app.inject({
                method: 'DELETE',
                url: `/blocks/${BLOCK_UUID}/properties/status`,
                headers: { Authorization: `Bearer ${editorToken}` }
            });

            expect(res.statusCode).toBe(204);
        });

        it('calls removeBlockProperty with correct args', async () => {
            callLogseq.mockResolvedValueOnce(undefined);

            await app.inject({
                method: 'DELETE',
                url: `/blocks/${BLOCK_UUID}/properties/status`,
                headers: { Authorization: `Bearer ${editorToken}` }
            });

            expect(callLogseq).toHaveBeenCalledWith(
                'logseq.Editor.removeBlockProperty',
                [BLOCK_UUID, 'status']
            );
        });

        it('returns 403 for viewer role', async () => {
            const res = await app.inject({
                method: 'DELETE',
                url: `/blocks/${BLOCK_UUID}/properties/status`,
                headers: { Authorization: `Bearer ${viewerToken}` }
            });
            expect(res.statusCode).toBe(403);
        });
    });

    // ── POST /blocks/:uuid/move ─────────────────────────────────────────────

    describe('POST /blocks/:uuid/move', () => {
        const TARGET_UUID = 'cccccccc-0000-0000-0000-000000000001';

        it('returns 204 on success', async () => {
            callLogseq.mockResolvedValueOnce(undefined);

            const res = await app.inject({
                method: 'POST',
                url: `/blocks/${BLOCK_UUID}/move`,
                headers: { Authorization: `Bearer ${editorToken}` },
                payload: { targetUuid: TARGET_UUID }
            });

            expect(res.statusCode).toBe(204);
        });

        it('calls moveBlock with correct args', async () => {
            callLogseq.mockResolvedValueOnce(undefined);

            await app.inject({
                method: 'POST',
                url: `/blocks/${BLOCK_UUID}/move`,
                headers: { Authorization: `Bearer ${editorToken}` },
                payload: { targetUuid: TARGET_UUID, before: true }
            });

            expect(callLogseq).toHaveBeenCalledWith(
                'logseq.Editor.moveBlock',
                [BLOCK_UUID, TARGET_UUID, { before: true }]
            );
        });

        it('returns 403 for viewer role', async () => {
            const res = await app.inject({
                method: 'POST',
                url: `/blocks/${BLOCK_UUID}/move`,
                headers: { Authorization: `Bearer ${viewerToken}` },
                payload: { targetUuid: TARGET_UUID }
            });
            expect(res.statusCode).toBe(403);
        });
    });

    // ── DELETE /blocks/:uuid ────────────────────────────────────────────────

    describe('DELETE /blocks/:uuid', () => {
        it('returns 501 Not Implemented', async () => {
            const res = await app.inject({
                method: 'DELETE',
                url: `/blocks/${BLOCK_UUID}`,
                headers: { Authorization: `Bearer ${editorToken}` }
            });

            expect(res.statusCode).toBe(501);
        });

        it('returns 401 without token', async () => {
            const res = await app.inject({
                method: 'DELETE',
                url: `/blocks/${BLOCK_UUID}`
            });
            expect(res.statusCode).toBe(401);
        });
    });
});
