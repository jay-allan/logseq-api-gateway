/**
 * Seed script: creates the initial admin user from environment variables.
 * Run with: npm run seed
 */
import 'dotenv/config';
import path from 'path';
import { initDb } from '../src/db/client';
import { createUser, findUserByUsername } from '../src/db/repositories/user.repository';
import { hashPassword } from '../src/auth/password';
import { config } from '../src/config';

async function seed(): Promise<void> {
    const { ADMIN_USERNAME, ADMIN_PASSWORD } = config;

    if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
        console.error(
            'ADMIN_USERNAME and ADMIN_PASSWORD must be set in your .env file'
        );
        process.exit(1);
    }

    initDb(config.DB_PATH, path.join(__dirname, '../src/db/migrations'));

    if (findUserByUsername(ADMIN_USERNAME)) {
        console.log(`Admin user '${ADMIN_USERNAME}' already exists — skipping`);
        return;
    }

    const passwordHash = await hashPassword(ADMIN_PASSWORD);
    const user = createUser({
        username: ADMIN_USERNAME,
        passwordHash,
        role: 'admin'
    });

    console.log(
        `Admin user created: id=${user.id} username=${user.username}`
    );
}

seed().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
});
