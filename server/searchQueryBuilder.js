/**
 * Search Query Builder Module
 * Constructs parameterized SQL queries for search, filtering, sorting, and pagination
 */

export function buildSearchQuery(filters = {}) {
  const {
    query = '',
    status = 'all',
    dateFrom = null,
    dateTo = null,
    sortBy = 'dueDate',
    order = 'asc',
    page = 1,
    limit = 20,
  } = filters;

  const params = [];
  const conditions = [];

  // Keyword search: title LIKE or description LIKE
  if (query && query.trim() !== '') {
    const searchTerm = `%${query.trim()}%`;
    conditions.push('(title LIKE ? OR description LIKE ?)');
    params.push(searchTerm, searchTerm);
  }

  // Status filter: only for single status (not 'all')
  if (status && status !== 'all') {
    conditions.push('status = ?');
    params.push(status);
  }

  // Date range filter
  if (dateFrom) {
    conditions.push('dueDate >= ?');
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push('dueDate <= ?');
    params.push(dateTo);
  }

  // Build WHERE clause
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Validate and sanitize sort field
  const allowedSortFields = ['dueDate', 'title', 'status'];
  const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'dueDate';
  const safeOrder = order && order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

  // Validate pagination
  const safePage = Math.max(1, Math.floor(page) || 1);
  let safeLimit = Math.floor(limit) || 20;
  if (safeLimit > 100) {
    safeLimit = 100; // Cap at 100
  }
  if (safeLimit < 1) {
    safeLimit = 1;
  }

  const offset = (safePage - 1) * safeLimit;

  // Build final query
  const sql = `
    SELECT id, title, description, status, dueDate, createdAt, updatedAt
    FROM tasks
    ${whereClause}
    ORDER BY ${safeSortBy} ${safeOrder}
    LIMIT ? OFFSET ?
  `;

  params.push(safeLimit, offset);

  return { sql, params, page: safePage, limit: safeLimit };
}

export function buildCountQuery(filters = {}) {
  const {
    query = '',
    status = 'all',
    dateFrom = null,
    dateTo = null,
  } = filters;

  const params = [];
  const conditions = [];

  // Keyword search
  if (query && query.trim() !== '') {
    const searchTerm = `%${query.trim()}%`;
    conditions.push('(title LIKE ? OR description LIKE ?)');
    params.push(searchTerm, searchTerm);
  }

  // Status filter
  if (status && status !== 'all') {
    conditions.push('status = ?');
    params.push(status);
  }

  // Date range filter
  if (dateFrom) {
    conditions.push('dueDate >= ?');
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push('dueDate <= ?');
    params.push(dateTo);
  }

  // Build WHERE clause
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Build count query
  const sql = `SELECT COUNT(*) as count FROM tasks ${whereClause}`;

  return { sql, params };
}
