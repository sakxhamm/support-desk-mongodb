import { AppError, BadRequestError, NotFoundError } from '../errors/AppError.js';

/**
 * Catches unmatched routes and forwards a structured 404 error.
 */
export function notFoundHandler(req, _res, next) {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl.split('?')[0]}`));
}

/**
 * Centralized Express error-handling middleware.
 * Normalizes malformed JSON, validation failures, privacy policy violations,
 * and unexpected internal errors into a consistent JSON envelope.
 */
export function errorHandler(err, req, res, _next) {
  let normalizedError = err;

  // Handle malformed JSON payloads from express.json()
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    normalizedError = new BadRequestError('Malformed JSON in request body');
  } else if (!(err instanceof AppError)) {
    normalizedError = new AppError('An unexpected internal error occurred', 500, 'INTERNAL_ERROR');
    if (process.env.NODE_ENV !== 'test') {
      console.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'error',
          requestId: req.id,
          errorName: err?.name || 'Error',
          message: err?.message || 'Unknown error',
        })
      );
    }
  }

  const payload = {
    error: {
      code: normalizedError.code,
      message: normalizedError.message,
      requestId: req.id ?? null,
    },
  };

  if (normalizedError.details) {
    payload.error.details = normalizedError.details;
  }

  res.status(normalizedError.statusCode).json(payload);
}
