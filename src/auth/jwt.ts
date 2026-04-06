import crypto from 'crypto';
import { config } from '../config';
import type { JwtPayload } from '../types/api';

/**
 * Generates a cryptographically random opaque refresh token string.
 * The raw value is stored client-side; a hash is stored in the DB.
 */
export function generateRefreshToken(): string {
    return crypto.randomBytes(64).toString('hex');
}

/**
 * Hashes a refresh token for safe DB storage.
 */
export function hashRefreshToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Computes the expiry Date for a refresh token.
 */
export function refreshTokenExpiry(): Date {
    return new Date(Date.now() + config.JWT_REFRESH_TTL * 1000);
}

/**
 * Builds the JWT payload for a user. The actual signing is handled by
 * @fastify/jwt on the Fastify instance, so this just shapes the payload.
 */
export function buildJwtPayload(user: {
    id: string;
    username: string;
    role: JwtPayload['role'];
}): Omit<JwtPayload, 'iat' | 'exp'> {
    return {
        sub: user.id,
        username: user.username,
        role: user.role
    };
}
