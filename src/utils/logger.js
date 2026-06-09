/**
 * Centralized logging utility
 * Abstracts console methods and provides a foundation for future integration
 * with error monitoring tools like Sentry, Datadog, etc.
 */

const isDevelopment = import.meta.env.MODE === 'development';

class Logger {
  info(message, data) {
    if (isDevelopment) {
      console.log(`[INFO] ${message}`, data || '');
    }
  }

  warn(message, data) {
    if (isDevelopment) {
      console.warn(`[WARN] ${message}`, data || '');
    }
  }

  error(message, error, context = {}) {
    if (isDevelopment) {
      console.error(`[ERROR] ${message}`, error, context);
    } else {
      // Production logging hook (e.g., Sentry.captureException)
      // For now, fallback to console.error
      console.error(`[ERROR] ${message}`, error, context);
    }
  }
}

export const logger = new Logger();
