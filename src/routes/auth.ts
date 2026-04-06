import type { FastifyInstance } from 'fastify';
import {
    findUserWithHashByUsername
} from '../db/repositories/user.repository';
import {
    createRefreshToken,
    findRefreshToken,
    deleteRefreshToken
} from '../db/repositories/refresh-token.repository';
import { verifyPassword } from '../auth/password';
import {
    generateRefreshToken,
    hashRefreshToken,
    refreshTokenExpiry,
    buildJwtPayload
} from '../auth/jwt';
import { findUserById } from '../db/repositories/user.repository';

export default async function authRoute(app: FastifyInstance): Promise<void> {
    /**
     * POST /auth/login
     * Exchange username + password for an access token and a refresh token.
     */
    app.post(
        '/login',
        {
            schema: {
                tags: ['Auth'],
                operationId: 'login',
                summary: 'Login',
                description:
                    'Authenticates a user with username and password. ' +
                    'Returns a short-lived JWT access token and a long-lived refresh token.',
                body: {
                    type: 'object',
                    required: ['username', 'password'],
                    properties: {
                        username: {
                            type: 'string',
                            description: 'Account username'
                        },
                        password: {
                            type: 'string',
                            description: 'Account password'
                        }
                    }
                },
                security: [],
                response: {
                    200: { $ref: 'TokenPair#' },
                    400: {
                        description: 'Invalid request body',
                        $ref: 'ErrorResponse#'
                    },
                    401: {
                        description: 'Invalid credentials',
                        $ref: 'ErrorResponse#'
                    },
                    500: {
                        description: 'Internal server error',
                        $ref: 'ErrorResponse#'
                    }
                }
            }
        },
        async (request, reply) => {
            const { username, password } = request.body as {
                username: string;
                password: string;
            };

            const user = findUserWithHashByUsername(username);
            if (!user) {
                return reply.code(401).send({
                    error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' }
                });
            }

            const valid = await verifyPassword(password, user.passwordHash);
            if (!valid) {
                return reply.code(401).send({
                    error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' }
                });
            }

            const accessToken = app.jwt.sign(buildJwtPayload(user));

            const rawRefresh = generateRefreshToken();
            createRefreshToken({
                userId: user.id,
                tokenHash: hashRefreshToken(rawRefresh),
                expiresAt: refreshTokenExpiry()
            });

            return reply.code(200).send({
                accessToken,
                refreshToken: rawRefresh
            });
        }
    );

    /**
     * POST /auth/refresh
     * Exchange a valid refresh token for a new access token.
     */
    app.post(
        '/refresh',
        {
            schema: {
                tags: ['Auth'],
                operationId: 'refreshToken',
                summary: 'Refresh access token',
                description:
                    'Exchanges a valid refresh token for a new JWT access token. ' +
                    'The refresh token is rotated on each use.',
                body: {
                    type: 'object',
                    required: ['refreshToken'],
                    properties: {
                        refreshToken: {
                            type: 'string',
                            description: 'Refresh token obtained from POST /auth/login'
                        }
                    }
                },
                security: [],
                response: {
                    200: { $ref: 'TokenPair#' },
                    400: {
                        description: 'Invalid request body',
                        $ref: 'ErrorResponse#'
                    },
                    401: {
                        description: 'Invalid or expired refresh token',
                        $ref: 'ErrorResponse#'
                    },
                    500: {
                        description: 'Internal server error',
                        $ref: 'ErrorResponse#'
                    }
                }
            }
        },
        async (request, reply) => {
            const { refreshToken } = request.body as { refreshToken: string };

            const tokenHash = hashRefreshToken(refreshToken);
            const storedToken = findRefreshToken(tokenHash);

            if (!storedToken) {
                return reply.code(401).send({
                    error: {
                        code: 'UNAUTHORIZED',
                        message: 'Invalid or expired refresh token'
                    }
                });
            }

            const user = findUserById(storedToken.userId);
            if (!user || !user.isActive) {
                return reply.code(401).send({
                    error: { code: 'UNAUTHORIZED', message: 'Account not found or inactive' }
                });
            }

            // Rotate: delete old token, issue new pair
            deleteRefreshToken(tokenHash);

            const accessToken = app.jwt.sign(buildJwtPayload(user));

            const rawRefresh = generateRefreshToken();
            createRefreshToken({
                userId: user.id,
                tokenHash: hashRefreshToken(rawRefresh),
                expiresAt: refreshTokenExpiry()
            });

            return reply.code(200).send({
                accessToken,
                refreshToken: rawRefresh
            });
        }
    );
}
