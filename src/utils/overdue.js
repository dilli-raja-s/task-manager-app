/**
 * Calendar-date overdue check for tasks.
 *
 * Timezone handling: "today" is the user's local calendar date (the browser's
 * timezone), so a task due on the user's current local day is never flagged
 * overdue. Due dates are compared as YYYY-MM-DD strings, so the time component
 * of an ISO 8601 timestamp is ignored.
 */

const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/;

/**
 * Formats a Date as YYYY-MM-DD using its local calendar fields.
 *
 * @param {Date} date
 * @returns {string}
 */
function toLocalCalendarDate(date) {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Extracts the YYYY-MM-DD calendar date from a due date string and checks that
 * it is a real calendar date (rejects values such as 2026-02-30).
 *
 * @param {string} dueDate - YYYY-MM-DD or full ISO 8601 timestamp
 * @returns {string|null} normalized YYYY-MM-DD, or null when invalid
 */
function parseCalendarDate(dueDate) {
  const match = CALENDAR_DATE_PATTERN.exec(dueDate);
  if (!match) return null;

  const [, yearStr, monthStr, dayStr] = match;
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return `${yearStr}-${monthStr}-${dayStr}`;
}

/**
 * Determines whether a task is overdue.
 *
 * A task is overdue when its due date's calendar day is strictly before the
 * user's local calendar day today, and its status is not 'completed'.
 *
 * @param {string|null|undefined} dueDate - YYYY-MM-DD or full ISO 8601 timestamp
 * @param {string} status - 'pending' | 'in-progress' | 'completed'
 * @param {Date} [now=new Date()] - reference instant (injectable for tests)
 * @returns {boolean} true when overdue; false for missing, invalid, future,
 *   same-day, or completed tasks
 *
 * @example
 * isOverdue('2026-10-25', 'pending') // => true  (if today is 2026-10-28)
 * isOverdue('2026-10-28', 'pending') // => false (due today)
 * isOverdue('2026-10-25', 'completed') // => false
 * isOverdue(null, 'pending') // => false
 * isOverdue('invalid-date', 'pending') // => false
 */
export function isOverdue(dueDate, status, now = new Date()) {
  if (typeof dueDate !== 'string' || dueDate === '') return false;
  if (status === 'completed') return false;

  const due = parseCalendarDate(dueDate);
  if (due === null) return false;

  const today = toLocalCalendarDate(now);
  return due < today;
}
