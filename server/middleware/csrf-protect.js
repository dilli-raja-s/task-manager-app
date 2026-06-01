import { AppError } from '../errors.js';

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

export function csrfProtect(request, _response, next) {
  if (safeMethods.has(request.method)) {
    next();
    return;
  }

  const csrfCookie = request.cookies.tm_csrf;
  const csrfHeader = request.get('x-csrf-token');

  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    next(new AppError(403, 'AUTH_CSRF_TOKEN_INVALID', 'CSRF token is missing or invalid.'));
    return;
  }

  next();
}
