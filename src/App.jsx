import { useEffect, useMemo, useState } from 'react';
import { ApiError, getSession, login, logout, register, request } from './api/client';

const emptyTaskForm = {
  title: '',
  description: '',
  status: 'pending',
  dueDate: '',
};

const emptyAuthForm = {
  email: '',
  password: '',
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
  const [taskForm, setTaskForm] = useState(emptyTaskForm);
  const [authForm, setAuthForm] = useState(emptyAuthForm);
  const [activeFilter, setActiveFilter] = useState('all');
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [taskError, setTaskError] = useState('');

  const [authState, setAuthState] = useState('checking');
  const [authMode, setAuthMode] = useState('login');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    bootstrapSession();
  }, []);

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

  async function bootstrapSession() {
    setAuthState('checking');
    setAuthError('');

    try {
      const session = await getSession();

      if (session.authenticated) {
        setCurrentUser(session.user);
        setAuthState('authenticated');
        await loadTasks();
        return;
      }

      setCurrentUser(null);
      setAuthState('unauthenticated');
    } catch (error) {
      setCurrentUser(null);
      setAuthState('unauthenticated');
      setAuthError('Unable to verify session. Please sign in.');
    }
  }

  async function loadTasks() {
    setIsLoadingTasks(true);
    setTaskError('');

    try {
      const data = await request('/api/tasks');
      setTasks(data);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setCurrentUser(null);
        setAuthState('unauthenticated');
        setTaskError('Your session has expired. Please sign in again.');
        return;
      }

      setTaskError(error.message);
    } finally {
      setIsLoadingTasks(false);
    }
  }

  function resetTaskForm() {
    setTaskForm(emptyTaskForm);
    setEditingTaskId(null);
  }

  function handleTaskChange(event) {
    const { name, value } = event.target;
    setTaskForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  function handleAuthChange(event) {
    const { name, value } = event.target;
    setAuthForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setIsAuthenticating(true);
    setAuthError('');

    try {
      if (authMode === 'register') {
        await register(authForm);
      }

      const user = await login(authForm);
      setCurrentUser(user);
      setAuthState('authenticated');
      setAuthForm(emptyAuthForm);
      await loadTasks();
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setIsAuthenticating(false);
    }
  }

  async function handleLogout() {
    setAuthError('');
    setTaskError('');

    try {
      await logout();
      setCurrentUser(null);
      setTasks([]);
      setAuthState('unauthenticated');
      setAuthMode('login');
      resetTaskForm();
    } catch (error) {
      setAuthError(error.message);
    }
  }

  async function handleTaskSubmit(event) {
    event.preventDefault();
    setIsSubmittingTask(true);
    setTaskError('');

    const method = editingTaskId ? 'PUT' : 'POST';
    const endpoint = editingTaskId ? `/api/tasks/${editingTaskId}` : '/api/tasks';

    try {
      await request(endpoint, {
        method,
        body: taskForm,
      });
      await loadTasks();
      resetTaskForm();
    } catch (error) {
      setTaskError(error.message);
    } finally {
      setIsSubmittingTask(false);
    }
  }

  function startEditing(task) {
    setEditingTaskId(task.id);
    setTaskForm({
      title: task.title,
      description: task.description,
      status: task.status,
      dueDate: task.dueDate.slice(0, 10),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleDelete(taskId) {
    setTaskError('');

    try {
      await request(`/api/tasks/${taskId}`, {
        method: 'DELETE',
      });

      if (editingTaskId === taskId) {
        resetTaskForm();
      }

      await loadTasks();
    } catch (error) {
      setTaskError(error.message);
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
              Keep your work private with secure sign-in, per-user task ownership, and session-aware access.
            </p>
            {currentUser ? <p className="auth-hint">Signed in as {currentUser.email}</p> : null}
          </div>
          <div className="summary-grid">
            <SummaryCard label="All Tasks" value={summary.total} tone="sun" />
            <SummaryCard label="Pending" value={summary.pending} tone="sand" />
            <SummaryCard label="In Progress" value={summary.inProgress} tone="mint" />
            <SummaryCard label="Completed" value={summary.completed} tone="ink" />
          </div>
        </section>

        {authState === 'checking' ? <p className="message">Checking your session...</p> : null}

        {authState !== 'authenticated' && authState !== 'checking' ? (
          <section className="panel auth-panel">
            <div className="panel-heading">
              <div>
                <p className="section-kicker">Authentication</p>
                <h2>{authMode === 'login' ? 'Sign in' : 'Create account'}</h2>
              </div>
              <button
                className="ghost-button"
                type="button"
                onClick={() => {
                  setAuthMode((currentMode) => (currentMode === 'login' ? 'register' : 'login'));
                  setAuthError('');
                }}
              >
                {authMode === 'login' ? 'Need an account?' : 'Already registered?'}
              </button>
            </div>

            <form className="task-form" onSubmit={handleAuthSubmit}>
              <label>
                <span>Email</span>
                <input
                  type="email"
                  name="email"
                  value={authForm.email}
                  onChange={handleAuthChange}
                  autoComplete="email"
                  required
                />
              </label>

              <label>
                <span>Password</span>
                <input
                  type="password"
                  name="password"
                  value={authForm.password}
                  onChange={handleAuthChange}
                  autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                  required
                />
              </label>

              <button className="primary-button" type="submit" disabled={isAuthenticating}>
                {isAuthenticating
                  ? 'Submitting...'
                  : authMode === 'login'
                    ? 'Sign in'
                    : 'Register and sign in'}
              </button>
            </form>

            {authError ? <p className="message error-message">{authError}</p> : null}
          </section>
        ) : null}

        {authState === 'authenticated' ? (
          <>
            <div className="panel toolbar-panel">
              <p className="message">Your task data is private to this account.</p>
              <button className="ghost-button" type="button" onClick={handleLogout}>
                Logout
              </button>
            </div>

            <section className="content-grid">
              <article className="panel form-panel">
                <div className="panel-heading">
                  <div>
                    <p className="section-kicker">Task Editor</p>
                    <h2>{editingTaskId ? 'Update task' : 'Create a task'}</h2>
                  </div>
                  {editingTaskId ? (
                    <button className="ghost-button" type="button" onClick={resetTaskForm}>
                      Clear form
                    </button>
                  ) : null}
                </div>

                <form className="task-form" onSubmit={handleTaskSubmit}>
                  <label>
                    <span>Title</span>
                    <input
                      name="title"
                      placeholder="Prepare sprint review"
                      value={taskForm.title}
                      onChange={handleTaskChange}
                      required
                    />
                  </label>

                  <label>
                    <span>Description</span>
                    <textarea
                      name="description"
                      rows="5"
                      placeholder="Add the agenda, gather metrics, and confirm demo owners."
                      value={taskForm.description}
                      onChange={handleTaskChange}
                      required
                    />
                  </label>

                  <div className="form-row">
                    <label>
                      <span>Status</span>
                      <select name="status" value={taskForm.status} onChange={handleTaskChange}>
                        <option value="pending">Pending</option>
                        <option value="in-progress">In Progress</option>
                        <option value="completed">Completed</option>
                      </select>
                    </label>

                    <label>
                      <span>Due Date</span>
                      <input
                        name="dueDate"
                        type="date"
                        value={taskForm.dueDate}
                        onChange={handleTaskChange}
                        required
                      />
                    </label>
                  </div>

                  <button className="primary-button" type="submit" disabled={isSubmittingTask}>
                    {isSubmittingTask ? 'Saving...' : editingTaskId ? 'Save changes' : 'Add task'}
                  </button>
                </form>

                {taskError ? <p className="message error-message">{taskError}</p> : null}
              </article>

              <article className="panel list-panel">
                <div className="panel-heading panel-heading-stack">
                  <div>
                    <p className="section-kicker">Task Board</p>
                    <h2>Current tasks</h2>
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

                {isLoadingTasks ? <p className="message">Loading tasks...</p> : null}

                {!isLoadingTasks && filteredTasks.length === 0 ? (
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
          </>
        ) : null}
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
