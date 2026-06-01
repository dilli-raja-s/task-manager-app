export class AppError extends Error {
  constructor(status, code, message, details = {}) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function createErrorEnvelope(error, traceId) {
  return {
    error: {
      code: error.code,
      message: error.message,
      details: error.details ?? {},
      traceId,
    },
  };
}
