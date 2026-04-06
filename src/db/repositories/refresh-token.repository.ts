import { and, eq, gt, lte, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../client';
import { refreshTokens } from '../schema';
import type { InferSelectModel } from 'drizzle-orm';

export type RefreshTokenRow = InferSelectModel<typeof refreshTokens>;

export function createRefreshToken(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
}): string {
    const id = uuidv4();
    getDb()
        .insert(refreshTokens)
        .values({
            id,
            userId: input.userId,
            tokenHash: input.tokenHash,
            expiresAt: input.expiresAt.toISOString()
        })
        .run();
    return id;
}

/**
 * Returns a refresh token row only if the token exists and has not expired.
 * Expiry is evaluated against the database clock to avoid clock-skew issues.
 */
export function findRefreshToken(tokenHash: string): RefreshTokenRow | null {
    return (
        getDb()
            .select()
            .from(refreshTokens)
            .where(
                and(
                    eq(refreshTokens.tokenHash, tokenHash),
                    gt(refreshTokens.expiresAt, sql`datetime('now')`)
                )
            )
            .get() ?? null
    );
}

export function deleteRefreshToken(tokenHash: string): void {
    getDb()
        .delete(refreshTokens)
        .where(eq(refreshTokens.tokenHash, tokenHash))
        .run();
}

/** Purges expired tokens and returns the number of rows deleted. */
export function deleteExpiredTokens(): number {
    const result = getDb()
        .delete(refreshTokens)
        .where(lte(refreshTokens.expiresAt, sql`datetime('now')`))
        .run();
    return result.changes;
}

export function deleteAllUserTokens(userId: string): void {
    getDb()
        .delete(refreshTokens)
        .where(eq(refreshTokens.userId, userId))
        .run();
}
