import { config } from '../config';
import { Logger } from '../Logger';
import { WRITE_METHODS } from './methods';
import { enqueueWrite } from '../write-queue';

const API_URL = `${config.LOGSEQ_BASE_URL}/api`;

/**
 * Calls a Logseq API method.
 * Write methods are automatically routed through the write queue.
 */
export async function callLogseq<T = unknown>(
    method: string,
    args: unknown[] = []
): Promise<T> {
    if (WRITE_METHODS.has(method)) {
        return enqueueWrite(() => executeCall<T>(method, args));
    }
    return executeCall<T>(method, args);
}

async function executeCall<T>(method: string, args: unknown[]): Promise<T> {
    Logger.info(`Logseq call: ${method}`);

    let response: Response;
    try {
        response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${config.LOGSEQ_TOKEN}`
            },
            body: JSON.stringify({ method, args })
        });
    } catch (err) {
        throw Object.assign(
            new Error(`Logseq unreachable: ${(err as Error).message}`),
            { statusCode: 502, code: 'BAD_GATEWAY' }
        );
    }

    if (response.status === 401) {
        throw Object.assign(new Error('Logseq token rejected'), {
            statusCode: 502,
            code: 'BAD_GATEWAY'
        });
    }

    if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw Object.assign(
            new Error(`Logseq error ${response.status}: ${body}`),
            { statusCode: 502, code: 'BAD_GATEWAY' }
        );
    }

    const data = (await response.json()) as T;
    return data;
}

/**
 * Sends a lightweight probe to Logseq to check reachability.
 * Returns the error message if unreachable, or null if reachable.
 */
export async function probeLogseq(): Promise<string | null> {
    try {
        await executeCall('logseq.App.getCurrentGraph', []);
        return null;
    } catch (err) {
        return (err as Error).message ?? 'unknown error';
    }
}
