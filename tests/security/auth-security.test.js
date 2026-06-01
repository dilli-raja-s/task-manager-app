import request from 'supertest';
import os from 'os';
import path from 'path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

let app;

async function getCsrfToken(agent) {
  const response = await agent.get('/api/auth/csrf-token');
  return response.body.csrfToken;
}

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  delete process.env.FORCE_SECURE_COOKIES;
  delete process.env.ALLOW_INSECURE_COOKIES;
  delete process.env.TRUSTED_ORIGINS;
  process.env.DATABASE_PATH = path.join(os.tmpdir(), `task-manager-security-test-${Date.now()}.db`);
  const server = await import('../../server/index.js');
  const database = await import('../../server/database.js');

  await database.initializeDatabase();
  app = server.createApp();
});

afterEach(() => {
  process.env.NODE_ENV = 'test';
  delete process.env.FORCE_SECURE_COOKIES;
  delete process.env.ALLOW_INSECURE_COOKIES;
  delete process.env.TRUSTED_ORIGINS;
});

describe('Security baselines', () => {
  it('TC-SEC-002 blocks mutating auth endpoints without CSRF token', async () => {
    const response = await request(app).post('/api/auth/register').send({
      email: 'csrf@example.com',
      password: 'CsrfStrong!123',
    });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('AUTH_CSRF_TOKEN_INVALID');
  });

  it('returns 429 after repeated failed logins (brute-force baseline)', async () => {
    const agent = request.agent(app);
    const csrfToken = await getCsrfToken(agent);

    await agent
      .post('/api/auth/register')
      .set('x-csrf-token', csrfToken)
      .send({ email: 'rate@example.com', password: 'RateStrong!123' });

    let rateLimitedResponse = null;

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const response = await agent
        .post('/api/auth/login')
        .set('x-csrf-token', csrfToken)
        .send({ email: 'rate@example.com', password: 'WrongStrong!123' });

      if (response.status === 429) {
        rateLimitedResponse = response;
        break;
      }
    }

    expect(rateLimitedResponse).not.toBeNull();
    expect(rateLimitedResponse.status).toBe(429);
    expect(rateLimitedResponse.body.error.code).toBe('AUTH_RATE_LIMITED');
  });

  it('sets Secure on session and CSRF cookies outside test mode', async () => {
    process.env.NODE_ENV = 'development';
    process.env.FORCE_SECURE_COOKIES = 'true';

    const csrfResponse = await request(app).get('/api/auth/csrf-token');
    const csrfCookie = csrfResponse.headers['set-cookie']?.find((value) => value.startsWith('tm_csrf='));

    expect(csrfCookie).toContain('Secure');

    const csrfToken = csrfResponse.body.csrfToken;
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .set('Cookie', [`tm_csrf=${csrfToken}`])
      .set('x-csrf-token', csrfToken)
      .send({ email: 'cookie-security@example.com', password: 'CookieStrong!123' });

    expect(registerResponse.status).toBe(201);

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .set('Cookie', [`tm_csrf=${csrfToken}`])
      .set('x-csrf-token', csrfToken)
      .send({ email: 'cookie-security@example.com', password: 'CookieStrong!123' });

    const sessionCookie = loginResponse.headers['set-cookie']?.find((value) => value.startsWith('tm_session='));

    expect(sessionCookie).toContain('Secure');
    expect(sessionCookie).toContain('HttpOnly');
    expect(sessionCookie).toContain('SameSite=Lax');
  });

  it('rejects credentialed CORS requests from untrusted origins', async () => {
    process.env.TRUSTED_ORIGINS = 'http://localhost:5173';

    const response = await request(app)
      .get('/api/health')
      .set('Origin', 'http://malicious.example.com');

    expect(response.status).toBe(500);
  });
});
