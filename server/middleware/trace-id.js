import crypto from 'crypto';

export function traceIdMiddleware(request, _response, next) {
  request.traceId = crypto.randomUUID();
  next();
}
