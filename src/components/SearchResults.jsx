/**
 * SearchResults Component
 * Displays paginated search results with loading, error, and empty states
 */
export function SearchResults({
  tasks = [],
  loading = false,
  error = null,
  pagination = { page: 1, limit: 20, total: 0, pages: 0 },
  onTaskSelect = () => {},
  onPageChange = () => {},
  onRetry = () => {},
}) {
  const statusLabels = {
    pending: 'Pending',
    'in-progress': 'In Progress',
    completed: 'Completed',
  };

  function formatDueDate(value) {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(value));
  }

  // Loading state
  if (loading) {
    return (
      <div className="search-results search-results-loading" role="status" aria-live="polite">
        <p className="message">Loading results...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="search-results search-results-error" role="alert" aria-live="assertive">
        <h3>Search failed</h3>
        <p className="message">{error}</p>
        <button className="primary-button" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }

  // Empty state
  if (tasks.length === 0) {
    return (
      <div className="search-results search-results-empty" role="status">
        <h3>No tasks found</h3>
        <p className="message">Try adjusting your search or filters.</p>
        <ul className="empty-state-suggestions">
          <li>Check your search spelling</li>
          <li>Try fewer or different filters</li>
          <li>Expand the date range</li>
        </ul>
      </div>
    );
  }

  // Results display
  return (
    <div className="search-results" role="region" aria-label="Search results">
      <div className="results-header">
        <p className="results-count" role="status">
          Showing {(pagination.page - 1) * pagination.limit + 1}–
          {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
          {pagination.total} tasks
        </p>
      </div>

      <ul className="results-list" role="list">
        {tasks.map((task) => (
          <li key={task.id} className="result-item" role="listitem">
            <article className="task-result-card">
              <div className="result-header">
                <h4 className="result-title">{task.title}</h4>
                <span className={`status-badge ${task.status}`}>
                  {statusLabels[task.status] || task.status}
                </span>
              </div>

              <p className="result-description">{task.description}</p>

              <div className="result-meta">
                <span className="due-date">Due {formatDueDate(task.dueDate)}</span>
                <span className="created-date">Created {formatDueDate(task.createdAt)}</span>
              </div>

              <button
                type="button"
                className="ghost-button result-action"
                onClick={() => onTaskSelect(task.id)}
              >
                View details
              </button>
            </article>
          </li>
        ))}
      </ul>

      {pagination.pages > 1 && (
        <div className="results-pagination" role="navigation" aria-label="Search results pagination">
          <button
            type="button"
            className="pagination-button"
            onClick={() => onPageChange(pagination.page - 1)}
            disabled={pagination.page === 1}
            aria-label="Previous page"
          >
            ← Previous
          </button>

          <span className="pagination-info" role="status">
            Page {pagination.page} of {pagination.pages}
          </span>

          <button
            type="button"
            className="pagination-button"
            onClick={() => onPageChange(pagination.page + 1)}
            disabled={pagination.page >= pagination.pages}
            aria-label="Next page"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

export default SearchResults;
