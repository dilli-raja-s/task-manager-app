/**
 * C-1: Shared overdue classification and due-date formatting.
 * Calendar parsing, status compatibility (DEC-1/DEC-2), and predicate logic
 * for both global count and per-task marker display.
 */

/**
 * Parse and validate a due-date string to a local calendar day.
 * Rejects non-string, absent, null, blank values.
 * For YYYY-MM-DD, validates Gregorian bounds without UTC conversion.
 * For other strings, validates ISO prefix if present, then native parse.
 * @param {string|null|undefined} dueDateStr - Raw task dueDate field value
 * @returns {string|null} - Calendar day as "YYYY-MM-DD" or null if invalid/absent
 */
export function parseDueDay(dueDateStr) {
  if (dueDateStr === null || dueDateStr === undefined || typeof dueDateStr !== "string") {
    return null;
  }

  const trimmed = dueDateStr.trim();
  if (!trimmed) {
    return null;
  }

  // Exact YYYY-MM-DD format: validate bounds without UTC conversion
  const dateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, yearStr, monthStr, dayStr] = dateOnlyMatch;
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const day = parseInt(dayStr, 10);

    // Validate month and day ranges
    if (month < 1 || month > 12 || day < 1) {
      return null;
    }

    // Validate day-of-month bounds (accounting for leap years)
    const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) {
      daysInMonth[1] = 29; // Leap year
    }
    if (day > daysInMonth[month - 1]) {
      return null;
    }

    // Valid date-only format
    return trimmed;
  }

  // ISO timestamp or other string: validate ISO prefix if present
  if (trimmed.match(/^\d{4}-\d{2}-\d{2}T/)) {
    // ISO 8601 timestamp with date prefix
    const d = new Date(trimmed);
    if (!isFinite(d.getTime())) {
      return null;
    }
    // Convert to local calendar day using local getters
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  // Legacy/other format: attempt native parse without ISO validation
  // This is permissive but limited to what existing parsers accept
  const d = new Date(trimmed);
  if (!isFinite(d.getTime())) {
    return null;
  }
  // Convert to local calendar day
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Format a due date for display.
 * Reuses the same parser, then reconstructs the date locally for formatting.
 * @param {string|null|undefined} dueDateStr - Raw task dueDate field value
 * @param {string} fallbackText - Text to display if date is invalid/absent
 * @returns {string} - Formatted date or fallbackText
 */
export function formatDueDate(dueDateStr, fallbackText = "No due date") {
  const dueDay = parseDueDay(dueDateStr);
  if (!dueDay) {
    return fallbackText;
  }

  // Reconstruct date locally (use noon to avoid edge cases)
  const [yearStr, monthStr, dayStr] = dueDay.split("-");
  const d = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1, parseInt(dayStr, 10), 12, 0, 0);

  // Format using local calendar interpretation
  try {
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    }).format(d);
  } catch {
    return fallbackText;
  }
}

/**
 * Classify a task as overdue based on status, archive, and due date.
 * Per DEC-1, exact status "Completed" is excluded.
 * Per DEC-2, archived === true is excluded.
 * @param {object} task - Task object with status, dueDate, optional archived
 * @param {string} localDateKey - Current local calendar day as "YYYY-MM-DD"
 * @returns {boolean} - True if task is overdue, false otherwise
 */
export function isTaskOverdue(task, localDateKey) {
  if (!task) {
    return false;
  }

  // Short-circuit archived === true
  if (task.archived === true) {
    return false;
  }

  // Short-circuit exact status "Completed" (DEC-1: exact string matching)
  if (task.status === "Completed") {
    return false;
  }

  // Parse the due date
  const dueDay = parseDueDay(task.dueDate);

  // Missing/invalid due date: considered overdue (eligible)
  if (dueDay === null) {
    return true;
  }

  // Compare calendar days lexically (YYYY-MM-DD format orders chronologically)
  return dueDay < localDateKey;
}

/**
 * Count overdue tasks in a collection.
 * Excludes archived tasks and tasks with exact "Completed" status.
 * @param {array} tasks - Array of task objects
 * @param {string} localDateKey - Current local calendar day as "YYYY-MM-DD"
 * @returns {number} - Count of overdue tasks
 */
export function countOverdue(tasks, localDateKey) {
  if (!Array.isArray(tasks)) {
    return 0;
  }
  return tasks.reduce((count, task) => {
    return count + (isTaskOverdue(task, localDateKey) ? 1 : 0);
  }, 0);
}

/**
 * Get the current local date as a calendar key.
 * Used for initialization and refresh in the clock lifecycle.
 * @returns {string} - Current local calendar day as "YYYY-MM-DD"
 */
export function getLocalDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Calculate the next local midnight for timer scheduling.
 * Accounts for DST and returns the time to wait in milliseconds.
 * @param {string} currentDateKey - Current local calendar day as "YYYY-MM-DD"
 * @returns {number} - Milliseconds until next local midnight
 */
export function msUntilNextMidnight(currentDateKey) {
  const [yearStr, monthStr, dayStr] = currentDateKey.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  // Construct next day at midnight (local time)
  const nextDay = new Date(year, month - 1, day + 1, 0, 0, 0, 0);
  const now = new Date();
  const timeUntil = nextDay.getTime() - now.getTime();

  // Ensure we don't return a non-positive value
  return Math.max(1, timeUntil);
}
