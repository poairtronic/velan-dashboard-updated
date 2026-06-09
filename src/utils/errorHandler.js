import { logger } from './logger';

/**
 * Normalizes an API error response or a network error into a user-friendly message.
 *
 * @param {Error|Response} error - The caught error
 * @param {string} fallbackMessage - Message to show if translation fails
 * @returns {string} User-friendly error message
 */
export const normalizeError = async (error, fallbackMessage = 'An unexpected error occurred.') => {
  try {
    if (error instanceof Response) {
      // Handle fetch responses that were not 2xx
      let message = fallbackMessage;
      try {
        const data = await error.json();
        if (data.message) message = data.message;
        else if (data.error) message = data.error;
      } catch (e) {
        // Body isn't JSON, rely on status code
      }

      switch (error.status) {
        case 400:
          return message !== fallbackMessage ? message : 'Invalid request. Please check your data.';
        case 401:
          return 'Session expired. Please log in again.';
        case 403:
          return 'You do not have permission to perform this action.';
        case 404:
          return 'The requested resource was not found.';
        case 429:
          return 'Too many requests. Please try again later.';
        case 500:
          return 'Something went wrong on our side. Please try again later.';
        case 502:
          return 'Bad gateway. Our servers are currently unreachable.';
        case 503:
          return 'Service unavailable. Please check back later.';
        case 504:
          return 'Gateway timeout. The request took too long.';
        default:
          return message;
      }
    }

    if (error instanceof Error) {
      if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
        return 'Network error. Please check your internet connection.';
      }
      if (error.name === 'AbortError') {
        return 'Request timeout. Please try again.';
      }
      return error.message || fallbackMessage;
    }

    return String(error) || fallbackMessage;
  } catch (err) {
    logger.error('Error in normalizeError', err);
    return fallbackMessage;
  }
};
