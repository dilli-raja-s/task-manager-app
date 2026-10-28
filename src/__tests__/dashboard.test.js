import { jest } from '@jest/globals';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import App from '../App.jsx';

// Fixed, far-past and far-future due dates keep these tests independent of the run date.
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

function mockFetch(tasks) {
  global.fetch = jest.fn(async (url) => {
    if (String(url).startsWith('/api/tasks/search')) {
      return {
        ok: true,
        json: async () => ({
          data: [],
          pagination: { page: 1, limit: 20, total: 0, pages: 0 },
        }),
      };
    }
    return { ok: true, json: async () => tasks };
  });
}

function getCardLabels(container) {
  return Array.from(container.querySelectorAll('.summary-grid .summary-card > span')).map(
    (el) => el.textContent
  );
}

function getOverdueCard(container) {
  return container.querySelector('.summary-grid .summary-card.alert');
}

describe('Dashboard overdue summary', () => {
  afterEach(() => {
    delete global.fetch;
    jest.restoreAllMocks();
  });

  test('TC-014: counts overdue tasks from all tasks, ignoring the active filter', async () => {
    mockFetch([
      makeTask(1, { dueDate: PAST, status: 'pending' }),
      makeTask(2, { dueDate: PAST, status: 'in-progress' }),
      makeTask(3, { dueDate: PAST, status: 'completed' }),
      makeTask(4, { dueDate: FUTURE, status: 'pending' }),
    ]);

    const { container } = render(<App />);

    await waitFor(() => expect(getOverdueCard(container)).toHaveTextContent('2'));

    // Switch the board filter to "Completed"; the overdue count must not change.
    fireEvent.click(screen.getByRole('button', { name: 'Completed' }));

    expect(getOverdueCard(container)).toHaveTextContent('2');
  });

  test('TC-015: recalculates the overdue count when the task list changes', async () => {
    mockFetch([makeTask(1, { dueDate: PAST })]);
    const { container, unmount } = render(<App />);

    await waitFor(() => expect(getOverdueCard(container)).toHaveTextContent('1'));
    unmount();

    mockFetch([makeTask(1, { dueDate: PAST }), makeTask(2, { dueDate: PAST })]);
    const second = render(<App />);

    await waitFor(() => expect(getOverdueCard(second.container)).toHaveTextContent('2'));
  });

  test('TC-016: falls back to 0 without crashing when overdue calculation throws', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    // Throw only on the first read of dueDate (the overdue useMemo runs first); later reads
    // return a valid value so the rest of the board can still render.
    const throwingTask = makeTask(1);
    let reads = 0;
    Object.defineProperty(throwingTask, 'dueDate', {
      get() {
        reads += 1;
        if (reads === 1) throw new Error('boom');
        return PAST;
      },
    });
    mockFetch([throwingTask]);

    const { container } = render(<App />);

    // Wait for the throw to happen (after tasks load) before asserting the fallback.
    await waitFor(() =>
      expect(warn).toHaveBeenCalledWith('Error calculating overdue count:', expect.any(Error))
    );
    expect(getOverdueCard(container)).toHaveTextContent('0');
    expect(screen.getByText('Task Manager')).toBeInTheDocument();
  });

  test('TC-017: renders the Overdue card first with the correct count and accessible label', async () => {
    mockFetch([makeTask(1, { dueDate: PAST }), makeTask(2, { dueDate: FUTURE })]);

    const { container } = render(<App />);

    await waitFor(() => expect(getOverdueCard(container)).toHaveTextContent('1'));
    const card = getOverdueCard(container);

    expect(card.parentElement.firstElementChild).toBe(card);
    expect(card).toHaveAttribute('aria-label', '1 overdue tasks');
    expect(within(card).getByText('Overdue')).toBeInTheDocument();
  });

  test('TC-018: summary cards appear in the order Overdue, All Tasks, Pending, In Progress, Completed', async () => {
    mockFetch([makeTask(1)]);

    const { container } = render(<App />);

    await waitFor(() => expect(getCardLabels(container)).toHaveLength(5));
    expect(getCardLabels(container)).toEqual([
      'Overdue',
      'All Tasks',
      'Pending',
      'In Progress',
      'Completed',
    ]);
  });
});
