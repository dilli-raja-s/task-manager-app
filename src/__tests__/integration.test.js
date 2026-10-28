import { jest } from '@jest/globals';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App.jsx';

// Wave 4 integration tests (Tasks 4.1 and 4.2): overdue count independence from filters,
// and overdue markers on the Task Board and search results when filters are applied.
// Due dates are fixed far-past/far-future values, plus a local "today" for the boundary case,
// so the tests do not depend on the run date.
const PAST = '2000-01-01T00:00:00.000Z';
const FUTURE = '2999-12-31T00:00:00.000Z';

function localToday() {
  const date = new Date();
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function makeTask(id, overrides = {}) {
  return {
    id,
    title: `Task ${id}`,
    description: `Description ${id}`,
    status: 'pending',
    dueDate: FUTURE,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// Simulates the search endpoint: applies the query (title or description, case-insensitive)
// and the status filter, so search results behave like the real API for these tests.
function applySearch(tasks, params) {
  const query = (params.get('query') || '').toLowerCase();
  const status = params.get('status');
  return tasks.filter((task) => {
    if (status && task.status !== status) return false;
    if (!query) return true;
    return task.title.toLowerCase().includes(query) || task.description.toLowerCase().includes(query);
  });
}

function installFetch(tasks) {
  global.fetch = jest.fn(async (url) => {
    const [path, qs] = String(url).split('?');
    if (path === '/api/tasks/search') {
      const params = new URLSearchParams(qs || '');
      const data = applySearch(tasks, params).map((task) => ({ ...task }));
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data,
          pagination: { page: 1, limit: 20, total: data.length, pages: data.length ? 1 : 0 },
        }),
      };
    }
    return { ok: true, status: 200, json: async () => tasks.map((task) => ({ ...task })) };
  });
}

async function renderApp(tasks) {
  installFetch(tasks);
  const view = render(<App />);
  await waitFor(() => expect(view.container.querySelector('.task-list .task-card')).not.toBeNull());
  // Let the initial search request settle so later state updates are not reported as stray act() work.
  await waitFor(() => expect(view.container.querySelector('.search-results')).not.toBeNull());
  return view;
}

function getOverdueCountFromAria(container) {
  return container.querySelector('.summary-grid .summary-card.alert').getAttribute('aria-label');
}

function getOverdueValue(container) {
  return container.querySelector('.summary-grid .summary-card.alert > strong').textContent;
}

function getBoardCard(container, title) {
  const heading = within(container.querySelector('.task-list')).getByRole('heading', { name: title, level: 3 });
  return heading.closest('article');
}

describe('Wave 4 integration: dashboard overdue count is independent of filters (Task 4.1)', () => {
  afterEach(() => {
    delete global.fetch;
    jest.restoreAllMocks();
  });

  test('Task 4.1 (manifest TC-027): search that excludes every overdue task leaves the dashboard count unchanged', async () => {
    const tasks = [
      makeTask(1, { title: 'Quarterly audit', dueDate: PAST, status: 'pending' }),
      makeTask(2, { title: 'Budget review', dueDate: PAST, status: 'in-progress' }),
      makeTask(3, { title: 'Team offsite', dueDate: FUTURE, status: 'pending' }),
    ];
    const { container } = await renderApp(tasks);

    expect(getOverdueCountFromAria(container)).toBe('2 overdue tasks');

    // Search for a term that only matches the non-overdue task.
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Search tasks by title or description...'), 'offsite');

    await waitFor(() => expect(container.querySelector('.results-list')).not.toBeNull());
    await waitFor(() => expect(container.querySelectorAll('.results-list .result-item')).toHaveLength(1));
    expect(container.querySelector('.results-list .overdue-indicator')).toBeNull();

    // Dashboard still counts all overdue tasks, not the search result set.
    expect(getOverdueCountFromAria(container)).toBe('2 overdue tasks');
    expect(getOverdueValue(container)).toBe('2');
  });
});

