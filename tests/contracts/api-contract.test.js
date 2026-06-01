import os from 'os';
import path from 'path';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

let app;

async function getCsrfToken(agent) {
  const response = await agent.get('/api/auth/csrf-token');
  return response.body.csrfToken;
}

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_PATH = path.join(os.tmpdir(), `task-manager-contract-test-${Date.now()}.db`);

  const server = await import('../../server/index.js');
  const database = await import('../../server/database.js');

  await database.initializeDatabase();
  app = server.createApp();
});

describe('Phase 07 API contract validation', () => {
  it('preserves the documented auth and task route contract for the story', async () => {
    const agent = request.agent(app);
    const csrfToken = await getCsrfToken(agent);

    const healthResponse = await agent.get('/api/health');
    expect(healthResponse.status).toBe(200);
    expect(healthResponse.body).toEqual({ ok: true });

    const registerResponse = await agent
      .post('/api/auth/register')
      .set('x-csrf-token', csrfToken)
      .send({ email: 'contract-owner@example.com', password: 'ContractPass!1234' });

    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body.email).toBe('contract-owner@example.com');

    const loginResponse = await agent
      .post('/api/auth/login')
      .set('x-csrf-token', csrfToken)
      .send({ email: 'contract-owner@example.com', password: 'ContractPass!1234' });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.email).toBe('contract-owner@example.com');
    expect(typeof loginResponse.body.id).toBe('number');

    const sessionResponse = await agent.get('/api/auth/session');
    expect(sessionResponse.status).toBe(200);
    expect(sessionResponse.body.authenticated).toBe(true);
    expect(sessionResponse.body.user.email).toBe('contract-owner@example.com');

    const tasksResponse = await agent.get('/api/tasks');
    expect(tasksResponse.status).toBe(200);
    expect(Array.isArray(tasksResponse.body)).toBe(true);
  });

  it('preserves failure contracts for unauthenticated access and invalid credentials', async () => {
    const unauthenticatedTasks = await request(app).get('/api/tasks');
    expect(unauthenticatedTasks.status).toBe(401);
    expect(unauthenticatedTasks.body.error.code).toBe('AUTH_UNAUTHORIZED');
    expect(typeof unauthenticatedTasks.body.error.traceId).toBe('string');

    const agent = request.agent(app);
    const csrfToken = await getCsrfToken(agent);

    const invalidLogin = await agent
      .post('/api/auth/login')
      .set('x-csrf-token', csrfToken)
      .send({ email: 'missing@example.com', password: 'WrongPass!9999' });

    expect(invalidLogin.status).toBe(401);
    expect(invalidLogin.body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
    expect(invalidLogin.body.error.message).toBe('Invalid email or password.');
  });
});