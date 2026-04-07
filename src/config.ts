import { z } from 'zod';
import { Logger } from './Logger';

// RFC 1918 / loopback / link-local patterns
const PRIVATE_HOST_RE =
    /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+|169\.254\.\d+\.\d+)$/i;

const configSchema = z.object({
    PORT: z.coerce.number().int().positive().default(3000),
    NODE_ENV: z
        .enum(['development', 'production', 'test'])
        .default('development'),

    // NIST SP 800-185: HMAC-SHA256 keys should be >= 256 bits (32 bytes)
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    JWT_REFRESH_SECRET: z
        .string()
        .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
    JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900),
    JWT_REFRESH_TTL: z.coerce.number().int().positive().default(604800),

    LOGSEQ_BASE_URL: z.string().url().default('http://localhost:12315'),
    LOGSEQ_TOKEN: z.string().min(1, 'LOGSEQ_TOKEN is required'),

    DB_PATH: z.string().default('./data/gateway.db'),

    ADMIN_USERNAME: z.string().optional(),
    ADMIN_PASSWORD: z.string().optional(),

    WRITE_QUEUE_MAX_DEPTH: z.coerce.number().int().positive().default(50),
    WRITE_QUEUE_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),

    // Auth endpoint rate limiting (independent of the global limit)
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
    AUTH_RATE_LIMIT_WINDOW: z.string().default('15 minutes'),

    // CORS — comma-separated list of allowed origins, '*', or unset (deny all)
    CORS_ORIGIN: z.string().optional(),

    // Set to 'false' to disable the Swagger UI at /docs in production
    SWAGGER_ENABLED: z
        .string()
        .optional()
        .transform((v) => v !== 'false')
});

export type Config = z.infer<typeof configSchema>;

function loadConfig(): Config {
    const result = configSchema.safeParse(process.env);
    if (!result.success) {
        const issues = result.error.issues
            .map((i) => `  ${i.path.join('.')}: ${i.message}`)
            .join('\n');
        throw new Error(`Invalid configuration:\n${issues}`);
    }

    const cfg = result.data;

    // Warn when LOGSEQ_BASE_URL points at a private/loopback/link-local host
    // in production. This is expected in development (localhost default) but
    // can indicate SSRF risk if misconfigured in a cloud environment.
    if (cfg.NODE_ENV === 'production') {
        try {
            const hostname = new URL(cfg.LOGSEQ_BASE_URL).hostname;
            if (PRIVATE_HOST_RE.test(hostname)) {
                Logger.warn(
                    `LOGSEQ_BASE_URL points at a private/loopback host ` +
                        `(${hostname}) in production. ` +
                        `Ensure this is intentional and not an SSRF misconfiguration.`
                );
            }
        } catch {
            // URL is already validated by Zod; this branch is unreachable
        }
    }

    return cfg;
}

export const config: Config = loadConfig();
