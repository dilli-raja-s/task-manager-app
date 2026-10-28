import { jest } from '@jest/globals';
import { isOverdue } from '../utils/overdue.js';

// Date boundary behaviour across a simulated day change. The overdue check
// runs on each render/page load with the current local date, so a task flips
// from "due today" to "overdue" once the user's local calendar day advances.
describe('timezone integration: overdue date boundary', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('a task due today is not overdue on that local day', () => {
    jest.setSystemTime(new Date(2026, 9, 28, 10, 0, 0));
    expect(isOverdue('2026-10-28', 'pending')).toBe(false);
  });

  test('the same task becomes overdue after the local day advances (refresh recalculation)', () => {
    jest.setSystemTime(new Date(2026, 9, 28, 23, 59, 0));
    expect(isOverdue('2026-10-28', 'pending')).toBe(false);

    // Simulated page refresh on the next local day.
    jest.setSystemTime(new Date(2026, 9, 29, 0, 0, 30));
    expect(isOverdue('2026-10-28', 'pending')).toBe(true);
  });

  test('the local calendar day is used even when the UTC day differs', () => {
    // The instant is built from local fields, so "today" must be the local
    // calendar day regardless of the machine's UTC offset.
    jest.setSystemTime(new Date(2026, 9, 28, 22, 30, 0));
    expect(isOverdue('2026-10-28', 'pending')).toBe(false);
    expect(isOverdue('2026-10-27', 'pending')).toBe(true);
  });

  test('the local date format is zero-padded YYYY-MM-DD for single-digit months and days', () => {
    jest.setSystemTime(new Date(2026, 0, 5, 9, 0, 0));
    expect(isOverdue('2026-01-04', 'pending')).toBe(true);
    expect(isOverdue('2026-01-05', 'pending')).toBe(false);
    expect(isOverdue('2025-12-31', 'pending')).toBe(true);
  });
});
