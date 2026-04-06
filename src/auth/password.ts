import bcrypt from 'bcryptjs';

// Use low rounds in test to keep the suite fast; 12 rounds in production.
const SALT_ROUNDS = process.env.NODE_ENV === 'test' ? 4 : 12;

export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
    password: string,
    hash: string
): Promise<boolean> {
    return bcrypt.compare(password, hash);
}
