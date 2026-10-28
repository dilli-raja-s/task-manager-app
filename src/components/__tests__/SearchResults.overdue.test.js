import { jest } from '@jest/globals';
import { render, screen, within } from '@testing-library/react';
import { SearchResults } from '../SearchResults.jsx';

// Due dates are relative to the local calendar day so the tests stay independent of the run date.
// The overdue check compares local calendar dates, so these offsets match its semantics.
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

function makeResult(id, overrides = {}) {
  return {
    id,
    title: `Result ${id}`,
    description: `Description ${id}`,
    status: 'pending',
    dueDate: NEXT_WEEK,
    createdAt: '2026-01-01',
    ...overrides,
  };
}

function getCard(title) {
  return screen.getByRole('heading', { name: title, level: 4 }).closest('article');
}

describe('SearchResults overdue markers', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('TC-012: overdue result has the overdue card class, red-border styling hook, and labelled icon', () => {
    render(<SearchResults tasks={[makeResult(1, { dueDate: YESTERDAY })]} />);

    const card = getCard('Result 1');
    expect(card).toHaveClass('task-result-card', 'overdue');

    const indicator = within(card).getByRole('img', { name: 'Overdue' });
    expect(indicator).toHaveClass('overdue-indicator');
    expect(indicator.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  test('TC-013: only overdue results are marked in a mixed result list', () => {
    render(
      <SearchResults
        tasks={[
          makeResult(1, { dueDate: YESTERDAY }),
          makeResult(2, { dueDate: NEXT_WEEK }),
          makeResult(3, { dueDate: YESTERDAY, status: 'in-progress' }),
        ]}
      />
    );

    expect(getCard('Result 1')).toHaveClass('overdue');
    expect(getCard('Result 2')).not.toHaveClass('overdue');
    expect(getCard('Result 3')).toHaveClass('overdue');
    expect(screen.getAllByRole('img', { name: 'Overdue' })).toHaveLength(2);
  });

  test('TC-014: no overdue indicators when no result is overdue', () => {
    render(
      <SearchResults
        tasks={[
          makeResult(1, { dueDate: NEXT_WEEK }),
          makeResult(2, { dueDate: TODAY }),
        ]}
      />
    );

    expect(screen.queryByRole('img', { name: 'Overdue' })).not.toBeInTheDocument();
    expect(document.querySelector('.overdue-indicator')).toBeNull();
    expect(document.querySelector('.task-result-card.overdue')).toBeNull();
  });

  test('TC-011: completed result with a past due date is not marked', () => {
    render(<SearchResults tasks={[makeResult(1, { dueDate: YESTERDAY, status: 'completed' })]} />);

    expect(getCard('Result 1')).not.toHaveClass('overdue');
    expect(screen.queryByRole('img', { name: 'Overdue' })).not.toBeInTheDocument();
  });

  test('TC-007: result due today is not marked', () => {
    render(<SearchResults tasks={[makeResult(1, { dueDate: TODAY })]} />);

    expect(getCard('Result 1')).not.toHaveClass('overdue');
    expect(screen.queryByRole('img', { name: 'Overdue' })).not.toBeInTheDocument();
  });

  test('marked result keeps the base result card class alongside the overdue class', () => {
    render(<SearchResults tasks={[makeResult(1, { dueDate: YESTERDAY })]} />);

    const card = getCard('Result 1');
    expect(card.className).toBe('task-result-card overdue');
    expect(within(card).getByText('Result 1')).toBeInTheDocument();
  });

  test('F-1: when the overdue check throws, the result renders unmarked and the error is logged', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    // Throw only on the first read of dueDate, which is the overdue check inside the
    // per-result fallback. Later reads return a valid value so the card can still render.
    const throwingResult = makeResult(7);
    let reads = 0;
    Object.defineProperty(throwingResult, 'dueDate', {
      get() {
        reads += 1;
        if (reads === 1) throw new Error('boom');
        return YESTERDAY;
      },
    });

    render(<SearchResults tasks={[throwingResult, makeResult(8, { dueDate: YESTERDAY })]} />);

    expect(warn).toHaveBeenCalledWith('Error checking overdue status for task 7:', expect.any(Error));

    const failedCard = getCard('Result 7');
    expect(failedCard).not.toHaveClass('overdue');
    expect(within(failedCard).queryByRole('img', { name: 'Overdue' })).not.toBeInTheDocument();
    expect(screen.getByText('Result 7')).toBeInTheDocument();

    // Other results in the same list are still marked.
    expect(getCard('Result 8')).toHaveClass('overdue');
  });
});
