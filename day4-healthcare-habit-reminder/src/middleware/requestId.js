import { randomUUID } from 'node:crypto';

const SAFE_REQUEST_ID_REGEX = /^[a-zA-Z0-9._-]{8,64}$/;

/**
 * Assigns a correlation ID to every incoming request and echoes it back
 * via the X-Request-Id response header for end-to-end tracing.
 */
export function requestIdMiddleware(req, res, next) {
  const incomingId = req.header('x-request-id');
  const requestId =
    incomingId && SAFE_REQUEST_ID_REGEX.test(incomingId)
      ? incomingId
      : randomUUID();

  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}
