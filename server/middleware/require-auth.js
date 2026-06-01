import { AppError } from '../errors.js';
import { validateSession } from '../auth/session-service.js';

export async function requireAuth(request, _response, next) {
  try {
    const sessionId = request.cookies.tm_session;

    if (!sessionId) {
      throw new AppError(401, 'AUTH_UNAUTHORIZED', 'Authentication is required.');
    }

    const session = await validateSession(sessionId);

    if (!session) {
      throw new AppError(401, 'AUTH_SESSION_INVALID', 'Session is invalid or expired.');
    }

    request.auth = {
      sessionId: session.sessionId,
      userId: session.user.id,
      email: session.user.email,
    };

    next();
  } catch (error) {
    next(error);
  }
}
