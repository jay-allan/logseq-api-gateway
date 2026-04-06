import type { PaginationMeta } from '../types/api';

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
