import * as Sentry from '@sentry/react';
import LogRocket from 'logrocket';

const isDevelopment = import.meta.env.MODE === 'development';

class Logger {
  info(message, data) {
    if (isDevelopment) {
      console.log(`[INFO] ${message}`, data || '');
    } else {
      LogRocket.info(message, data);
    }
  }

  warn(message, data) {
    if (isDevelopment) {
      console.warn(`[WARN] ${message}`, data || '');
    } else {
      LogRocket.warn(message, data);
      Sentry.captureMessage(message, 'warning');
    }
  }

  error(message, error, context = {}) {
    if (isDevelopment) {
      console.error(`[ERROR] ${message}`, error, context);
    } else {
      LogRocket.error(message, error, context);
      Sentry.captureException(error, {
        extra: {
          message,
          ...context,
        }
      });
    }
  }

  debug(message, data) {
    if (isDevelopment) {
      console.debug(`[DEBUG] ${message}`, data || '');
    }
  }
}

export const logger = new Logger();
