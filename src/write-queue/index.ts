import { Mutex } from 'async-mutex';
import { config } from '../config';
import { Logger } from '../Logger';

const mutex = new Mutex();
let pendingDepth = 0;

/**
 * Enqueues a write operation so that only one write executes at a time.
 * Returns HTTP 503 (via thrown error) when the queue is full.
 * Times out after `timeoutMs` milliseconds if the operation hangs.
 */
export async function enqueueWrite<T>(
    operation: () => Promise<T>,
    timeoutMs: number = config.WRITE_QUEUE_TIMEOUT_MS
): Promise<T> {
    if (pendingDepth >= config.WRITE_QUEUE_MAX_DEPTH) {
        const err = Object.assign(
            new Error('Write queue is full — try again later'),
            { statusCode: 503, code: 'SERVICE_UNAVAILABLE', retryAfter: 5 }
        );
        throw err;
    }

    pendingDepth++;
    Logger.info(
        `Write enqueued (pending: ${pendingDepth} / max: ${config.WRITE_QUEUE_MAX_DEPTH})`
    );

    const release = await mutex.acquire();
    pendingDepth--;

    const timer = setTimeout(() => {
        release();
    }, timeoutMs);

    try {
        const result = await Promise.race([
            operation(),
            new Promise<never>((_, reject) =>
                setTimeout(
                    () =>
                        reject(
                            Object.assign(new Error('Write operation timed out'), {
                                statusCode: 503,
                                code: 'SERVICE_UNAVAILABLE'
                            })
                        ),
                    timeoutMs
                )
            )
        ]);
        return result;
    } finally {
        clearTimeout(timer);
        release();
    }
}

/** Returns the number of write operations currently waiting to acquire the lock. */
export function getQueueDepth(): number {
    return pendingDepth;
}

/**
 * Resolves once the write queue is fully drained — i.e. no operations are
 * waiting and the mutex is not held by a running operation.
 * Polls every 50 ms. Times out after `timeoutMs` (default 30 s).
 */
export async function waitForDrain(timeoutMs = 30_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (pendingDepth > 0 || mutex.isLocked()) {
        if (Date.now() >= deadline) {
            Logger.warn('waitForDrain: timed out waiting for write queue to drain');
            return;
        }
        await new Promise<void>((resolve) => setTimeout(resolve, 50));
    }
}
