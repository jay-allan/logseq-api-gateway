import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import fs from 'fs';
import path from 'path';
import { Logger } from '../Logger';
import * as schema from './schema';

type DrizzleDb = BetterSQLite3Database<typeof schema>;

let sqlite: Database.Database | null = null;
let db: DrizzleDb | null = null;

export function getDb(): DrizzleDb {
    if (!db) {
        throw new Error('Database not initialised — call initDb() first');
    }
    return db;
}

/**
 * Initialises the database at `dbPath` and runs all pending Drizzle migrations
 * from `migrationsDir`.
 *
 * `migrationsDir` is supplied by the caller so the path resolves correctly
 * regardless of whether the code runs via tsc output, a Parcel bundle, or
 * ts-node (each places __dirname in a different location).
 */
export function initDb(dbPath: string, migrationsDir: string): void {
    const dir = path.dirname(dbPath);
    if (dir !== '.' && !fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    sqlite = new Database(dbPath);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');

    db = drizzle(sqlite, { schema });

    migrate(db, { migrationsFolder: migrationsDir });
    Logger.info(`Database initialised at ${dbPath}`);
}

export function closeDb(): void {
    if (sqlite) {
        sqlite.close();
        sqlite = null;
        db = null;
    }
}
