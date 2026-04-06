import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * The `role` column uses a TypeScript enum type rather than a SQLite CHECK
 * constraint, because Drizzle's SQLite dialect does not emit CHECK constraints
 * for enum columns. Application-level enforcement (Fastify AJV validation and
 * the `Role` TypeScript type) provides the equivalent safety guarantee.
 */
export const users = sqliteTable('users', {
    id: text('id').primaryKey(),
    username: text('username').notNull().unique(),
    email: text('email').unique(),
    passwordHash: text('password_hash').notNull(),
    role: text('role', { enum: ['admin', 'editor', 'viewer'] })
        .notNull()
        .default('viewer'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at')
        .notNull()
        .default(sql`(datetime('now'))`),
    updatedAt: text('updated_at')
        .notNull()
        .default(sql`(datetime('now'))`)
});

export const refreshTokens = sqliteTable(
    'refresh_tokens',
    {
        id: text('id').primaryKey(),
        userId: text('user_id')
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        tokenHash: text('token_hash').notNull().unique(),
        expiresAt: text('expires_at').notNull(),
        createdAt: text('created_at')
            .notNull()
            .default(sql`(datetime('now'))`)
    },
    (table) => [
        index('idx_refresh_tokens_user_id').on(table.userId),
        index('idx_refresh_tokens_expires_at').on(table.expiresAt)
    ]
);
