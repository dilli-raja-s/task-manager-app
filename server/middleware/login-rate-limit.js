import { rateLimit } from 'express-rate-limit';
import { createErrorEnvelope } from '../errors.js';

function normalizedEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

export const loginRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 7,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (request) => {
    const email = normalizedEmail(request.body?.email);
    return `${request.ip}:${email}`;
  },
  handler: (request, response) => {
    response
      .status(429)
      .json(
        createErrorEnvelope(
          {
            code: 'AUTH_RATE_LIMITED',
            message: 'Too many login attempts. Try again later.',
            details: {},
          },
          request.traceId
        )
      );
  },
});
