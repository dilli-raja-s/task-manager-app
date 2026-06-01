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
  process.env.DATABASE_PATH = path.join(os.tmpdir(), `task-manager-test-${Date.now()}.db`);

  const server = await import('../../server/index.js');
  const database = await import('../../server/database.js');

  await database.initializeDatabase();
  app = server.createApp();
});

describe('Auth + task ownership integration', () => {
  it('TC-INT-001 and TC-INT-002 register and login return session cookie', async () => {
    const agent = request.agent(app);
    const csrfToken = await getCsrfToken(agent);

    const registerResponse = await agent
      .post('/api/auth/register')
      .set('x-csrf-token', csrfToken)
      .send({ email: 'owner@example.com', password: 'UltraPass!1234' });

    expect(registerResponse.status).toBe(201);

    const loginResponse = await agent
      .post('/api/auth/login')
      .set('x-csrf-token', csrfToken)
      .send({ email: 'owner@example.com', password: 'UltraPass!1234' });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.headers['set-cookie']).toBeDefined();
  });

  it('TC-INT-003, TC-INT-004 and TC-INT-005 enforce auth on GET /api/tasks', async () => {
    const unauthenticated = await request(app).get('/api/tasks');
    expect(unauthenticated.status).toBe(401);
    expect(unauthenticated.body.error.code).toBe('AUTH_UNAUTHORIZED');

    const tampered = await request(app).get('/api/tasks').set('Cookie', ['tm_session=invalid']);
    expect(tampered.status).toBe(401);
    expect(tampered.body.error.code).toBe('AUTH_SESSION_INVALID');

    const ownerAgent = request.agent(app);
    const csrfToken = await getCsrfToken(ownerAgent);

    await ownerAgent
      .post('/api/auth/login')
      .set('x-csrf-token', csrfToken)
      .send({ email: 'owner@example.com', password: 'UltraPass!1234' });

    const authenticated = await ownerAgent.get('/api/tasks');
    expect(authenticated.status).toBe(200);
    expect(Array.isArray(authenticated.body)).toBe(true);
  });

  it('TC-INT-006 and TC-INT-007 return deterministic invalid credential responses', async () => {
    const agent = request.agent(app);
    const csrfToken = await getCsrfToken(agent);

    const wrongPassword = await agent
      .post('/api/auth/login')
      .set('x-csrf-token', csrfToken)
      .send({ email: 'owner@example.com', password: 'WrongPass!999' });

    expect(wrongPassword.status).toBe(401);
    expect(wrongPassword.body.error.code).toBe('AUTH_INVALID_CREDENTIALS');

    const unknownEmail = await agent
      .post('/api/auth/login')
      .set('x-csrf-token', csrfToken)
      .send({ email: 'unknown@example.com', password: 'WrongPass!999' });

    expect(unknownEmail.status).toBe(401);
    expect(unknownEmail.body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
    expect(unknownEmail.body.error.message).toBe('Invalid email or password.');
  });

  it('enforces task ownership on update and delete routes', async () => {
    const ownerAgent = request.agent(app);
    const ownerCsrf = await getCsrfToken(ownerAgent);

    await ownerAgent
      .post('/api/auth/login')
      .set('x-csrf-token', ownerCsrf)
      .send({ email: 'owner@example.com', password: 'UltraPass!1234' });

    const createResponse = await ownerAgent
      .post('/api/tasks')
      .set('x-csrf-token', ownerCsrf)
      .send({
        title: 'Owner Task',
        description: 'Only owner can update this task',
        status: 'pending',
        dueDate: '2030-01-01',
      });

    expect(createResponse.status).toBe(201);

    const secondUser = request.agent(app);
    const secondCsrf = await getCsrfToken(secondUser);

    await secondUser
      .post('/api/auth/register')
      .set('x-csrf-token', secondCsrf)
      .send({ email: 'second@example.com', password: 'RemotePass!1234' });

    await secondUser
      .post('/api/auth/login')
      .set('x-csrf-token', secondCsrf)
      .send({ email: 'second@example.com', password: 'RemotePass!1234' });

    const updateResponse = await secondUser
      .put(`/api/tasks/${createResponse.body.id}`)
      .set('x-csrf-token', secondCsrf)
      .send({
        title: 'Hacked Title',
        description: 'Should not be allowed',
        status: 'in-progress',
        dueDate: '2030-01-02',
      });

    expect(updateResponse.status).toBe(404);

    const deleteResponse = await secondUser
      .delete(`/api/tasks/${createResponse.body.id}`)
      .set('x-csrf-token', secondCsrf);

    expect(deleteResponse.status).toBe(404);
  });
});
