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

/**
 * Returns a bcrypt hash of a fixed sentinel value, computed once and cached.
 *
 * Used by the login handler to perform a constant-time dummy password check
 * when a username does not exist, so that an attacker cannot distinguish
 * "username not found" (0 ms) from "wrong password" (~bcrypt time) by
 * measuring response latency.
 *
 * The hash is computed lazily on the first call, using the same SALT_ROUNDS
 * as all other hashes in this process, so the dummy compare takes the same
 * wall-clock time as a real one.
 */
let _sentinelHash: Promise<string> | null = null;

export function getSentinelHash(): Promise<string> {
    if (!_sentinelHash) {
        _sentinelHash = hashPassword('__logseq-gateway-timing-sentinel__');
    }
    return _sentinelHash;
}
