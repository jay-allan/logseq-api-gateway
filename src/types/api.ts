export type Role = 'admin' | 'editor' | 'viewer';

export interface User {
    id: string;
    username: string;
    email?: string;
    role: Role;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface JwtPayload {
    sub: string;
    username: string;
    role: Role;
    iat?: number;
    exp?: number;
}

export interface TokenPair {
    accessToken: string;
    refreshToken: string;
}

export interface ApiError {
    code: string;
    message: string;
    details?: unknown;
}

export interface ApiErrorResponse {
    error: ApiError;
}

export interface PaginationMeta {
    total: number;
    limit: number;
    offset: number;
}

export interface PaginatedResponse<T> {
    data: T[];
    meta: PaginationMeta;
}
