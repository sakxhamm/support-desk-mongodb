import jwt from 'jsonwebtoken';

/**
 * Verifies Bearer JWTs and distinguishes expired tokens from invalid ones.
 */
export function createAuthenticateMiddleware(jwtSecret) {
  return (req, res, next) => {
    const authHeader = req.header('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing or malformed Authorization Bearer token',
        },
      });
    }

    const token = authHeader.slice('Bearer '.length).trim();
    try {
      const payload = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
      req.user = {
        sub: payload.sub,
        email: payload.email,
        role: payload.role,
      };
      return next();
    } catch (err) {
      if (err?.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: {
            code: 'TOKEN_EXPIRED',
            message: 'Access token has expired; please log in again',
          },
        });
      }
      return res.status(401).json({
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid authentication token',
        },
      });
    }
  };
}

/**
 * Enforces role-based access control on protected routes.
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: `Requires one of roles: ${allowedRoles.join(', ')}`,
        },
      });
    }
    return next();
  };
}
