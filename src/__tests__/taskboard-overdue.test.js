import { jest } from '@jest/globals';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';

// Real implementation, wrapped so one specific due date can be made to throw (F-1 fallback test).
const actualOverdue = await import('../utils/overdue.js');
const THROWING_DUE = '2000-06-15T00:00:00.000Z';
const isOverdueMock = jest.fn((dueDate, status, now) => {
  if (dueDate === THROWING_DUE) throw new Error('boom');
  return actualOverdue.isOverdue(dueDate, status, now);
});
jest.unstable_mockModule('../utils/overdue.js', () => ({ isOverdue: isOverdueMock }));

// Imported after the mock is registered so App receives the mocked module.
const { default: App } = await import('../App.jsx');

// Due dates are relative to the local calendar day so the tests stay independent of the run date.
function localDateOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const YESTERDAY = localDateOffset(-1);
const TODAY = localDateOffset(0);
const NEXT_WEEK = localDateOffset(7);

function makeTask(id, overrides = {}) {
  return {
    id,
    title: `Task ${id}`,
    description: `Description ${id}`,
    status: 'pending',
    dueDate: NEXT_WEEK,
    createdAt: '2026-01-01',
    ...overrides,
  };
}

function jsonResponse(body) {
  return { ok: true, status: 200, json: async () => body };
}

function installFetch(tasks, searchData = []) {
  global.fetch = jest.fn(async (url) => {
    const path = String(url).split('?')[0];
    if (path === '/api/tasks/search') {
      return jsonResponse({
        data: searchData.map((task) => ({ ...task })),
        pagination: { page: 1, limit: 20, total: searchData.length, pages: 1 },
      });
    }
    return jsonResponse(tasks.map((task) => ({ ...task })));
  });
}

async function renderBoard(tasks, searchData) {
  installFetch(tasks, searchData);
  const view = render(<App />);
  await waitFor(() => expect(view.container.querySelector('.task-list .task-card')).not.toBeNull());
  return view;
}

// Scope queries to the Task Board so search results do not leak into board assertions.
function getBoardCard(container, title) {
  const heading = within(container.querySelector('.task-list')).getByRole('heading', {
    name: title,
    level: 3,
  });
  return heading.closest('article');
}

describe('Task Board overdue markers', () => {
  beforeEach(() => {
    isOverdueMock.mockClear();
  });

  afterEach(() => {
    delete global.fetch;
    jest.restoreAllMocks();
  });

  test('TC-009: overdue task card has the overdue class and a labelled icon indicator', async () => {
    const { container } = await renderBoard([makeTask(1, { dueDate: YESTERDAY })]);

    const card = getBoardCard(container, 'Task 1');
    expect(card).toHaveClass('task-card', 'overdue');

    const indicator = within(card).getByRole('img', { name: 'Overdue' });
    expect(indicator).toHaveClass('overdue-indicator');
    expect(indicator.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  test('TC-010: every overdue task is marked and non-overdue tasks are not', async () => {
    const { container } = await renderBoard([
      makeTask(1, { dueDate: YESTERDAY, status: 'pending' }),
      makeTask(2, { dueDate: YESTERDAY, status: 'in-progress' }),
      makeTask(3, { dueDate: NEXT_WEEK }),
    ]);

    expect(getBoardCard(container, 'Task 1')).toHaveClass('overdue');
    expect(getBoardCard(container, 'Task 2')).toHaveClass('overdue');
    expect(getBoardCard(container, 'Task 3')).not.toHaveClass('overdue');
    expect(container.querySelectorAll('.task-list .overdue-indicator')).toHaveLength(2);
  });

  test('TC-011: completed task with a past due date is not marked', async () => {
    const { container } = await renderBoard([makeTask(1, { dueDate: YESTERDAY, status: 'completed' })]);

    const card = getBoardCard(container, 'Task 1');
    expect(card).not.toHaveClass('overdue');
    expect(within(card).queryByRole('img', { name: 'Overdue' })).not.toBeInTheDocument();
  });

  test('TC-007: task due today is not marked', async () => {
    const { container } = await renderBoard([makeTask(1, { dueDate: TODAY })]);

    expect(getBoardCard(container, 'Task 1')).not.toHaveClass('overdue');
    expect(container.querySelector('.task-list .overdue-indicator')).toBeNull();
  });

  test('TC-008 / TC-021: future task has no marker, and marker-free tasks keep their base card class', async () => {
    const { container } = await renderBoard([makeTask(1, { dueDate: NEXT_WEEK })]);

    const card = getBoardCard(container, 'Task 1');
    expect(card.className).toBe('task-card');
    expect(container.querySelector('.task-list .overdue-indicator')).toBeNull();
  });

  test('TC-033: overdue marker markup is identical on the Task Board and in search results', async () => {
    const overdue = makeTask(1, { dueDate: YESTERDAY });
    const { container } = await renderBoard([overdue], [overdue]);

    await waitFor(() => expect(container.querySelector('.results-list .overdue-indicator')).not.toBeNull());

    const boardIndicator = container.querySelector('.task-list .overdue-indicator');
    const resultIndicator = container.querySelector('.results-list .overdue-indicator');
    expect(boardIndicator.outerHTML).toBe(resultIndicator.outerHTML);
    expect(getBoardCard(container, 'Task 1')).toHaveClass('overdue');
  });

  test('marker stays on an overdue task that is still shown after a status filter is applied', async () => {
    const { container } = await renderBoard([
      makeTask(1, { dueDate: YESTERDAY, status: 'pending' }),
      makeTask(2, { dueDate: NEXT_WEEK, status: 'completed' }),
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Pending' }));

    expect(getBoardCard(container, 'Task 1')).toHaveClass('overdue');
    expect(within(container.querySelector('.task-list')).queryByRole('heading', { name: 'Task 2', level: 3 })).toBeNull();
  });

  test('F-1: when the overdue check throws for one task, that card renders unmarked and the rest of the board still renders', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const { container } = await renderBoard([
      makeTask(1, { dueDate: THROWING_DUE }),
      makeTask(2, { dueDate: YESTERDAY }),
    ]);

    expect(warn).toHaveBeenCalledWith('Error checking overdue status for task 1:', expect.any(Error));

    const failedCard = getBoardCard(container, 'Task 1');
    expect(failedCard).not.toHaveClass('overdue');
    expect(within(failedCard).queryByRole('img', { name: 'Overdue' })).not.toBeInTheDocument();
    expect(within(failedCard).getByText('Description 1')).toBeInTheDocument();

    expect(getBoardCard(container, 'Task 2')).toHaveClass('overdue');
  });
});
