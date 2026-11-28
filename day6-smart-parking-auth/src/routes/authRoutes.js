import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const BCRYPT_ROUNDS = 10;

export function createAuthRouter({ store, config }) {
  const router = Router();

  // POST /api/v1/auth/register
  router.post('/register', async (req, res) => {
    const { email, password, name } = req.body ?? {};

    if (!email || !password || !name || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({
        error: {
          code: 'INVALID_REGISTRATION',
          message: 'Valid name, email, and password (min 8 chars) are required',
        },
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    if (store.users.has(normalizedEmail)) {
      return res.status(409).json({
        error: {
          code: 'EMAIL_EXISTS',
          message: 'An account with this email already exists',
        },
      });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = {
      id: `usr-${randomUUID().slice(0, 8)}`,
      email: normalizedEmail,
      name: String(name).trim(),
      role: 'driver', // Least-privilege default role
      passwordHash,
    };

    store.users.set(normalizedEmail, user);

    return res.status(201).json({
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  });

  // POST /api/v1/auth/login
  router.post('/login', async (req, res) => {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      return res.status(400).json({
        error: {
          code: 'MISSING_CREDENTIALS',
          message: 'Email and password are required',
        },
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = store.users.get(normalizedEmail);
    if (!user) {
      return res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });
    }

    const matches = await bcrypt.compare(String(password), user.passwordHash);
    if (!matches) {
      return res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        },
      });
    }

    const token = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
      },
      config.jwtSecret,
      {
        algorithm: 'HS256',
        expiresIn: config.jwtExpiresIn,
      }
    );

    return res.status(200).json({
      data: {
        accessToken: token,
        tokenType: 'Bearer',
        expiresIn: config.jwtExpiresIn,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
    });
  });

  return router;
}
