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

const MOCK_TAG = {
    id: 5,
    uuid: 'dddddddd-0000-0000-0000-000000000001',
    name: 'project',
    originalName: 'Project'
};

const MOCK_BLOCK = {
    uuid: 'bbbbbbbb-0000-0000-0000-000000000001',
    content: 'Tagged block',
    properties: {},
    format: 'markdown' as const
};

describe('Tags routes', () => {
    let app: FastifyInstance;
    let viewerToken: string;

    beforeAll(async () => {
        app = await buildTestApp();
        viewerToken = await getTokenForRole(app, 'viewer');
    });

    afterAll(() => teardownTestApp(app));

    beforeEach(() => callLogseq.mockReset());

    // ── GET /tags ───────────────────────────────────────────────────────────

    describe('GET /tags', () => {
        it('returns 200 with paginated tag list', async () => {
            callLogseq.mockResolvedValueOnce([MOCK_TAG]);

            const res = await app.inject({
                method: 'GET',
                url: '/tags',
                headers: { Authorization: `Bearer ${viewerToken}` }
            });

            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res.body);
            expect(body.data).toHaveLength(1);
            expect(body.data[0].name).toBe(MOCK_TAG.name);
            expect(body.meta.total).toBe(1);
        });

        it('applies limit and offset', async () => {
            callLogseq.mockResolvedValueOnce([
                MOCK_TAG,
                { ...MOCK_TAG, id: 6, name: 'area' },
                { ...MOCK_TAG, id: 7, name: 'resource' }
            ]);

            const res = await app.inject({
                method: 'GET',
                url: '/tags?limit=2&offset=0',
                headers: { Authorization: `Bearer ${viewerToken}` }
            });

            const body = JSON.parse(res.body);
            expect(body.data).toHaveLength(2);
            expect(body.meta).toEqual({ total: 3, limit: 2, offset: 0 });
        });

        it('returns 401 without token', async () => {
            const res = await app.inject({ method: 'GET', url: '/tags' });
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
                url: '/tags',
                headers: { Authorization: `Bearer ${viewerToken}` }
            });

            expect(res.statusCode).toBe(502);
        });
    });

    // ── GET /tags/:name/blocks ──────────────────────────────────────────────

    describe('GET /tags/:name/blocks', () => {
        it('returns 200 with blocks for the tag', async () => {
            callLogseq.mockResolvedValueOnce([MOCK_BLOCK]);

            const res = await app.inject({
                method: 'GET',
                url: '/tags/project/blocks',
                headers: { Authorization: `Bearer ${viewerToken}` }
            });

            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res.body);
            expect(body.data).toHaveLength(1);
            expect(body.data[0].uuid).toBe(MOCK_BLOCK.uuid);
        });

        it('returns 404 when tag does not exist', async () => {
            callLogseq.mockResolvedValueOnce(null);

            const res = await app.inject({
                method: 'GET',
                url: '/tags/nonexistent/blocks',
                headers: { Authorization: `Bearer ${viewerToken}` }
            });

            expect(res.statusCode).toBe(404);
        });

        it('returns 401 without token', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/tags/project/blocks'
            });
            expect(res.statusCode).toBe(401);
        });
    });
});
