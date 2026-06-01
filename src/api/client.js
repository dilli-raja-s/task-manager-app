let csrfToken = null;

export class ApiError extends Error {
  constructor(message, status, code, payload) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.payload = payload;
  }
}

function getErrorMessage(payload, fallbackMessage) {
  if (payload?.error?.message) {
    return payload.error.message;
  }

  if (typeof payload?.error === 'string') {
    return payload.error;
  }

  return fallbackMessage;
}

async function parseResponse(response) {
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      getErrorMessage(payload, 'Request failed.'),
      response.status,
      payload?.error?.code,
      payload
    );
  }

  return payload;
}

export async function ensureCsrfToken() {
  if (csrfToken) {
    return csrfToken;
  }

  const response = await fetch('/api/auth/csrf-token', {
    method: 'GET',
    credentials: 'include',
  });

  const payload = await parseResponse(response);
  csrfToken = payload.csrfToken;
  return csrfToken;
}

export async function request(path, options = {}) {
  const method = String(options.method ?? 'GET').toUpperCase();
  const headers = {
    ...(options.headers ?? {}),
  };

  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    const token = await ensureCsrfToken();
    headers['x-csrf-token'] = token;
  }

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(path, {
    method,
    credentials: 'include',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  return parseResponse(response);
}

export function getSession() {
  return request('/api/auth/session');
}

export function register(credentials) {
  return request('/api/auth/register', {
    method: 'POST',
    body: credentials,
  });
}

export function login(credentials) {
  return request('/api/auth/login', {
    method: 'POST',
    body: credentials,
  });
}

export async function logout() {
  await request('/api/auth/logout', {
    method: 'POST',
  });
  csrfToken = null;
}
