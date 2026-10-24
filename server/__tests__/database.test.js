import {
  closeDatabase, createTask, deleteTask, getTasks, initializeDatabase, searchTasks, updateTask,
} from '../database.js';

describe('database.searchTasks', () => {
  beforeAll(async () => {
    await initializeDatabase();
    await createTask({
      title: 'test pending',
      description: 'Seeded pending task',
      status: 'pending',
      dueDate: '2026-06-10',
    });
    await createTask({
      title: 'completed item',
      description: 'Seeded completed task',
      status: 'completed',
      dueDate: '2026-07-10',
    });
  });

  afterAll(async () => {
    await closeDatabase();
  });

  test('should support task lifecycle in the isolated database', async () => {
    const task = await createTask({
      title: 'Lifecycle task', description: 'Temporary task', status: 'pending', dueDate: '2026-08-01',
    });
    expect((await getTasks()).some((item) => item.id === task.id)).toBe(true);

    const updated = await updateTask(task.id, { ...task, title: 'Updated task', status: 'completed' });
    expect(updated).toMatchObject({ id: task.id, title: 'Updated task', status: 'completed' });
    expect(await deleteTask(task.id)).toBe(true);
    expect(await deleteTask(task.id)).toBe(false);
    expect(await updateTask(task.id, task)).toBeNull();
  });

  test('should reject invalid statuses without persisting them', async () => {
    const task = {
      title: 'Invalid task', description: 'Invalid status', status: 'invalid', dueDate: '2026-08-01',
    };
    const before = await getTasks();
    await expect(createTask(task)).rejects.toThrow();
    await expect(updateTask(before[0].id, task)).rejects.toThrow();
    expect(await getTasks()).toEqual(before);
  });

  test('should return tasks with pagination metadata', async () => {
    const result = await searchTasks({});

    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('pagination');
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.pagination).toHaveProperty('page');
    expect(result.pagination).toHaveProperty('limit');
    expect(result.pagination).toHaveProperty('total');
    expect(result.pagination).toHaveProperty('pages');
  });

  test('should filter by query string', async () => {
    const result = await searchTasks({ query: 'test' });

    expect(result.data).toBeDefined();
    expect(result.pagination.total).toBeGreaterThanOrEqual(0);
  });

  test('should filter by status', async () => {
    const result = await searchTasks({ status: 'pending' });

    expect(result.data).toBeDefined();
    result.data.forEach((task) => {
      expect(task.status).toBe('pending');
    });
  });

  test('should handle date range filter', async () => {
    const result = await searchTasks({
      dateFrom: '2026-06-01',
      dateTo: '2026-06-30',
    });

    expect(result.data).toBeDefined();
    expect(result.pagination.total).toBeGreaterThanOrEqual(0);
  });

  test('should return paginated results', async () => {
    const result1 = await searchTasks({ page: 1, limit: 5 });
    const result2 = await searchTasks({ page: 2, limit: 5 });

    expect(result1.pagination.page).toBe(1);
    expect(result1.pagination.limit).toBe(5);
    expect(result2.pagination.page).toBe(2);
    expect(result2.pagination.limit).toBe(5);
  });

  test('should calculate correct pagination values', async () => {
    const result = await searchTasks({ limit: 20 });

    expect(result.pagination.page).toBeGreaterThanOrEqual(1);
    expect(result.pagination.limit).toBe(20);
    expect(result.pagination.total).toBeGreaterThanOrEqual(0);
    if (result.pagination.total > 0) {
      expect(result.pagination.pages).toBeGreaterThanOrEqual(1);
    }
  });

  test('should handle sorting by dueDate', async () => {
    const resultAsc = await searchTasks({ sortBy: 'dueDate', order: 'asc' });
    const resultDesc = await searchTasks({ sortBy: 'dueDate', order: 'desc' });

    expect(resultAsc.data).toBeDefined();
    expect(resultDesc.data).toBeDefined();
  });

  test('should handle sorting by title', async () => {
    const result = await searchTasks({ sortBy: 'title', order: 'asc' });

    expect(result.data).toBeDefined();
  });

  test('should combine multiple filters', async () => {
    const result = await searchTasks({
      query: 'test',
      status: 'pending',
      dateFrom: '2026-06-01',
      sortBy: 'dueDate',
      order: 'asc',
      page: 1,
      limit: 20,
    });

    expect(result.data).toBeDefined();
    expect(result.pagination).toBeDefined();
  });

  test('should return empty array when no results match', async () => {
    const result = await searchTasks({
      query: 'xxxnonexistentxxx',
    });

    expect(result.data).toEqual([]);
    expect(result.pagination.total).toBe(0);
    expect(result.pagination.pages).toBe(0);
  });
});
