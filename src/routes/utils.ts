import type { PaginationMeta } from '../types/api';

/**
 * Renames Logseq-internal page fields to clean REST names:
 *   originalName → name   (display name, user-facing case)
 *   name         → normalizedName  (lower-case, Logseq's internal identifier)
 *   journal      → isJournal
 *
 * All other fields pass through unchanged. Works on both Editor API responses
 * and on objects already processed by normalizeDatascriptEntity.
 */
export function normalizePageForApi(
    page: Record<string, unknown>
): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(page)) {
        if (key === 'originalName') {
            out['name'] = value;
        } else if (key === 'name') {
            out['normalizedName'] = value;
        } else if (key === 'journal') {
            out['isJournal'] = value;
        } else {
            out[key] = value;
        }
    }
    return out;
}

/**
 * Normalises a single entity returned by logseq.DB.datascriptQuery.
 * Datascript returns Clojure-style keys: kebab-case (`original-name`) and
 * predicate suffixes (`journal?`).  This converts them to camelCase so they
 * match the Editor API shape and the gateway's OpenAPI schemas.
 *
 * Already-camelCase keys pass through unchanged (safe to call on any object).
 */
export function normalizeDatascriptEntity(
    entity: Record<string, unknown>
): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(entity)) {
        const normalized = key
            .replace(/\?$/, '')
            .replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
        out[normalized] = value;
    }
    return out;
}

export interface Paginated<T> {
    data: T[];
    meta: PaginationMeta;
}

/**
 * Slices an in-memory array into a paginated response.
 * Logseq has no server-side pagination, so we paginate on the gateway side.
 */
export function paginate<T>(
    items: T[],
    limit: number,
    offset: number
): Paginated<T> {
    return {
        data: items.slice(offset, offset + limit),
        meta: { total: items.length, limit, offset }
    };
}

/** JSON Schema fragment reused on every list endpoint's querystring. */
export const paginationQuerySchema = {
    type: 'object',
    properties: {
        limit: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 50,
            description: 'Maximum number of items to return (1–100, default 50)'
        },
        offset: {
            type: 'integer',
            minimum: 0,
            default: 0,
            description: 'Zero-based index of the first item to return'
        }
    }
} as const;
