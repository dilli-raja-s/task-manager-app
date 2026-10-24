import { buildSearchQuery, buildCountQuery } from '../searchQueryBuilder.js';

describe('searchQueryBuilder', () => {
  describe('buildSearchQuery', () => {
    test('should build query with no filters (empty search)', () => {
      const result = buildSearchQuery({});
      expect(result.sql).toContain('SELECT id, title, description, status, dueDate, createdAt, updatedAt');
      expect(result.sql).toContain('FROM tasks');
      expect(result.sql).toContain('ORDER BY dueDate ASC');
      expect(result.sql).toContain('LIMIT ? OFFSET ?');
      expect(result.params).toEqual([20, 0]);
    });

    test('should build query with keyword search', () => {
      const result = buildSearchQuery({ query: 'test' });
      expect(result.sql).toContain('(title LIKE ? OR description LIKE ?)');
      expect(result.params).toContain('%test%');
      expect(result.params).toContain('%test%');
    });

    test('should build query with status filter', () => {
      const result = buildSearchQuery({ status: 'pending' });
      expect(result.sql).toContain('status = ?');
      expect(result.params).toContain('pending');
    });

    test('should ignore status filter when status is "all"', () => {
      const result = buildSearchQuery({ status: 'all' });
      expect(result.sql).not.toContain('status = ?');
    });

    test('should build query with date range filter', () => {
      const result = buildSearchQuery({ dateFrom: '2026-06-01', dateTo: '2026-06-30' });
      expect(result.sql).toContain('dueDate >= ?');
      expect(result.sql).toContain('dueDate <= ?');
      expect(result.params).toContain('2026-06-01');
      expect(result.params).toContain('2026-06-30');
    });

    test('should build query with sorting', () => {
      const result = buildSearchQuery({ sortBy: 'title', order: 'desc' });
      expect(result.sql).toContain('ORDER BY title DESC');
    });

    test('should sanitize invalid sort field', () => {
      const result = buildSearchQuery({ sortBy: 'invalid' });
      expect(result.sql).toContain('ORDER BY dueDate ASC');
    });

    test('should handle pagination correctly', () => {
      const result = buildSearchQuery({ page: 2, limit: 50 });
      expect(result.params).toContain(50);
      expect(result.params).toContain(50); // offset = (2-1)*50 = 50
    });

    test('should cap limit at 100', () => {
      const result = buildSearchQuery({ limit: 200 });
      expect(result.params[result.params.length - 2]).toBe(100);
    });

    test('should handle negative page number', () => {
      const result = buildSearchQuery({ page: -1 });
      expect(result.page).toBe(1);
      expect(result.params[result.params.length - 1]).toBe(0);
    });

    test('should combine multiple filters', () => {
      const result = buildSearchQuery({
        query: 'report',
        status: 'pending',
        dateFrom: '2026-06-01',
        sortBy: 'dueDate',
        order: 'asc',
        page: 1,
        limit: 20,
      });
      expect(result.sql).toContain('(title LIKE ? OR description LIKE ?)');
      expect(result.sql).toContain('status = ?');
      expect(result.sql).toContain('dueDate >= ?');
      expect(result.params).toContain('%report%');
      expect(result.params).toContain('pending');
      expect(result.params).toContain('2026-06-01');
    });

    test('should trim whitespace from query', () => {
      const result = buildSearchQuery({ query: '  test  ' });
      expect(result.params).toContain('%test%');
    });

    test('should return correct pagination values', () => {
      const result = buildSearchQuery({ page: 3, limit: 25 });
      expect(result.page).toBe(3);
      expect(result.limit).toBe(25);
    });
  });

  describe('buildCountQuery', () => {
    test('should build count query with no filters', () => {
      const result = buildCountQuery({});
      expect(result.sql).toContain('SELECT COUNT(*) as count');
      expect(result.sql).toContain('FROM tasks');
      expect(result.params).toEqual([]);
    });

    test('should build count query with keyword search', () => {
      const result = buildCountQuery({ query: 'test' });
      expect(result.sql).toContain('(title LIKE ? OR description LIKE ?)');
      expect(result.params).toContain('%test%');
    });

    test('should build count query with status filter', () => {
      const result = buildCountQuery({ status: 'in-progress' });
      expect(result.sql).toContain('status = ?');
      expect(result.params).toContain('in-progress');
    });

    test('should build count query with date range', () => {
      const result = buildCountQuery({ dateFrom: '2026-06-01', dateTo: '2026-06-30' });
      expect(result.sql).toContain('dueDate >= ?');
      expect(result.sql).toContain('dueDate <= ?');
      expect(result.params.length).toBe(2);
    });

    test('should build count query with all filters combined', () => {
      const result = buildCountQuery({
        query: 'search',
        status: 'completed',
        dateFrom: '2026-05-01',
        dateTo: '2026-06-30',
      });
      expect(result.sql).toContain('(title LIKE ? OR description LIKE ?)');
      expect(result.sql).toContain('status = ?');
      expect(result.sql).toContain('dueDate >= ?');
      expect(result.sql).toContain('dueDate <= ?');
      expect(result.params.length).toBe(5);
    });
  });
});
