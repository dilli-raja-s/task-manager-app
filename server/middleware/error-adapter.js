import { AppError, createErrorEnvelope } from '../errors.js';

export function errorAdapter(error, request, response, _next) {
  if (error instanceof AppError) {
    response.status(error.status).json(createErrorEnvelope(error, request.traceId));
    return;
  }

  console.error('Unhandled API error', {
    traceId: request.traceId,
    method: request.method,
    path: request.path,
    message: error?.message,
    stack: error?.stack,
  });

  const unexpectedError = new AppError(500, 'INTERNAL_SERVER_ERROR', 'Unexpected server error.');
  response.status(500).json(createErrorEnvelope(unexpectedError, request.traceId));
}
