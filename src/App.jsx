import { useEffect, useMemo, useState } from 'react';
import SearchBar from './components/SearchBar.jsx';
import SearchResults from './components/SearchResults.jsx';
import SummaryCard from './components/SummaryCard.jsx';
import { isOverdue } from './utils/overdue.js';
import { getOverdueIcon } from './utils/svg-icons.jsx';

const emptyForm = {
  title: '',
  description: '',
  status: 'pending',
  dueDate: '',
};

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

// Per-task overdue check for card markers. A failure leaves the card unmarked
// instead of breaking the board render (F-1).
function isTaskOverdue(task) {
  try {
    return isOverdue(task.dueDate, task.status);
  } catch (error) {
    console.warn(`Error checking overdue status for task ${task.id}:`, error);
    return false;
  }
}

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [activeFilter, setActiveFilter] = useState('all');
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // Search/filter state
  const [searchFilters, setSearchFilters] = useState({
    query: '',
    status: 'all',
    dateFrom: null,
    dateTo: null,
    sortBy: 'dueDate',
    order: 'asc',
    page: 1,
    limit: 20,
  });
  const [searchResults, setSearchResults] = useState({
    tasks: [],
    loading: false,
    error: null,
    pagination: { page: 1, limit: 20, total: 0, pages: 0 },
  });

  // Load all tasks on mount
  useEffect(() => {
    loadTasks();
  }, []);

  // Fetch search results when filters change
  useEffect(() => {
    fetchSearchResults();
  }, [searchFilters]);

  const filteredTasks = useMemo(() => {
    if (activeFilter === 'all') {
      return tasks;
    }
    return tasks.filter((task) => task.status === activeFilter);
  }, [activeFilter, tasks]);

  const summary = useMemo(() => {
    return {
      total: tasks.length,
      pending: tasks.filter((task) => task.status === 'pending').length,
      inProgress: tasks.filter((task) => task.status === 'in-progress').length,
      completed: tasks.filter((task) => task.status === 'completed').length,
    };
  }, [tasks]);

  const overdueSummary = useMemo(() => {
    try {
      return tasks.filter((task) => isOverdue(task.dueDate, task.status)).length;
    } catch (error) {
      console.warn('Error calculating overdue count:', error);
      return 0;
    }
  }, [tasks]);

  async function loadTasks() {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const response = await fetch('/api/tasks');
      if (!response.ok) {
        throw new Error('Failed to fetch tasks.');
      }

      const data = await response.json();
      setTasks(data);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchSearchResults() {
    setSearchResults((prev) => ({
      ...prev,
      loading: true,
      error: null,
    }));

    try {
      const params = new URLSearchParams();
      if (searchFilters.query) params.append('query', searchFilters.query);
      if (searchFilters.status !== 'all') params.append('status', searchFilters.status);
      if (searchFilters.dateFrom) params.append('dateFrom', searchFilters.dateFrom);
      if (searchFilters.dateTo) params.append('dateTo', searchFilters.dateTo);
      params.append('sortBy', searchFilters.sortBy);
      params.append('order', searchFilters.order);
      params.append('page', searchFilters.page);
      params.append('limit', searchFilters.limit);

      const response = await fetch(`/api/tasks/search?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to search tasks.');
      }

      const data = await response.json();
      setSearchResults({
        tasks: data.data || [],
        loading: false,
        error: null,
        pagination: data.pagination || { page: 1, limit: 20, total: 0, pages: 0 },
      });
    } catch (error) {
      setSearchResults((prev) => ({
        ...prev,
        loading: false,
        error: error.message,
        tasks: [],
      }));
    }
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingTaskId(null);
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');

    const method = editingTaskId ? 'PUT' : 'POST';
    const endpoint = editingTaskId ? `/api/tasks/${editingTaskId}` : '/api/tasks';

    try {
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? 'Unable to save task.');
      }

      await loadTasks();
      resetForm();
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function startEditing(task) {
    setEditingTaskId(task.id);
    setForm({
      title: task.title,
      description: task.description,
      status: task.status,
      dueDate: task.dueDate.slice(0, 10),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleDelete(taskId) {
    setErrorMessage('');

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? 'Unable to delete task.');
      }

      if (editingTaskId === taskId) {
        resetForm();
      }

      await loadTasks();
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  function handleSearchChange(query) {
    setSearchFilters((prev) => ({
      ...prev,
      query,
      page: 1, // Reset to page 1 when search changes
    }));
  }

  function handleSearchClear() {
    setSearchFilters({
      query: '',
      status: 'all',
      dateFrom: null,
      dateTo: null,
      sortBy: 'dueDate',
      order: 'asc',
      page: 1,
      limit: 20,
    });
  }

  function handlePageChange(newPage) {
    setSearchFilters((prev) => ({
      ...prev,
      page: newPage,
    }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="app-shell">
      <div className="backdrop backdrop-one" />
      <div className="backdrop backdrop-two" />
      <main className="page">
        <section className="hero-card">
          <div>
            <h1>Task Manager</h1>
            <p className="hero-copy">
              Organize work with clear task titles, detailed descriptions, status tracking, and visible deadlines.
            </p>
          </div>
          <div className="summary-grid">
            <SummaryCard
              label="Overdue"
              value={overdueSummary}
              tone="alert"
              ariaLabel={`${overdueSummary} overdue tasks`}
            />
            <SummaryCard label="All Tasks" value={summary.total} tone="sun" />
            <SummaryCard label="Pending" value={summary.pending} tone="sand" />
            <SummaryCard label="In Progress" value={summary.inProgress} tone="mint" />
            <SummaryCard label="Completed" value={summary.completed} tone="ink" />
          </div>
        </section>

        <section className="content-grid">
          <article className="panel form-panel">
            <div className="panel-heading">
              <div>
                <p className="section-kicker">Task Editor</p>
                <h2>{editingTaskId ? 'Update task' : 'Create a task'}</h2>
              </div>
              {editingTaskId ? (
                <button className="ghost-button" type="button" onClick={resetForm}>
                  Clear form
                </button>
              ) : null}
            </div>

            <form className="task-form" onSubmit={handleSubmit}>
              <label>
                <span>Title</span>
                <input
                  name="title"
                  placeholder="Prepare sprint review"
                  value={form.title}
                  onChange={handleChange}
                  required
                />
              </label>

              <label>
                <span>Description</span>
                <textarea
                  name="description"
                  rows="5"
                  placeholder="Add the agenda, gather metrics, and confirm demo owners."
                  value={form.description}
                  onChange={handleChange}
                  required
                />
              </label>

              <div className="form-row">
                <label>
                  <span>Status</span>
                  <select name="status" value={form.status} onChange={handleChange}>
                    <option value="pending">Pending</option>
                    <option value="in-progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </label>

                <label>
                  <span>Due Date</span>
                  <input name="dueDate" type="date" value={form.dueDate} onChange={handleChange} required />
                </label>
              </div>

              <button className="primary-button" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : editingTaskId ? 'Save changes' : 'Add task'}
              </button>
            </form>

            {errorMessage ? <p className="message error-message">{errorMessage}</p> : null}
          </article>

          <article className="panel list-panel">
            <div className="panel-heading panel-heading-stack">
              <div>
                <p className="section-kicker">Task Search & Filtering</p>
                <h2>Find tasks</h2>
              </div>
            </div>

            {/* Search Bar */}
            <SearchBar
              value={searchFilters.query}
              onChange={handleSearchChange}
              onClear={handleSearchClear}
              placeholder="Search tasks by title or description..."
            />

            {/* Search Results */}
            <SearchResults
              tasks={searchResults.tasks}
              loading={searchResults.loading}
              error={searchResults.error}
              pagination={searchResults.pagination}
              onPageChange={handlePageChange}
              onRetry={fetchSearchResults}
            />

            {/* Task List (Legacy View) */}
            <div className="panel-heading panel-heading-stack" style={{ marginTop: '2rem' }}>
              <div>
                <p className="section-kicker">Task Board</p>
                <h2>All tasks</h2>
              </div>
              <div className="filter-group" role="group" aria-label="Task filters">
                {['all', 'pending', 'in-progress', 'completed'].map((filter) => (
                  <button
                    key={filter}
                    className={filter === activeFilter ? 'filter-chip active' : 'filter-chip'}
                    type="button"
                    aria-pressed={filter === activeFilter}
                    onClick={() => setActiveFilter(filter)}
                  >
                    {filter === 'all' ? 'All' : statusLabels[filter]}
                  </button>
                ))}
              </div>
            </div>

            {isLoading ? <p className="message">Loading tasks...</p> : null}

            {!isLoading && filteredTasks.length === 0 ? (
              <div className="empty-state">
                <h3>No tasks in this view</h3>
                <p>Create a task or switch filters to see more work items.</p>
              </div>
            ) : null}

            <div className="task-list">
              {filteredTasks.map((task) => {
                const overdue = isTaskOverdue(task);
                return (
                  <article className={overdue ? 'task-card overdue' : 'task-card'} key={task.id}>
                    {overdue ? (
                      <div className="overdue-indicator" role="img" aria-label="Overdue">
                        {getOverdueIcon()}
                      </div>
                    ) : null}

                    <div className="task-card-top">
                      <span className={`status-pill ${task.status}`}>{statusLabels[task.status]}</span>
                      <span className="due-date">Due {formatDueDate(task.dueDate)}</span>
                    </div>

                    <div className="task-card-body">
                      <h3>{task.title}</h3>
                      <p>{task.description}</p>
                    </div>

                    <div className="task-actions">
                      <button className="ghost-button" type="button" onClick={() => startEditing(task)}>
                        Edit
                      </button>
                      <button className="danger-button" type="button" onClick={() => handleDelete(task.id)}>
                        Delete
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}
