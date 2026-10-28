import { jest } from '@jest/globals';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import App from '../App.jsx';

// Fixed due dates keep these tests independent of the run date.
const PAST = '2000-01-01T00:00:00.000Z';
const FUTURE = '2999-12-31T00:00:00.000Z';

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

function makeSearchPage(data = [], pagination = { page: 1, limit: 20, total: 0, pages: 0 }) {
  return { data, pagination };
}

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => body };
}

// Response whose body is not JSON (e.g. an HTML error page from a proxy).
function nonJsonResponse({ ok = false, status = 500 } = {}) {
  return {
    ok,
    status,
    json: async () => {
      throw new SyntaxError('Unexpected token < in JSON');
    },
  };
}

// Installs a fetch mock. `tasks` is the server-side list: tests mutate it to simulate
// server changes before the App reloads. Responses carry copies so React sees a new
// array on reload (returning the same reference would make setTasks a no-op).
// `routes` overrides handlers by "METHOD /path" key (query string excluded).
function installFetch({ tasks = [makeTask(1)], search = makeSearchPage(), routes = {} } = {}) {
  const fetchMock = jest.fn(async (url, init = {}) => {
    const method = init.method ?? 'GET';
    const path = String(url).split('?')[0];
    const route = routes[`${method} ${path}`];
    if (route) return route(url, init);
    if (method === 'GET' && path === '/api/tasks') return jsonResponse(tasks.map((task) => ({ ...task })));
    if (method === 'GET' && path === '/api/tasks/search') return jsonResponse(search);
    return jsonResponse({ error: `Unexpected request ${method} ${path}` }, { ok: false, status: 404 });
  });
  global.fetch = fetchMock;
  return fetchMock;
}

function callsTo(fetchMock, method, path) {
  return fetchMock.mock.calls.filter(
    ([url, init]) => (init?.method ?? 'GET') === method && String(url).split('?')[0] === path
  );
}

function searchParam(url, name) {
  return new URL(url, 'http://localhost').searchParams.get(name);
}

function fillTaskForm({ title, description, dueDate }) {
  if (title !== undefined) fireEvent.change(screen.getByLabelText('Title'), { target: { value: title } });
  if (description !== undefined) {
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: description } });
  }
  if (dueDate !== undefined) fireEvent.change(screen.getByLabelText('Due Date'), { target: { value: dueDate } });
}

function getTaskCard(title) {
  return screen.getByRole('heading', { name: title, level: 3 }).closest('article');
}

// Renders the App and waits for the initial task list and search requests to settle,
// so no state update lands after a test finishes.
async function renderApp() {
  const view = render(<App />);
  await waitForSearchToSettle();
  return view;
}

async function waitForSearchToSettle() {
  await waitFor(() => {
    expect(screen.queryByText('Loading tasks...')).not.toBeInTheDocument();
    expect(screen.queryByText('Loading results...')).not.toBeInTheDocument();
  });
}

function getSearchInput() {
  return screen.getByRole('textbox', { name: /search tasks by keyword/i });
}

