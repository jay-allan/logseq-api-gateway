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

const MOCK_JOURNAL_PAGE = {
    id: 10,
    uuid: 'cccccccc-0000-0000-0000-000000000001',
    name: 'jan 5th, 2024',
    originalName: 'Jan 5th, 2024',
    properties: {},
    journal: true,
    journalDay: 20240105,
    createdAt: 1704412800000,
    updatedAt: 1704412800000
};

describe('Journals routes', () => {
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

    // ── GET /journals ───────────────────────────────────────────────────────

    describe('GET /journals', () => {
        it('returns 200 with paginated journal pages', async () => {
            // datascriptQuery returns [[page], [page], ...] format
            callLogseq.mockResolvedValueOnce([
                [MOCK_JOURNAL_PAGE],
                [{ ...MOCK_JOURNAL_PAGE, id: 11, journalDay: 20240106 }]
            ]);

            const res = await app.inject({
                method: 'GET',
                url: '/journals',
                headers: { Authorization: `Bearer ${viewerToken}` }
            });

            expect(res.statusCode).toBe(200);
            const body = JSON.parse(res.body);
            expect(body.data).toHaveLength(2);
            expect(body.meta.total).toBe(2);
        });

        it('applies limit and offset', async () => {
            const pages = Array.from({ length: 5 }, (_, i) => [
                { ...MOCK_JOURNAL_PAGE, id: i + 1, journalDay: 20240100 + i + 1 }
            ]);
            callLogseq.mockResolvedValueOnce(pages);

            const res = await app.inject({
                method: 'GET',
                url: '/journals?limit=2&offset=1',
                headers: { Authorization: `Bearer ${viewerToken}` }
            });

            const body = JSON.parse(res.body);
            expect(body.data).toHaveLength(2);
            expect(body.meta).toEqual({ total: 5, limit: 2, offset: 1 });
        });

        it('returns 200 with empty list when no journals exist', async () => {
            callLogseq.mockResolvedValueOnce([]);

            const res = await app.inject({
                method: 'GET',
                url: '/journals',
                headers: { Authorization: `Bearer ${viewerToken}` }
            });

            expect(res.statusCode).toBe(200);
            expect(JSON.parse(res.body).data).toHaveLength(0);
        });

        it('returns 401 without token', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/journals'
            });
            expect(res.statusCode).toBe(401);
        });
    });

    // ── GET /journals/:date ─────────────────────────────────────────────────

    describe('GET /journals/:date', () => {
        it('returns 200 with the journal page', async () => {
            // datascriptQuery returns [[page]] for a single result
            callLogseq.mockResolvedValueOnce([[MOCK_JOURNAL_PAGE]]);

            const res = await app.inject({
                method: 'GET',
                url: '/journals/2024-01-05',
                headers: { Authorization: `Bearer ${viewerToken}` }
            });

            expect(res.statusCode).toBe(200);
            expect(JSON.parse(res.body).uuid).toBe(MOCK_JOURNAL_PAGE.uuid);
        });

        it('passes the correct journalDay integer to Logseq', async () => {
            callLogseq.mockResolvedValueOnce([[MOCK_JOURNAL_PAGE]]);

            await app.inject({
                method: 'GET',
                url: '/journals/2024-01-05',
                headers: { Authorization: `Bearer ${viewerToken}` }
            });

            expect(callLogseq).toHaveBeenCalledWith(
                'logseq.DB.datascriptQuery',
                expect.arrayContaining([
                    expect.stringContaining('20240105')
                ])
            );
        });

        it('returns 404 when no journal exists for the date', async () => {
            callLogseq.mockResolvedValueOnce([]);

            const res = await app.inject({
                method: 'GET',
                url: '/journals/2024-01-05',
                headers: { Authorization: `Bearer ${viewerToken}` }
            });

            expect(res.statusCode).toBe(404);
        });

        it('returns 400 for an invalid date format', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/journals/not-a-date',
                headers: { Authorization: `Bearer ${viewerToken}` }
            });

            expect(res.statusCode).toBe(400);
        });

        it('returns 401 without token', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/journals/2024-01-05'
            });
            expect(res.statusCode).toBe(401);
        });
    });

    // ── POST /journals/:date ────────────────────────────────────────────────

    describe('POST /journals/:date', () => {
        it('returns 201 with the journal page', async () => {
            callLogseq.mockResolvedValueOnce(MOCK_JOURNAL_PAGE);

            const res = await app.inject({
                method: 'POST',
                url: '/journals/2024-01-05',
                headers: { Authorization: `Bearer ${editorToken}` }
            });

            expect(res.statusCode).toBe(201);
            expect(JSON.parse(res.body).uuid).toBe(MOCK_JOURNAL_PAGE.uuid);
        });

        it('calls createJournalPage with the YYYYMMDD integer', async () => {
            callLogseq.mockResolvedValueOnce(MOCK_JOURNAL_PAGE);

            await app.inject({
                method: 'POST',
                url: '/journals/2024-01-05',
                headers: { Authorization: `Bearer ${editorToken}` }
            });

            expect(callLogseq).toHaveBeenCalledWith(
                'logseq.Editor.createJournalPage',
                [20240105]
            );
        });

        it('returns 404 when Logseq returns null', async () => {
            callLogseq.mockResolvedValueOnce(null);

            const res = await app.inject({
                method: 'POST',
                url: '/journals/2024-01-05',
                headers: { Authorization: `Bearer ${editorToken}` }
            });

            expect(res.statusCode).toBe(404);
        });

        it('returns 400 for an invalid date format', async () => {
            const res = await app.inject({
                method: 'POST',
                url: '/journals/not-a-date',
                headers: { Authorization: `Bearer ${editorToken}` }
            });

            expect(res.statusCode).toBe(400);
        });

        it('returns 403 for viewer role', async () => {
            const res = await app.inject({
                method: 'POST',
                url: '/journals/2024-01-05',
                headers: { Authorization: `Bearer ${viewerToken}` }
            });
            expect(res.statusCode).toBe(403);
        });

        it('returns 401 without token', async () => {
            const res = await app.inject({
                method: 'POST',
                url: '/journals/2024-01-05'
            });
            expect(res.statusCode).toBe(401);
        });
    });
});
