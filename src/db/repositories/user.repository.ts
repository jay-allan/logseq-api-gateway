import { and, count, desc, eq, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../client';
import { users } from '../schema';
import type { Role, User } from '../../types/api';
import type { InferSelectModel } from 'drizzle-orm';

type UserRow = InferSelectModel<typeof users>;

/**
 * Maps a Drizzle row to the public User shape.
 * Converts `email: string | null` → `email?: string` and is the single
 * point where the DB representation meets the API type contract.
 */
function toUser(row: UserRow): User {
    return {
        id: row.id,
        username: row.username,
        email: row.email ?? undefined,
        role: row.role,
        isActive: row.isActive,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
    };
}

export function findUserById(id: string): User | null {
    const row = getDb()
        .select()
        .from(users)
        .where(eq(users.id, id))
        .get();
    return row ? toUser(row) : null;
}

export function findUserByUsername(username: string): User | null {
    const row = getDb()
        .select()
        .from(users)
        .where(and(eq(users.username, username), eq(users.isActive, true)))
        .get();
    return row ? toUser(row) : null;
}

/**
 * Returns the user together with the password hash for authentication.
 * The hash is intentionally excluded from the public `User` type and from
 * all other repository functions.
 */
export function findUserWithHashByUsername(
    username: string
): (User & { passwordHash: string }) | null {
    const row = getDb()
        .select()
        .from(users)
        .where(and(eq(users.username, username), eq(users.isActive, true)))
        .get();
    if (!row) return null;
    return { ...toUser(row), passwordHash: row.passwordHash };
}

export function listUsers(): User[] {
    return getDb()
        .select()
        .from(users)
        .orderBy(desc(users.createdAt))
        .all()
        .map(toUser);
}

export function createUser(input: {
    username: string;
    email?: string;
    passwordHash: string;
    role: Role;
}): User {
    const id = uuidv4();
    getDb()
        .insert(users)
        .values({
            id,
            username: input.username,
            email: input.email ?? null,
            passwordHash: input.passwordHash,
            role: input.role
        })
        .run();
    return findUserById(id) as User;
}

export function updateUser(
    id: string,
    input: Partial<{
        email: string | null;
        passwordHash: string;
        role: Role;
        isActive: boolean;
    }>
): User | null {
    // Build only the columns that were explicitly provided.
    // `updatedAt` is always stamped with the DB clock via a SQL expression.
    // Record<string, unknown> is intentional: Drizzle's .set() accepts SQL
    // expressions alongside regular values, but the $inferInsert type only
    // knows about plain values.  External type safety comes from `input`.
    const patch: Record<string, unknown> = {
        updatedAt: sql`(datetime('now'))`
    };

    if (input.email !== undefined) patch.email = input.email;
    if (input.passwordHash !== undefined) patch.passwordHash = input.passwordHash;
    if (input.role !== undefined) patch.role = input.role;
    if (input.isActive !== undefined) patch.isActive = input.isActive;

    getDb()
        .update(users)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .set(patch as any)
        .where(eq(users.id, id))
        .run();

    return findUserById(id);
}

export function deleteUser(id: string): void {
    getDb().delete(users).where(eq(users.id, id)).run();
}

export function countActiveAdmins(): number {
    const row = getDb()
        .select({ n: count() })
        .from(users)
        .where(and(eq(users.role, 'admin'), eq(users.isActive, true)))
        .get();
    return row?.n ?? 0;
}
