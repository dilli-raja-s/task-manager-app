import express from 'express';
import { createUser, getUserByEmail } from '../database.js';
import { AppError } from '../errors.js';
import { hashPassword, verifyPassword } from '../auth/password-hasher.js';
import {
  createCsrfToken,
  createSessionForUser,
  getCsrfCookieOptions,
  getSessionCookieOptions,
  revokeSessionById,
  revokeSessionsByUserId,
  validateSession,
} from '../auth/session-service.js';
import { validateLoginPayload, validateRegistrationPayload } from '../auth/password-policy.js';
import { loginRateLimit } from '../middleware/login-rate-limit.js';
import { requireAuth } from '../middleware/require-auth.js';

export function createAuthRouter() {
  const router = express.Router();

  router.get('/csrf-token', (_request, response) => {
    const csrfToken = createCsrfToken();
    response.cookie('tm_csrf', csrfToken, getCsrfCookieOptions());
    response.json({ csrfToken });
  });

  router.post('/register', async (request, response, next) => {
    try {
      const payload = validateRegistrationPayload(request.body);
      const existingUser = await getUserByEmail(payload.email);

      if (existingUser) {
        throw new AppError(409, 'AUTH_EMAIL_ALREADY_EXISTS', 'An account with this email already exists.');
      }

      const passwordHash = await hashPassword(payload.password);
      const user = await createUser({ email: payload.email, passwordHash });

      response.status(201).json({
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/login', loginRateLimit, async (request, response, next) => {
    try {
      const payload = validateLoginPayload(request.body);
      const user = await getUserByEmail(payload.email);
      const isValidPassword = user ? await verifyPassword(payload.password, user.passwordHash) : false;

      if (!user || !isValidPassword) {
        throw new AppError(401, 'AUTH_INVALID_CREDENTIALS', 'Invalid email or password.');
      }

      await revokeSessionsByUserId(user.id);

      const session = await createSessionForUser(user.id, {
        userAgent: request.get('user-agent') ?? '',
        ipAddress: request.ip,
      });

      response.cookie('tm_session', session.id, getSessionCookieOptions());
      response.status(200).json({
        id: user.id,
        email: user.email,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/session', async (request, response, next) => {
    try {
      const sessionId = request.cookies.tm_session;

      if (!sessionId) {
        response.status(200).json({ authenticated: false });
        return;
      }

      const session = await validateSession(sessionId);

      if (!session) {
        response.clearCookie('tm_session', getSessionCookieOptions());
        response.status(200).json({ authenticated: false });
        return;
      }

      response.status(200).json({
        authenticated: true,
        user: session.user,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/logout', requireAuth, async (request, response, next) => {
    try {
      await revokeSessionById(request.auth.sessionId);
      response.clearCookie('tm_session', getSessionCookieOptions());
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
