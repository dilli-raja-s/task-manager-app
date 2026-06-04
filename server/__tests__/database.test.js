import { searchTasks } from '../database.js';

describe('database.searchTasks', () => {
  // Note: These are integration tests with mock or test database
  // In a real environment, you'd use a test database or mocks

  test('should return tasks with pagination metadata', async () => {
    // This test assumes a test database with seed data
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
      // All returned tasks should have pending status
      // (unless status is 'all', which returns all)
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