describe('App task management and search', () => {
  beforeEach(() => {
    jest.spyOn(window, 'scrollTo').mockImplementation(() => {});
  });

  afterEach(() => {
    delete global.fetch;
    jest.restoreAllMocks();
  });

  describe('loading tasks', () => {
    test('shows the server error message when the task list request is not OK (no TC-n; pre-existing path)', async () => {
      installFetch({ routes: { 'GET /api/tasks': () => jsonResponse({}, { ok: false, status: 500 }) } });

      await renderApp();

      expect(await screen.findByText('Failed to fetch tasks.')).toHaveClass('error-message');
      expect(screen.queryByText('Loading tasks...')).not.toBeInTheDocument();
      expect(screen.getByText('No tasks in this view')).toBeInTheDocument();
    });

    test('shows the network error message when the task list request rejects (no TC-n; pre-existing path)', async () => {
      installFetch({
        routes: {
          'GET /api/tasks': () => {
            throw new Error('Network down');
          },
        },
      });

      await renderApp();

      expect(await screen.findByText('Network down')).toHaveClass('error-message');
      expect(screen.queryByText('Loading tasks...')).not.toBeInTheDocument();
    });

    test('renders fetched tasks in the board with their status and formatted due date (no TC-n; pre-existing path)', async () => {
      // Midday UTC keeps the calendar day stable in any local timezone.
      installFetch({ tasks: [makeTask(1, { title: 'Write report', dueDate: '2999-12-31T12:00:00.000Z' })] });

      await renderApp();

      const card = await waitFor(() => getTaskCard('Write report'));
      expect(within(card).getByText('Pending')).toBeInTheDocument();
      expect(within(card).getByText(/^Due [A-Z][a-z]{2} \d{1,2}, 2999$/)).toBeInTheDocument();
    });
  });

  describe('creating and editing tasks', () => {
    test('creates a task with POST, reloads the list, and resets the form (no TC-n; pre-existing path)', async () => {
      const tasks = [makeTask(1)];
      const fetchMock = installFetch({
        tasks,
        routes: {
          'POST /api/tasks': (url, init) => {
            const body = JSON.parse(init.body);
            tasks.push(makeTask(2, { title: body.title }));
            return jsonResponse({ id: 2 }, { status: 201 });
          },
        },
      });

      await renderApp();
      await screen.findByText('Task 1');

      fillTaskForm({ title: 'New task', description: 'Details', dueDate: '2999-12-31' });
      fireEvent.click(screen.getByRole('button', { name: 'Add task' }));

      await screen.findByText('New task');
      const [, init] = callsTo(fetchMock, 'POST', '/api/tasks')[0];
      expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
      expect(JSON.parse(init.body)).toEqual({
        title: 'New task',
        description: 'Details',
        status: 'pending',
        dueDate: '2999-12-31',
      });
      // The form resets after the reload completes, which can land a tick after the card renders.
      await waitFor(() => expect(screen.getByLabelText('Title')).toHaveValue(''));
      expect(screen.getByRole('heading', { name: 'Create a task' })).toBeInTheDocument();
    });

    test('shows the server error message when saving a new task is rejected (no TC-n; pre-existing path)', async () => {
      installFetch({
        routes: {
          'POST /api/tasks': () => jsonResponse({ error: 'Title already exists' }, { ok: false, status: 409 }),
        },
      });

      await renderApp();
      await screen.findByText('Task 1');

      fillTaskForm({ title: 'Dup', description: 'Details', dueDate: '2999-12-31' });
      fireEvent.click(screen.getByRole('button', { name: 'Add task' }));

      expect(await screen.findByText('Title already exists')).toHaveClass('error-message');
      // The form keeps the user's input so they can correct it.
      expect(screen.getByLabelText('Title')).toHaveValue('Dup');
    });

    test('falls back to a generic message when a rejected save has no JSON body (no TC-n; pre-existing path)', async () => {
      installFetch({
        routes: {
          'POST /api/tasks': () => nonJsonResponse({ status: 502 }),
        },
      });

      await renderApp();
      await screen.findByText('Task 1');

      fillTaskForm({ title: 'Dup', description: 'Details', dueDate: '2999-12-31' });
      fireEvent.click(screen.getByRole('button', { name: 'Add task' }));

      expect(await screen.findByText('Unable to save task.')).toBeInTheDocument();
    });

    test('shows the network error message when saving rejects (no TC-n; pre-existing path)', async () => {
      installFetch({
        routes: {
          'POST /api/tasks': () => {
            throw new Error('Connection reset');
          },
        },
      });

      await renderApp();
      await screen.findByText('Task 1');

      fillTaskForm({ title: 'New', description: 'Details', dueDate: '2999-12-31' });
      fireEvent.click(screen.getByRole('button', { name: 'Add task' }));

      expect(await screen.findByText('Connection reset')).toHaveClass('error-message');
    });

    test('disables the submit button and shows "Saving..." while the request is in flight (no TC-n; pre-existing path)', async () => {
      let resolveSave;
      installFetch({
        routes: {
          'POST /api/tasks': () =>
            new Promise((resolve) => {
              resolveSave = () => resolve(jsonResponse({ id: 2 }, { status: 201 }));
            }),
        },
      });

      await renderApp();
      await screen.findByText('Task 1');

      fillTaskForm({ title: 'Slow', description: 'Details', dueDate: '2999-12-31' });
      fireEvent.click(screen.getByRole('button', { name: 'Add task' }));

      const savingButton = await screen.findByRole('button', { name: 'Saving...' });
      expect(savingButton).toBeDisabled();

      resolveSave();
      await waitFor(() => expect(screen.getByRole('button', { name: 'Add task' })).toBeEnabled());
    });

    test('Edit fills the form with the task values and scrolls to the top (no TC-n; pre-existing path)', async () => {
      installFetch({ tasks: [makeTask(1, { title: 'Draft plan', description: 'Outline', status: 'in-progress', dueDate: FUTURE })] });

      await renderApp();
      await screen.findByText('Draft plan');

      fireEvent.click(within(getTaskCard('Draft plan')).getByRole('button', { name: 'Edit' }));

      expect(screen.getByRole('heading', { name: 'Update task' })).toBeInTheDocument();
      expect(screen.getByLabelText('Title')).toHaveValue('Draft plan');
      expect(screen.getByLabelText('Description')).toHaveValue('Outline');
      expect(screen.getByLabelText('Status')).toHaveValue('in-progress');
      expect(screen.getByLabelText('Due Date')).toHaveValue('2999-12-31');
      expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
      expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    });

    test('Clear form cancels editing and restores the create state (no TC-n; pre-existing path)', async () => {
      installFetch();

      await renderApp();
      await screen.findByText('Task 1');

      fireEvent.click(within(getTaskCard('Task 1')).getByRole('button', { name: 'Edit' }));
      fireEvent.click(screen.getByRole('button', { name: 'Clear form' }));

      expect(screen.getByRole('heading', { name: 'Create a task' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Clear form' })).not.toBeInTheDocument();
      expect(screen.getByLabelText('Title')).toHaveValue('');
      expect(screen.getByLabelText('Due Date')).toHaveValue('');
    });

    test('submitting an edited task sends PUT to that task and returns to create mode (no TC-n; pre-existing path)', async () => {
      const tasks = [makeTask(1, { title: 'Old title' })];
      const fetchMock = installFetch({
        tasks,
        routes: {
          'PUT /api/tasks/1': (url, init) => {
            tasks[0] = { ...tasks[0], ...JSON.parse(init.body) };
            return jsonResponse(tasks[0]);
          },
        },
      });

      await renderApp();
      await screen.findByText('Old title');

      fireEvent.click(within(getTaskCard('Old title')).getByRole('button', { name: 'Edit' }));
      fillTaskForm({ title: 'New title' });
      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

      await screen.findByText('New title');
      const [, init] = callsTo(fetchMock, 'PUT', '/api/tasks/1')[0];
      expect(JSON.parse(init.body).title).toBe('New title');
      expect(callsTo(fetchMock, 'POST', '/api/tasks')).toHaveLength(0);
      await waitFor(() =>
        expect(screen.getByRole('heading', { name: 'Create a task' })).toBeInTheDocument()
      );
    });

    test('a rejected edit shows the server error and keeps edit mode (no TC-n; pre-existing path)', async () => {
      installFetch({
        routes: {
          'PUT /api/tasks/1': () => jsonResponse({ error: 'Task is locked' }, { ok: false, status: 423 }),
        },
      });

      await renderApp();
      await screen.findByText('Task 1');

      fireEvent.click(within(getTaskCard('Task 1')).getByRole('button', { name: 'Edit' }));
      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

      expect(await screen.findByText('Task is locked')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Update task' })).toBeInTheDocument();
    });
  });

  describe('deleting tasks', () => {
    test('Delete removes the task on the server and reloads the list (no TC-n; pre-existing path)', async () => {
      const tasks = [makeTask(1), makeTask(2)];
      const fetchMock = installFetch({
        tasks,
        routes: {
          'DELETE /api/tasks/2': () => {
            tasks.splice(1, 1);
            return jsonResponse({}, { status: 204 });
          },
        },
      });

      await renderApp();
      await screen.findByText('Task 2');

      fireEvent.click(within(getTaskCard('Task 2')).getByRole('button', { name: 'Delete' }));

      await waitFor(() => expect(screen.queryByText('Task 2')).not.toBeInTheDocument());
      expect(callsTo(fetchMock, 'DELETE', '/api/tasks/2')).toHaveLength(1);
      expect(screen.getByText('Task 1')).toBeInTheDocument();
    });

    test('deleting the task currently being edited clears the form (no TC-n; pre-existing path)', async () => {
      const tasks = [makeTask(1, { title: 'Editing me' })];
      installFetch({
        tasks,
        routes: {
          'DELETE /api/tasks/1': () => {
            tasks.length = 0;
            return jsonResponse({}, { status: 204 });
          },
        },
      });

      await renderApp();
      await screen.findByText('Editing me');

      fireEvent.click(within(getTaskCard('Editing me')).getByRole('button', { name: 'Edit' }));
      expect(screen.getByRole('heading', { name: 'Update task' })).toBeInTheDocument();

      fireEvent.click(within(getTaskCard('Editing me')).getByRole('button', { name: 'Delete' }));

      await waitFor(() => expect(screen.queryByText('Editing me')).not.toBeInTheDocument());
      expect(screen.getByRole('heading', { name: 'Create a task' })).toBeInTheDocument();
      expect(screen.getByLabelText('Title')).toHaveValue('');
    });

    test('deleting a different task keeps the edit form populated (no TC-n; pre-existing path)', async () => {
      const tasks = [makeTask(1, { title: 'Keep editing' }), makeTask(2, { title: 'Remove me' })];
      installFetch({
        tasks,
        routes: {
          'DELETE /api/tasks/2': () => {
            tasks.splice(1, 1);
            return jsonResponse({}, { status: 204 });
          },
        },
      });

      await renderApp();
      await screen.findByText('Remove me');

      fireEvent.click(within(getTaskCard('Keep editing')).getByRole('button', { name: 'Edit' }));
      fireEvent.click(within(getTaskCard('Remove me')).getByRole('button', { name: 'Delete' }));

      await waitFor(() => expect(screen.queryByText('Remove me')).not.toBeInTheDocument());
      expect(screen.getByRole('heading', { name: 'Update task' })).toBeInTheDocument();
      expect(screen.getByLabelText('Title')).toHaveValue('Keep editing');
    });

    test('shows the server error message when delete is rejected with a JSON body (no TC-n; pre-existing path)', async () => {
      installFetch({
        routes: {
          'DELETE /api/tasks/1': () => jsonResponse({ error: 'Cannot delete archived task' }, { ok: false, status: 403 }),
        },
      });

      await renderApp();
      await screen.findByText('Task 1');

      fireEvent.click(within(getTaskCard('Task 1')).getByRole('button', { name: 'Delete' }));

      expect(await screen.findByText('Cannot delete archived task')).toHaveClass('error-message');
      expect(screen.getByText('Task 1')).toBeInTheDocument();
    });

    test('falls back to a generic message when a rejected delete has no JSON body (no TC-n; pre-existing path)', async () => {
      installFetch({
        routes: {
          'DELETE /api/tasks/1': () => nonJsonResponse({ status: 500 }),
        },
      });

      await renderApp();
      await screen.findByText('Task 1');

      fireEvent.click(within(getTaskCard('Task 1')).getByRole('button', { name: 'Delete' }));

      expect(await screen.findByText('Unable to delete task.')).toBeInTheDocument();
    });

    test('shows the network error message when delete rejects (no TC-n; pre-existing path)', async () => {
      installFetch({
        routes: {
          'DELETE /api/tasks/1': () => {
            throw new Error('Socket hang up');
          },
        },
      });

      await renderApp();
      await screen.findByText('Task 1');

      fireEvent.click(within(getTaskCard('Task 1')).getByRole('button', { name: 'Delete' }));

      expect(await screen.findByText('Socket hang up')).toHaveClass('error-message');
    });
  });

  describe('search', () => {
    test('typing in the search box debounces and requests results with the query (no TC-n; pre-existing path)', async () => {
      const fetchMock = installFetch({
        search: makeSearchPage([makeTask(9, { title: 'Quarterly report' })], {
          page: 1,
          limit: 20,
          total: 1,
          pages: 1,
        }),
      });

      await renderApp();
      await screen.findByText('Task 1');

      fireEvent.change(getSearchInput(), { target: { value: 'report' } });

      // The mock returns the same page for every request, so wait for the debounced
      // query request itself rather than for the rendered result.
      await waitFor(() => {
        const queries = callsTo(fetchMock, 'GET', '/api/tasks/search').map(([url]) => searchParam(url, 'query'));
        expect(queries).toContain('report');
      });
      expect(await screen.findByText('Quarterly report')).toBeInTheDocument();
      expect(screen.getByText('Showing 1–1 of 1 tasks')).toBeInTheDocument();
    });

    test('Escape in the search box clears the query and resets the search request (no TC-n; pre-existing path)', async () => {
      const fetchMock = installFetch();

      await renderApp();
      await screen.findByText('Task 1');

      const input = getSearchInput();
      fireEvent.change(input, { target: { value: 'budget' } });
      await waitFor(() =>
        expect(callsTo(fetchMock, 'GET', '/api/tasks/search').some(([url]) => searchParam(url, 'query') === 'budget')).toBe(true)
      );

      fireEvent.keyDown(input, { key: 'Escape' });
      await waitForSearchToSettle();

      expect(input).toHaveValue('');
      const lastSearch = callsTo(fetchMock, 'GET', '/api/tasks/search').at(-1)[0];
      expect(searchParam(lastSearch, 'query')).toBeNull();
      expect(searchParam(lastSearch, 'page')).toBe('1');
    });

    test('the Clear search button clears the query (no TC-n; pre-existing path)', async () => {
      installFetch();

      await renderApp();
      await screen.findByText('Task 1');

      const input = getSearchInput();
      fireEvent.change(input, { target: { value: 'temp' } });
      fireEvent.click(await screen.findByRole('button', { name: 'Clear search' }));
      await waitForSearchToSettle();

      expect(input).toHaveValue('');
      expect(screen.queryByRole('button', { name: 'Clear search' })).not.toBeInTheDocument();
    });

    test('shows the search error and retries the request on Retry (no TC-n; pre-existing path)', async () => {
      let searchAttempts = 0;
      const fetchMock = installFetch({
        routes: {
          'GET /api/tasks/search': () => {
            searchAttempts += 1;
            if (searchAttempts === 1) return jsonResponse({}, { ok: false, status: 500 });
            return jsonResponse(makeSearchPage([makeTask(7, { title: 'Recovered hit' })], { page: 1, limit: 20, total: 1, pages: 1 }));
          },
        },
      });

      await renderApp();

      expect(await screen.findByRole('heading', { name: 'Search failed' })).toBeInTheDocument();
      expect(screen.getByText('Failed to search tasks.')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

      expect(await screen.findByText('Recovered hit')).toBeInTheDocument();
      expect(callsTo(fetchMock, 'GET', '/api/tasks/search')).toHaveLength(2);
    });

    test('shows the network error message when the search request rejects (no TC-n; pre-existing path)', async () => {
      installFetch({
        routes: {
          'GET /api/tasks/search': () => {
            throw new Error('Search backend unavailable');
          },
        },
      });

      await renderApp();

      expect(await screen.findByText('Search backend unavailable')).toBeInTheDocument();
    });

    test('defaults to empty results and pagination when the search payload omits them (no TC-n; pre-existing path)', async () => {
      installFetch({ routes: { 'GET /api/tasks/search': () => jsonResponse({}) } });

      await renderApp();

      expect(await screen.findByRole('heading', { name: 'No tasks found' })).toBeInTheDocument();
      expect(screen.queryByRole('navigation', { name: 'Search results pagination' })).not.toBeInTheDocument();
    });

    test('paginates the search results with Next and Previous and scrolls to the top (no TC-n; pre-existing path)', async () => {
      const fetchMock = installFetch({
        routes: {
          'GET /api/tasks/search': (url) => {
            const page = Number(searchParam(url, 'page'));
            return jsonResponse(
              makeSearchPage([makeTask(100 + page, { title: `Page ${page} hit` })], {
                page,
                limit: 20,
                total: 45,
                pages: 3,
              })
            );
          },
        },
      });

      await renderApp();
      expect(await screen.findByText('Page 1 hit')).toBeInTheDocument();

      const pagination = screen.getByRole('navigation', { name: 'Search results pagination' });
      expect(within(pagination).getByRole('button', { name: 'Previous page' })).toBeDisabled();

      fireEvent.click(within(pagination).getByRole('button', { name: 'Next page' }));
      expect(await screen.findByText('Page 2 hit')).toBeInTheDocument();
      expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });

      const pageRequests = callsTo(fetchMock, 'GET', '/api/tasks/search').map(([url]) => searchParam(url, 'page'));
      expect(pageRequests).toContain('2');

      fireEvent.click(within(screen.getByRole('navigation', { name: 'Search results pagination' })).getByRole('button', { name: 'Previous page' }));
      expect(await screen.findByText('Page 1 hit')).toBeInTheDocument();
    });

    test('sends the status and date filters only when they are set (no TC-n; pre-existing path)', async () => {
      const fetchMock = installFetch();

      await renderApp();
      await screen.findByText('Task 1');

      const [firstUrl] = callsTo(fetchMock, 'GET', '/api/tasks/search')[0];
      const params = new URL(firstUrl, 'http://localhost').searchParams;
      expect(params.has('status')).toBe(false);
      expect(params.has('dateFrom')).toBe(false);
      expect(params.has('dateTo')).toBe(false);
      expect(params.get('sortBy')).toBe('dueDate');
      expect(params.get('order')).toBe('asc');
      expect(params.get('page')).toBe('1');
      expect(params.get('limit')).toBe('20');
    });
  });
});
