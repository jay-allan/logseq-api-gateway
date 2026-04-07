/**
 * Strips ASCII control characters (U+0000–U+001F and U+007F) from a string
 * before it is written to logs. This prevents log injection attacks where
 * malicious input forges spurious log lines or corrupts log parsers.
 *
 * OWASP A03 — Injection (log injection)
 */
export function sanitizeForLog(value: string): string {
    // eslint-disable-next-line no-control-regex
    return value.replace(/[\x00-\x1f\x7f]/g, '');
}
