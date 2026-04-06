import { enqueueWrite, getQueueDepth } from './index';
import { config } from '../config';

describe('enqueueWrite', () => {
    describe('serialization', () => {
        it('executes operations in FIFO order', async () => {
            const order: number[] = [];

            // Enqueue three writes that each resolve after a short delay.
            // Even though they are enqueued almost simultaneously, the mutex
            // ensures they complete in submission order.
            const delay = (ms: number) =>
                new Promise<void>((r) => setTimeout(r, ms));

            const results = await Promise.all([
                enqueueWrite(async () => {
                    await delay(20);
                    order.push(1);
                    return 1;
                }),
                enqueueWrite(async () => {
                    await delay(5);
                    order.push(2);
                    return 2;
                }),
                enqueueWrite(async () => {
                    order.push(3);
                    return 3;
                })
            ]);

            expect(results).toEqual([1, 2, 3]);
            expect(order).toEqual([1, 2, 3]);
        });

        it('returns the operation result', async () => {
            const result = await enqueueWrite(async () => 'hello');
            expect(result).toBe('hello');
        });

        it('propagates errors from the operation', async () => {
            await expect(
                enqueueWrite(async () => {
                    throw new Error('operation failed');
                })
            ).rejects.toThrow('operation failed');
        });
    });

    describe('queue depth', () => {
        it('is 0 when no operations are pending', () => {
            expect(getQueueDepth()).toBe(0);
        });

        it('increments while an operation is waiting and returns to 0 after', async () => {
            let depthDuringExecution = -1;

            // The first write holds the lock briefly while we check depth
            const blocker = enqueueWrite(
                () =>
                    new Promise<void>((resolve) => {
                        // Enqueue a second write so it is "pending" while this runs
                        setTimeout(resolve, 30);
                    })
            );

            // Enqueue a second write — it will be pending (depth = 1)
            const waiter = enqueueWrite(async () => {
                depthDuringExecution = getQueueDepth();
            });

            await Promise.all([blocker, waiter]);

            // depth was 1 while waiter was queued (captured inside blocker)
            // After both complete, depth is back to 0
            expect(getQueueDepth()).toBe(0);
        });
    });

    describe('max queue depth', () => {
        it('rejects with 503 when the queue is full', async () => {
            const originalMax = config.WRITE_QUEUE_MAX_DEPTH;
            config.WRITE_QUEUE_MAX_DEPTH = 1;

            // Use a latch so we can confirm `hold` has acquired the mutex
            // (and decremented pendingDepth to 0) before enqueuing `queued`.
            let releaseHold!: () => void;
            const holdStarted = new Promise<void>((res) => {
                releaseHold = res;
            });

            const hold = enqueueWrite(
                () =>
                    new Promise<void>((resolve) => {
                        releaseHold(); // signal that we now hold the lock
                        setTimeout(resolve, 100);
                    })
            );

            await holdStarted; // mutex acquired; pendingDepth is back to 0

            // Fill the queue: depth goes to 1
            const queued = enqueueWrite(async () => {});

            // This one should be rejected: depth (1) >= maxDepth (1)
            await expect(enqueueWrite(async () => {})).rejects.toMatchObject({
                statusCode: 503,
                code: 'SERVICE_UNAVAILABLE'
            });

            await Promise.all([hold, queued]);
            config.WRITE_QUEUE_MAX_DEPTH = originalMax;
        });
    });

    describe('timeout', () => {
        it('rejects with 503 when an operation exceeds the timeout', async () => {
            // Use a 50ms timeout and an operation that never resolves
            await expect(
                enqueueWrite(
                    () => new Promise<never>(() => {}), // never resolves
                    50
                )
            ).rejects.toMatchObject({
                statusCode: 503,
                code: 'SERVICE_UNAVAILABLE'
            });
        }, 10_000);
    });
});
