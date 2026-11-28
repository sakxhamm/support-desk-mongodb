import { randomBytes } from 'node:crypto';

/**
 * Loads runtime configuration without hardcoding static secrets.
 * In production, JWT_SECRET must be provided via environment variables.
 */
export function loadConfig(overrides = {}) {
  const envSecret = overrides.jwtSecret ?? process.env.JWT_SECRET;
  if (!envSecret && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable is required in production');
  }

  return {
    port: Number(overrides.port ?? process.env.PORT ?? 3001),
    // Ephemeral per-process secret for local dev/tests when JWT_SECRET is unset
    jwtSecret: envSecret || randomBytes(32).toString('hex'),
    jwtExpiresIn: overrides.jwtExpiresIn ?? process.env.JWT_EXPIRES_IN ?? '15m',
  };
}
