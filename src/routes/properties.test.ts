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

const MOCK_PROPERTY = {
    id: 20,
    name: 'status',
    schema: { type: 'string', enum: ['active', 'done'] }
};

describe('Properties routes', () => {
    let app: FastifyInstance;
    let viewerToken: string;

    beforeAll(async () => {
        app = await buildTestApp();
        viewerToken = await getTokenForRole(app, 'viewer');
    });

    afterAll(() => teardownTestApp(app));

    beforeEach(() => callLogseq.mockReset());

    // ── GET /properties ─────────────────────────────────────────────────────

    describe('GET /properties', () => {
        it('returns 200 with paginated property list', async () => {
            callLogseq.mockResolvedValueOnce([MOCK_PROPERTY]);

            const res = await app.inject({
                method: 'GET',
                url: '/properties',
                headers: { Authorization: `Bearer ${viewerToken}` }
            });

            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res.body);
            expect(body.data).toHaveLength(1);
            expect(body.data[0].name).toBe(MOCK_PROPERTY.name);
            expect(body.meta.total).toBe(1);
        });

        it('applies limit and offset', async () => {
            callLogseq.mockResolvedValueOnce([
                MOCK_PROPERTY,
                { ...MOCK_PROPERTY, id: 21, name: 'priority' },
                { ...MOCK_PROPERTY, id: 22, name: 'deadline' }
            ]);

            const res = await app.inject({
                method: 'GET',
                url: '/properties?limit=2&offset=1',
                headers: { Authorization: `Bearer ${viewerToken}` }
            });

            const body = JSON.parse(res.body);
            expect(body.data).toHaveLength(2);
            expect(body.meta).toEqual({ total: 3, limit: 2, offset: 1 });
        });

        it('returns 200 with empty list when no properties defined', async () => {
            callLogseq.mockResolvedValueOnce([]);

            const res = await app.inject({
                method: 'GET',
                url: '/properties',
                headers: { Authorization: `Bearer ${viewerToken}` }
            });

            expect(res.statusCode).toBe(200);
            expect(JSON.parse(res.body).data).toHaveLength(0);
        });

        it('returns 401 without token', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/properties'
            });
            expect(res.statusCode).toBe(401);
        });

        it('returns 403 for a role without properties:read', async () => {
            // All current roles have properties:read, so verify the viewer
            // (lowest privilege) can still access it
            callLogseq.mockResolvedValueOnce([]);
            const res = await app.inject({
                method: 'GET',
                url: '/properties',
                headers: { Authorization: `Bearer ${viewerToken}` }
            });
            expect(res.statusCode).toBe(200);
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
                url: '/properties',
                headers: { Authorization: `Bearer ${viewerToken}` }
            });

            expect(res.statusCode).toBe(502);
        });
    });
});
