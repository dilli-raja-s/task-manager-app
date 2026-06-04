import cors from 'cors';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createTask, deleteTask, getTasks, initializeDatabase, updateTask, searchTasks } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDirectory = path.join(__dirname, '..');
const distDirectory = path.join(rootDirectory, 'dist');
const port = Number(process.env.PORT ?? 4000);
const app = express();

app.use(cors());
app.use(express.json());

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

app.get('/api/health', (_request, response) => {
  response.json({ ok: true });
});

app.get('/api/tasks', async (_request, response) => {
  try {
    const tasks = await getTasks();
    response.json(tasks);
  } catch (error) {
    response.status(500).json({ error: 'Unable to load tasks.' });
  }
});

app.get('/api/tasks/search', async (request, response) => {
  try {
    const query = String(request.query.query ?? '').trim();
    const status = String(request.query.status ?? 'all').trim();
    const dateFrom = request.query.dateFrom ? String(request.query.dateFrom).trim() : null;
    const dateTo = request.query.dateTo ? String(request.query.dateTo).trim() : null;
    const sortBy = String(request.query.sortBy ?? 'dueDate').trim();
    const order = String(request.query.order ?? 'asc').trim();
    let page = parseInt(request.query.page ?? '1', 10);
    let limit = parseInt(request.query.limit ?? '20', 10);

    // Validation
    if (Number.isNaN(page) || page < 1) {
      page = 1;
    }
    if (Number.isNaN(limit) || limit < 1) {
      limit = 20;
    }
    if (limit > 100) {
      limit = 100;
    }

    // Validate date format if provided
    if (dateFrom && Number.isNaN(Date.parse(dateFrom))) {
      response.status(400).json({ error: 'Invalid dateFrom format. Use ISO date format (YYYY-MM-DD).' });
      return;
    }
    if (dateTo && Number.isNaN(Date.parse(dateTo))) {
      response.status(400).json({ error: 'Invalid dateTo format. Use ISO date format (YYYY-MM-DD).' });
      return;
    }

    const result = await searchTasks({
      query,
      status,
      dateFrom,
      dateTo,
      sortBy,
      order,
      page,
      limit,
    });

    response.json({
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error('Search error:', error);
    response.status(500).json({ error: 'Unable to search tasks.' });
  }
});

app.post('/api/tasks', async (request, response) => {
  const result = validateTask(request.body);

  if (result.error) {
    response.status(400).json({ error: result.error });
    return;
  }

  try {
    const task = await createTask(result.value);
    response.status(201).json(task);
  } catch (error) {
    response.status(500).json({ error: 'Unable to create task.' });
  }
});

app.put('/api/tasks/:id', async (request, response) => {
  const result = validateTask(request.body);

  if (result.error) {
    response.status(400).json({ error: result.error });
    return;
  }

  try {
    const task = await updateTask(Number(request.params.id), result.value);

    if (!task) {
      response.status(404).json({ error: 'Task not found.' });
      return;
    }

    response.json(task);
  } catch (error) {
    response.status(500).json({ error: 'Unable to update task.' });
  }
});

app.delete('/api/tasks/:id', async (request, response) => {
  try {
    const deleted = await deleteTask(Number(request.params.id));

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

initializeDatabase()
  .then(() => {
    app.listen(port, () => {
      console.log(`Task Manager server listening on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error('Database initialization failed.', error);
    process.exit(1);
  });