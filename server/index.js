import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createTask, deleteTask, getTasks, initializeDatabase, updateTask } from './database.js';
import { createAuthRouter } from './routes/auth-routes.js';
import { csrfProtect } from './middleware/csrf-protect.js';
import { errorAdapter } from './middleware/error-adapter.js';
import { requireAuth } from './middleware/require-auth.js';
import { traceIdMiddleware } from './middleware/trace-id.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDirectory = path.join(__dirname, '..');
const distDirectory = path.join(rootDirectory, 'dist');
const port = Number(process.env.PORT ?? 4000);

function getTrustedOrigins() {
  const defaultOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    `http://localhost:${port}`,
    `http://127.0.0.1:${port}`,
  ].join(',');

  const configuredOrigins = String(
    process.env.TRUSTED_ORIGINS ?? defaultOrigins
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return new Set(configuredOrigins);
}

function createCorsOptions() {
  const trustedOrigins = getTrustedOrigins();

  return {
    credentials: true,
    origin(origin, callback) {
      if (!origin || trustedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Origin is not allowed by CORS policy.'));
    },
  };
}

function validateTask(payload) {
  const title = String(payload.title ?? '').trim();
  const description = String(payload.description ?? '').trim();
  const status = String(payload.status ?? '').trim();
  const dueDate = String(payload.dueDate ?? '').trim();
  const allowedStatuses = new Set(['pending', 'in-progress', 'completed']);

  if (!title || !description || !dueDate) {
    return { error: 'Title, description, and due date are required.' };
  }

  if (!allowedStatuses.has(status)) {
    return { error: 'Status must be pending, in-progress, or completed.' };
  }

  if (Number.isNaN(Date.parse(dueDate))) {
    return { error: 'Due date is invalid.' };
  }

  return {
    value: {
      title,
      description,
      status,
      dueDate,
    },
  };
}

export function createApp() {
  const app = express();

  app.use('/api', cors(createCorsOptions()));
  app.use(express.json());
  app.use(cookieParser());
  app.use(traceIdMiddleware);

  app.get('/api/health', (_request, response) => {
    response.json({ ok: true });
  });

  app.use('/api', csrfProtect);
  app.use('/api/auth', createAuthRouter());

  app.get('/api/tasks', requireAuth, async (request, response) => {
    try {
      const tasks = await getTasks(request.auth.userId);
      response.json(tasks);
    } catch (error) {
      response.status(500).json({ error: 'Unable to load tasks.' });
    }
  });

  app.post('/api/tasks', requireAuth, async (request, response) => {
    const result = validateTask(request.body);

    if (result.error) {
      response.status(400).json({ error: result.error });
      return;
    }

    try {
      const task = await createTask(request.auth.userId, result.value);
      response.status(201).json(task);
    } catch (error) {
      response.status(500).json({ error: 'Unable to create task.' });
    }
  });

  app.put('/api/tasks/:id', requireAuth, async (request, response) => {
    const result = validateTask(request.body);

    if (result.error) {
      response.status(400).json({ error: result.error });
      return;
    }

    try {
      const task = await updateTask(request.auth.userId, Number(request.params.id), result.value);

      if (!task) {
        response.status(404).json({ error: 'Task not found.' });
        return;
      }

      response.json(task);
    } catch (error) {
      response.status(500).json({ error: 'Unable to update task.' });
    }
  });

  app.delete('/api/tasks/:id', requireAuth, async (request, response) => {
    try {
      const deleted = await deleteTask(request.auth.userId, Number(request.params.id));

      if (!deleted) {
        response.status(404).json({ error: 'Task not found.' });
        return;
      }

      response.status(204).end();
    } catch (error) {
      response.status(500).json({ error: 'Unable to delete task.' });
    }
  });

  if (fs.existsSync(distDirectory)) {
    app.use(express.static(distDirectory));

    app.get('/{*path}', (_request, response) => {
      response.sendFile(path.join(distDirectory, 'index.html'));
    });
  }

  app.use(errorAdapter);

  return app;
}

export async function startServer() {
  await initializeDatabase();
  const app = createApp();

  return app.listen(port, () => {
    console.log(`Task Manager server listening on http://localhost:${port}`);
  });
}

if (process.env.NODE_ENV !== 'test') {
  startServer().catch((error) => {
    console.error('Database initialization failed.', error);
    process.exit(1);
  });
}
