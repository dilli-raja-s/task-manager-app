import { jest } from '@jest/globals';
import { isOverdue } from '../overdue.js';

// Fixed local reference instant: 2026-10-28 12:00 local time.
const NOW = new Date(2026, 9, 28, 12, 0, 0);

describe('isOverdue', () => {
  // TC-001
  test('returns true for a pending task due before today', () => {
    expect(isOverdue('2026-10-25', 'pending', NOW)).toBe(true);
  });

  // TC-002
  test('returns false for a task due today', () => {
    expect(isOverdue('2026-10-28', 'pending', NOW)).toBe(false);
  });

  // TC-003
  test('returns false for a future-dated task', () => {
    expect(isOverdue('2026-10-30', 'pending', NOW)).toBe(false);
  });

  // TC-004
  test('returns false for a completed task with a past due date', () => {
    expect(isOverdue('2026-10-25', 'completed', NOW)).toBe(false);
  });

  // TC-005
  test('returns false when dueDate is null', () => {
    expect(isOverdue(null, 'pending', NOW)).toBe(false);
    expect(isOverdue(null, 'in-progress', NOW)).toBe(false);
  });

  // TC-006
  test('returns false when dueDate is undefined', () => {
    expect(isOverdue(undefined, 'pending', NOW)).toBe(false);
  });

  // TC-007
  test('returns false for an invalid date string', () => {
    expect(isOverdue('invalid-date', 'pending', NOW)).toBe(false);
  });

  // TC-008
  test('returns false for an empty string dueDate', () => {
    expect(isOverdue('', 'pending', NOW)).toBe(false);
  });

  // TC-009
  test('compares against the local calendar day, not UTC', () => {
    // Local 00:00:01 on 2026-10-28: "today" is 2026-10-28 in local time.
    const justAfterLocalMidnight = new Date(2026, 9, 28, 0, 0, 1);
    expect(isOverdue('2026-10-28', 'pending', justAfterLocalMidnight)).toBe(false);
    expect(isOverdue('2026-10-27', 'pending', justAfterLocalMidnight)).toBe(true);

    // Just before local midnight on 2026-10-28, a 10-27 task is still overdue.
    const justBeforeLocalMidnight = new Date(2026, 9, 28, 23, 59, 59);
    expect(isOverdue('2026-10-27', 'pending', justBeforeLocalMidnight)).toBe(true);
    expect(isOverdue('2026-10-28', 'pending', justBeforeLocalMidnight)).toBe(false);
  });

  test('ignores the time component of a full ISO 8601 timestamp', () => {
    expect(isOverdue('2026-10-27T23:59:00Z', 'pending', NOW)).toBe(true);
    expect(isOverdue('2026-10-28T00:00:00Z', 'pending', NOW)).toBe(false);
    expect(isOverdue('2026-10-29T08:00:00+05:00', 'pending', NOW)).toBe(false);
  });

  test('returns false for non-string dueDate values', () => {
    expect(isOverdue(20261025, 'pending', NOW)).toBe(false);
    expect(isOverdue({}, 'pending', NOW)).toBe(false);
  });

  test('rejects dates that do not exist on the calendar', () => {
    expect(isOverdue('2026-02-30', 'pending', NOW)).toBe(false);
    expect(isOverdue('2026-13-01', 'pending', NOW)).toBe(false);
    expect(isOverdue('2026-00-10', 'pending', NOW)).toBe(false);
  });

  test('treats each non-completed status as eligible for overdue', () => {
    expect(isOverdue('2026-10-25', 'in-progress', NOW)).toBe(true);
    expect(isOverdue('2026-10-25', 'pending', NOW)).toBe(true);
  });

  test('defaults the reference instant to the current time', () => {
    jest.useFakeTimers();
    try {
      jest.setSystemTime(new Date(2026, 9, 28, 9, 0, 0));
      expect(isOverdue('2026-10-27')).toBe(true);
      expect(isOverdue('2026-10-28')).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });
});
