import { describe, it, expect } from 'vitest';

function searchTasks(tasks, searchTerm, activeFilter) {
  let results = tasks;

  if (activeFilter !== 'all') {
    results = results.filter((task) => task.status === activeFilter);
  }

  if (searchTerm.trim()) {
    const lowerSearch = searchTerm.trim().toLowerCase();
    results = results.filter((task) =>
      task.title.toLowerCase().includes(lowerSearch) ||
      task.description.toLowerCase().includes(lowerSearch)
    );
  }

  return results;
}

describe('searchTasks', () => {
  const mockTasks = [
    {
      id: 1,
      title: 'Buy groceries',
      description: 'Milk, eggs, bread',
      status: 'pending',
      dueDate: '2026-06-10',
    },
    {
      id: 2,
      title: 'Review PR',
      description: 'Check code quality for feature branch',
      status: 'in-progress',
      dueDate: '2026-06-08',
    },
    {
      id: 3,
      title: 'Fix login bug',
      description: 'Users cannot reset password',
      status: 'pending',
      dueDate: '2026-06-07',
    },
    {
      id: 4,
      title: 'Deploy to production',
      description: 'Release v2.1 with new features',
      status: 'completed',
      dueDate: '2026-06-05',
    },
    {
      id: 5,
      title: 'Write documentation',
      description: 'API documentation for the new search feature',
      status: 'pending',
      dueDate: '2026-06-15',
    },
  ];

  it('UT-01: Returns all tasks when query is empty', () => {
    const result = searchTasks(mockTasks, '', 'all');
    expect(result).toHaveLength(5);
    expect(result).toEqual(mockTasks);
  });

  it('UT-02: Is case-insensitive', () => {
    const resultLower = searchTasks(mockTasks, 'milk', 'all');
    const resultUpper = searchTasks(mockTasks, 'MILK', 'all');
    const resultMixed = searchTasks(mockTasks, 'MiLk', 'all');

    expect(resultLower).toHaveLength(1);
    expect(resultUpper).toHaveLength(1);
    expect(resultMixed).toHaveLength(1);
    expect(resultLower[0].id).toBe(1);
  });

  it('UT-03: Matches both title and description', () => {
    const resultFromTitle = searchTasks(mockTasks, 'Buy', 'all');
    const resultFromDesc = searchTasks(mockTasks, 'eggs', 'all');

    expect(resultFromTitle).toHaveLength(1);
    expect(resultFromTitle[0].id).toBe(1);

    expect(resultFromDesc).toHaveLength(1);
    expect(resultFromDesc[0].id).toBe(1);
  });

  it('UT-04: Special characters handled correctly', () => {
    const result = searchTasks(mockTasks, 'v2.1', 'all');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(4);
  });

  it('UT-05: Whitespace trimmed correctly', () => {
    const result1 = searchTasks(mockTasks, '  bread  ', 'all');
    const result2 = searchTasks(mockTasks, 'bread', 'all');

    expect(result1).toEqual(result2);
    expect(result1).toHaveLength(1);
    expect(result1[0].id).toBe(1);
  });

  it('UT-06: Partial word matches work', () => {
    const result = searchTasks(mockTasks, 'doc', 'all');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(5);
  });

  it('TC-05: Returns empty array when no tasks match', () => {
    const result = searchTasks(mockTasks, 'nonexistent', 'all');
    expect(result).toHaveLength(0);
  });

  it('TC-06: Search respects active status filter (AND logic)', () => {
    const resultAll = searchTasks(mockTasks, 'fix', 'all');
    const resultPending = searchTasks(mockTasks, 'fix', 'pending');

    expect(resultAll).toHaveLength(1);
    expect(resultPending).toHaveLength(1);
    expect(resultPending[0].id).toBe(3);
  });

  it('TC-08: Multiple matches return all relevant tasks', () => {
    const result = searchTasks(mockTasks, 'feature', 'all');
    expect(result).toHaveLength(3);
    expect(result.map((t) => t.id).sort()).toEqual([2, 4, 5]);
  });

  it('TC-14: Consecutive searches work correctly', () => {
    let result = searchTasks(mockTasks, 'fix', 'all');
    expect(result).toHaveLength(1);

    result = searchTasks(mockTasks, 'fix login', 'all');
    expect(result).toHaveLength(1);

    result = searchTasks(mockTasks, 'login bug', 'all');
    expect(result).toHaveLength(1);
  });

  it('TC-15: Empty search input clears search', () => {
    const resultWithSearch = searchTasks(mockTasks, 'buy', 'all');
    const resultWithEmpty = searchTasks(mockTasks, '', 'all');

    expect(resultWithSearch).toHaveLength(1);
    expect(resultWithEmpty).toHaveLength(5);
  });

  it('Filter by status: pending', () => {
    const result = searchTasks(mockTasks, '', 'pending');
    expect(result).toHaveLength(3);
    expect(result.map((t) => t.id).sort()).toEqual([1, 3, 5]);
  });

  it('Filter by status: in-progress', () => {
    const result = searchTasks(mockTasks, '', 'in-progress');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });

  it('Filter by status: completed', () => {
    const result = searchTasks(mockTasks, '', 'completed');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(4);
  });

  it('Search + filter: find pending tasks with "buy"', () => {
    const result = searchTasks(mockTasks, 'buy', 'pending');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it('Search + filter: no results when search matches but status does not', () => {
    const result = searchTasks(mockTasks, 'deploy', 'pending');
    expect(result).toHaveLength(0);
  });
});
