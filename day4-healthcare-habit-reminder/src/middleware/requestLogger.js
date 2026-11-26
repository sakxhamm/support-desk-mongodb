/**
 * Structured request logger designed for healthcare privacy:
 * logs operational metadata only (never request bodies, habit names, or patient IDs).
 */
export function requestLoggerMiddleware(req, res, next) {
  const startNs = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startNs) / 1e6;
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
      requestId: req.id,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
    };

    if (process.env.NODE_ENV !== 'test') {
      console.log(JSON.stringify(logEntry));
    }
  });

  next();
}
