import { z } from 'zod';

const configSchema = z.object({
    PORT: z.coerce.number().int().positive().default(3000),
    NODE_ENV: z
        .enum(['development', 'production', 'test'])
        .default('development'),

    JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
    JWT_REFRESH_SECRET: z
        .string()
        .min(16, 'JWT_REFRESH_SECRET must be at least 16 characters'),
    JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900),
    JWT_REFRESH_TTL: z.coerce.number().int().positive().default(604800),

    LOGSEQ_BASE_URL: z.string().url().default('http://localhost:12315'),
    LOGSEQ_TOKEN: z.string().min(1, 'LOGSEQ_TOKEN is required'),

    DB_PATH: z.string().default('./data/gateway.db'),

    ADMIN_USERNAME: z.string().optional(),
    ADMIN_PASSWORD: z.string().optional(),

    WRITE_QUEUE_MAX_DEPTH: z.coerce.number().int().positive().default(50),
    WRITE_QUEUE_TIMEOUT_MS: z.coerce.number().int().positive().default(30000)
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
    return result.data;
}

export const config: Config = loadConfig();
