import { useEffect, useMemo, useState } from 'react';

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

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [activeFilter, setActiveFilter] = useState('all');
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadTasks();
  }, []);

  const filteredTasks = useMemo(() => {
    let results = tasks;

    if (activeFilter !== 'all') {
      results = results.filter((task) => task.status === activeFilter);
    }

    if (searchTerm.trim()) {
      const lowerSearch = searchTerm.toLowerCase();
      results = results.filter((task) =>
        task.title.toLowerCase().includes(lowerSearch) ||
        task.description.toLowerCase().includes(lowerSearch)
      );
    }

    return results;
  }, [activeFilter, searchTerm, tasks]);

  const summary = useMemo(() => {
    return {
      total: tasks.length,
      pending: tasks.filter((task) => task.status === 'pending').length,
      inProgress: tasks.filter((task) => task.status === 'in-progress').length,
      completed: tasks.filter((task) => task.status === 'completed').length,
    };
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

  function handleSearchChange(event) {
    setSearchTerm(event.target.value);
  }

  function handleSearchClear() {
    setSearchTerm('');
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
                <p className="section-kicker">Task Board</p>
                <h2>Current tasks</h2>
              </div>
              <div className="search-container">
                <input
                  type="text"
                  placeholder="Search tasks by title or description"
                  value={searchTerm}
                  onChange={handleSearchChange}
                  className="search-input"
                  aria-label="Search tasks"
                />
                {searchTerm && (
                  <button
                    type="button"
                    className="search-clear-button"
                    onClick={handleSearchClear}
                    aria-label="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className="filter-group" role="tablist" aria-label="Task filters">
                {['all', 'pending', 'in-progress', 'completed'].map((filter) => (
                  <button
                    key={filter}
                    className={filter === activeFilter ? 'filter-chip active' : 'filter-chip'}
                    type="button"
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
              {filteredTasks.map((task) => (
                <article className="task-card" key={task.id}>
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
              ))}
            </div>
          </article>
        </section>
      </main>
    </div>
  );
}

function SummaryCard({ label, value, tone }) {
  return (
    <div className={`summary-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}