// Levelled structured logger.
import { config } from '../config/env.js';
type Level = 'debug' | 'info' | 'warn' | 'error';
const RANK: Record<Level | 'silent', number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};
const threshold = RANK[config.LOG_LEVEL];
function emit(level: Level, message: string, context?: Record<string, unknown>) {
  if (RANK[level] < threshold) return;
  if (config.isProduction) {
    const line = JSON.stringify({
      level,
      time: new Date().toISOString(),
      message,
      ...context,
    });
    (level === 'error' || level === 'warn' ? console.error : console.log)(line);
    return;
  }
  const stamp = new Date().toISOString().slice(11, 23);
  const suffix = context && Object.keys(context).length ? ` ${JSON.stringify(context)}` : '';
  const line = `${stamp} ${level.toUpperCase().padEnd(5)} ${message}${suffix}`;
  (level === 'error' || level === 'warn' ? console.error : console.log)(line);
}
export const logger = {
  debug: (message: string, context?: Record<string, unknown>) => emit('debug', message, context),
  info: (message: string, context?: Record<string, unknown>) => emit('info', message, context),
  warn: (message: string, context?: Record<string, unknown>) => emit('warn', message, context),
  error: (message: string, context?: Record<string, unknown>) => emit('error', message, context),
};
