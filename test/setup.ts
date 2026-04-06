/**
 * Jest setupFiles — runs before each test file, before any module imports.
 * Sets the environment variables that src/config.ts reads at import time.
 */
process.env.NODE_ENV = 'test';
process.env.PORT = '3000';
process.env.JWT_SECRET = 'test-jwt-secret-that-is-long-enough-32ch';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-long-enough-32ch';
process.env.JWT_ACCESS_TTL = '900';
process.env.JWT_REFRESH_TTL = '604800';
process.env.LOGSEQ_BASE_URL = 'http://localhost:12315';
process.env.LOGSEQ_TOKEN = 'test-token';
process.env.DB_PATH = ':memory:';
process.env.WRITE_QUEUE_MAX_DEPTH = '50';
process.env.WRITE_QUEUE_TIMEOUT_MS = '5000';
