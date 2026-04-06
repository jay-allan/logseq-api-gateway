import { createLogger, format, transports } from 'winston';

const DEBUG = process.env.NODE_ENV !== 'production';

const logger = createLogger({
    level: 'info',
    format: format.combine(
        format.splat(),
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.printf(
            (info) => `(${info.level}) ${info.timestamp} ${info.message}`
        )
    ),
    silent: process.env.NODE_ENV === 'test'
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new transports.Console());
}

export class Logger {
    static info(message: string, ...args: unknown[]): void {
        logger.info(this.formatMessage(message), args);
    }

    static warn(message: string, ...args: unknown[]): void {
        logger.warn(this.formatMessage(message), args);
    }

    static error(message: string, ...args: unknown[]): void {
        logger.error(this.formatMessage(message), args);
    }

    private static formatMessage(message: string): string {
        return `[${this.getCallerName()}] ${message}`;
    }

    protected static getCallerName(): string {
        try {
            throw new Error();
        } catch (error) {
            const lines = (error as Error).stack?.split('\n');
            const line = lines
                ? lines[4].slice(7, lines[4].indexOf(' ', 7))
                : '';
            return line;
        }
    }
}
