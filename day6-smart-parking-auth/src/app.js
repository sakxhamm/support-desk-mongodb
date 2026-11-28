import express from 'express';
import { loadConfig } from './config.js';
import { createAuthenticateMiddleware } from './middleware/auth.js';
import { createAuthRouter } from './routes/authRoutes.js';
import { createParkingRouter } from './routes/parkingRoutes.js';
import { createParkingStore } from './store/parkingStore.js';

export function createApp(configOverrides = {}) {
  const config = loadConfig(configOverrides);
  const store = createParkingStore();
  const authenticate = createAuthenticateMiddleware(config.jwtSecret);

  const app = express();
  app.use(express.json({ limit: '16kb' }));

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', service: 'smart-parking-auth-api' });
  });

  app.use('/api/v1/auth', createAuthRouter({ store, config }));
  app.use('/api/v1', createParkingRouter({ store, authenticate }));

  // Handle malformed JSON and unexpected errors without leaking stack traces
  app.use((err, _req, res, _next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
      return res.status(400).json({
        error: { code: 'BAD_REQUEST', message: 'Malformed JSON body' },
      });
    }
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  });

  return { app, config, store };
}