describe('Wave 4 integration: dashboard overdue count vs status filter (Task 4.1, manifest TC-028)', () => {
  afterEach(() => {
    delete global.fetch;
    jest.restoreAllMocks();
  });

  test('applying the Completed status filter keeps the dashboard at the total overdue count', async () => {
    const tasks = [
      makeTask(1, { dueDate: PAST, status: 'pending' }),
      makeTask(2, { dueDate: PAST, status: 'in-progress' }),
      makeTask(3, { dueDate: PAST, status: 'completed' }),
      makeTask(4, { dueDate: FUTURE, status: 'completed' }),
    ];
    const { container } = await renderApp(tasks);

    // Tasks 1 and 2 are overdue; the completed past-due task 3 is not overdue.
    expect(getOverdueCountFromAria(container)).toBe('2 overdue tasks');

    fireEvent.click(screen.getByRole('button', { name: 'Completed' }));

    // Task Board narrows to the two completed tasks. A count tied to this view would drop to 0,
    // so the dashboard must still show the total overdue count.
    await waitFor(() => expect(container.querySelectorAll('.task-list .task-card')).toHaveLength(2));
    expect(getOverdueCountFromAria(container)).toBe('2 overdue tasks');
    expect(getOverdueValue(container)).toBe('2');
  });
});

describe('Wave 4 integration: markers with filters (Task 4.2)', () => {
  afterEach(() => {
    delete global.fetch;
    jest.restoreAllMocks();
  });

  test('Task 4.2 (manifest TC-029): Pending filter marks only overdue pending tasks; due-today is not marked', async () => {
    const today = localToday();
    const tasks = [
      makeTask(1, { dueDate: PAST, status: 'pending' }),
      makeTask(2, { dueDate: today, status: 'pending' }),
      makeTask(3, { dueDate: FUTURE, status: 'pending' }),
      makeTask(4, { dueDate: PAST, status: 'completed' }),
    ];
    const { container } = await renderApp(tasks);

    fireEvent.click(screen.getByRole('button', { name: 'Pending' }));

    const board = container.querySelector('.task-list');
    await waitFor(() => expect(within(board).queryByRole('heading', { name: 'Task 4', level: 3 })).toBeNull());

    expect(getBoardCard(container, 'Task 1')).toHaveClass('overdue');
    expect(getBoardCard(container, 'Task 2')).not.toHaveClass('overdue');
    expect(getBoardCard(container, 'Task 3')).not.toHaveClass('overdue');
    expect(board.querySelectorAll('.overdue-indicator')).toHaveLength(1);
    expect(within(getBoardCard(container, 'Task 2')).queryByRole('img', { name: 'Overdue' })).toBeNull();
  });

  test('Task 4.2 (manifest TC-030): search results show the same overdue marker as the Task Board', async () => {
    const tasks = [
      makeTask(1, { title: 'Release notes', description: 'ship it', dueDate: PAST, status: 'pending' }),
      makeTask(2, { title: 'Release party', description: 'celebrate', dueDate: FUTURE, status: 'pending' }),
    ];
    const { container } = await renderApp(tasks);

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText('Search tasks by title or description...'), 'release');

    await waitFor(() => expect(container.querySelectorAll('.results-list .result-item')).toHaveLength(2));

    const resultOverdue = container.querySelector('.results-list .result-item .task-result-card.overdue');
    expect(resultOverdue).not.toBeNull();
    expect(resultOverdue).toHaveTextContent('Release notes');
    expect(within(resultOverdue).getByRole('img', { name: 'Overdue' })).toBeInTheDocument();

    // Same task on the Task Board is marked the same way.
    expect(getBoardCard(container, 'Release notes')).toHaveClass('overdue');
    expect(getBoardCard(container, 'Release party')).not.toHaveClass('overdue');

    const resultMarkers = container.querySelectorAll('.results-list .overdue-indicator');
    expect(resultMarkers).toHaveLength(1);
    expect(resultMarkers[0].outerHTML).toBe(container.querySelector('.task-list .overdue-indicator').outerHTML);
  });
});
