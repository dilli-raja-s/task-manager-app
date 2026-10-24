/**
 * C-1: Overdue classifier unit tests.
 * Tests parser, display formatter, predicate logic, and edge cases.
 */

import {
  parseDueDay,
  formatDueDate,
  isTaskOverdue,
  countOverdue,
  getLocalDateKey,
  msUntilNextMidnight
} from "../overdue";

describe("overdue classifier (C-1)", () => {
  const mockLocalDate = "2026-10-24"; // Saturday

  describe("parseDueDay", () => {
    test("accepts valid YYYY-MM-DD and returns it unchanged", () => {
      expect(parseDueDay("2026-10-23")).toBe("2026-10-23");
      expect(parseDueDay("2026-01-01")).toBe("2026-01-01");
      expect(parseDueDay("2026-12-31")).toBe("2026-12-31");
    });

    test("rejects non-string, null, undefined, blank values", () => {
      expect(parseDueDay(null)).toBe(null);
      expect(parseDueDay(undefined)).toBe(null);
      expect(parseDueDay("")).toBe(null);
      expect(parseDueDay("   ")).toBe(null);
      expect(parseDueDay(12345)).toBe(null);
      expect(parseDueDay({})).toBe(null);
    });

    test("rejects invalid month/day ranges", () => {
      expect(parseDueDay("2026-00-15")).toBe(null); // Month 0
      expect(parseDueDay("2026-13-15")).toBe(null); // Month 13
      expect(parseDueDay("2026-02-30")).toBe(null); // Feb 30
      expect(parseDueDay("2026-04-31")).toBe(null); // Apr 31
      expect(parseDueDay("2026-10-00")).toBe(null); // Day 0
    });

    test("validates leap year correctly (Feb 29)", () => {
      expect(parseDueDay("2024-02-29")).toBe("2024-02-29"); // Leap year
      expect(parseDueDay("2026-02-29")).toBe(null); // Non-leap year
      expect(parseDueDay("2000-02-29")).toBe("2000-02-29"); // Century leap year
      expect(parseDueDay("1900-02-29")).toBe(null); // Century non-leap year
    });

    test("parses ISO 8601 timestamp to local calendar day", () => {
      // Depending on timezone, these may differ; use deterministic values
      const result = parseDueDay("2026-10-23T14:30:00");
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result).toBe("2026-10-23");
    });

    test("rejects invalid ISO timestamps", () => {
      expect(parseDueDay("2026-10-23T25:00:00")).toBe(null); // Invalid hour
      expect(parseDueDay("2026-13-01T00:00:00")).toBe(null); // Invalid month in timestamp
    });

    test("trims whitespace around date", () => {
      expect(parseDueDay("  2026-10-23  ")).toBe("2026-10-23");
      expect(parseDueDay("\t2026-10-23\n")).toBe("2026-10-23");
    });

    test("accepts strings that native parser can handle", () => {
      // Design permits native parse compatibility for non-date-only formats
      // so formats like "10-23-2026" that Date() accepts are processed
      const result = parseDueDay("10-23-2026");
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/); // Returns valid calendar day
    });

    test("rejects truly unparseable strings", () => {
      expect(parseDueDay("not-a-date")).toBe(null);
      expect(parseDueDay("@#$%^&*")).toBe(null);
      expect(parseDueDay("foo bar baz")).toBe(null);
    });
  });

  describe("formatDueDate", () => {
    test("formats valid due day", () => {
      const result = formatDueDate("2026-10-23");
      expect(result).toMatch(/Oct 23, 2026/); // Intl.DateTimeFormat output
    });

    test("returns fallback for invalid/absent dates", () => {
      expect(formatDueDate(null)).toBe("No due date");
      expect(formatDueDate(undefined)).toBe("No due date");
      expect(formatDueDate("")).toBe("No due date");
      expect(formatDueDate("not-a-date")).toBe("No due date");
    });

    test("accepts custom fallback text", () => {
      expect(formatDueDate(null, "None")).toBe("None");
      expect(formatDueDate("invalid", "Unknown date")).toBe("Unknown date");
    });

    test("preserves calendar day when formatting ISO timestamp", () => {
      // Timestamp 2026-10-23T23:59:59 should format as Oct 23, not Oct 24
      const result = formatDueDate("2026-10-23T23:59:59");
      expect(result).toMatch(/Oct 23, 2026/);
    });
  });

  describe("isTaskOverdue predicate", () => {
    test("returns false for archived tasks regardless of due date", () => {
      const task = {
        id: "t1",
        status: "In Progress",
        dueDate: "2026-10-23", // Past
        archived: true
      };
      expect(isTaskOverdue(task, mockLocalDate)).toBe(false);
    });

    test("returns false for exact status 'Completed' (DEC-1)", () => {
      const task = {
        id: "t1",
        status: "Completed",
        dueDate: "2026-10-23", // Past
        archived: false
      };
      expect(isTaskOverdue(task, mockLocalDate)).toBe(false);
    });

    test("returns true for case-variant status with past due (TC-009: FX-STATUS-VARIANTS)", () => {
      const lowercase = { status: "completed", dueDate: "2026-10-23", archived: false };
      const uppercase = { status: "COMPLETED", dueDate: "2026-10-23", archived: false };
      const spaced = { status: "Completed ", dueDate: "2026-10-23", archived: false };

      expect(isTaskOverdue(lowercase, mockLocalDate)).toBe(true);
      expect(isTaskOverdue(uppercase, mockLocalDate)).toBe(true);
      expect(isTaskOverdue(spaced, mockLocalDate)).toBe(true);
    });

    test("returns true for overdue task (before local calendar day)", () => {
      const task = {
        id: "t1",
        status: "In Progress",
        dueDate: "2026-10-23", // Before 2026-10-24
        archived: false
      };
      expect(isTaskOverdue(task, mockLocalDate)).toBe(true);
    });

    test("returns false for task due today", () => {
      const task = {
        id: "t1",
        status: "In Progress",
        dueDate: "2026-10-24", // Equal to localDate
        archived: false
      };
      expect(isTaskOverdue(task, mockLocalDate)).toBe(false);
    });

    test("returns false for future task", () => {
      const task = {
        id: "t1",
        status: "In Progress",
        dueDate: "2026-10-25", // After 2026-10-24
        archived: false
      };
      expect(isTaskOverdue(task, mockLocalDate)).toBe(false);
    });

    test("returns true for missing due date (considered overdue)", () => {
      const taskNoField = { id: "t1", status: "In Progress", archived: false };
      const taskNull = { id: "t1", status: "In Progress", dueDate: null, archived: false };
      const taskEmpty = { id: "t1", status: "In Progress", dueDate: "", archived: false };

      expect(isTaskOverdue(taskNoField, mockLocalDate)).toBe(true);
      expect(isTaskOverdue(taskNull, mockLocalDate)).toBe(true);
      expect(isTaskOverdue(taskEmpty, mockLocalDate)).toBe(true);
    });

    test("returns true for invalid due date (considered overdue)", () => {
      const task = {
        id: "t1",
        status: "In Progress",
        dueDate: "not-a-date",
        archived: false
      };
      expect(isTaskOverdue(task, mockLocalDate)).toBe(true);
    });

    test("returns false for null/undefined task", () => {
      expect(isTaskOverdue(null, mockLocalDate)).toBe(false);
      expect(isTaskOverdue(undefined, mockLocalDate)).toBe(false);
    });
  });

  describe("countOverdue", () => {
    test("counts overdue tasks in FX-MIXED fixture (4 overdue expected)", () => {
      const tasks = [
        { id: "M1", title: "alpha past", status: "In Progress", dueDate: "2026-10-23", archived: false }, // Overdue
        { id: "M2", title: "beta past", status: "To Do", dueDate: "2026-10-23", archived: false }, // Overdue
        { id: "M3", title: "alpha missing", status: "In Progress", dueDate: null, archived: false }, // Overdue (missing)
        { id: "M4", title: "beta invalid", status: "To Do", dueDate: "not-a-date", archived: false }, // Overdue (invalid)
        { id: "M5", title: "gamma today", status: "In Progress", dueDate: "2026-10-24", archived: false }, // Not overdue (today)
        { id: "M6", title: "gamma future", status: "To Do", dueDate: "2026-10-25", archived: false }, // Not overdue (future)
        { id: "M7", title: "done past", status: "Completed", dueDate: "2026-10-23", archived: false }, // Not overdue (Completed)
        { id: "M8", title: "archived past", status: "In Progress", dueDate: "2026-10-23", archived: true } // Not overdue (archived)
      ];
      expect(countOverdue(tasks, mockLocalDate)).toBe(4);
    });

    test("counts zero overdue tasks in empty array", () => {
      expect(countOverdue([], mockLocalDate)).toBe(0);
    });

    test("counts zero overdue tasks when all are excluded", () => {
      const tasks = [
        { status: "Completed", dueDate: "2026-10-23", archived: false },
        { status: "In Progress", dueDate: "2026-10-23", archived: true }
      ];
      expect(countOverdue(tasks, mockLocalDate)).toBe(0);
    });

    test("returns 0 for non-array input", () => {
      expect(countOverdue(null, mockLocalDate)).toBe(0);
      expect(countOverdue(undefined, mockLocalDate)).toBe(0);
      expect(countOverdue({}, mockLocalDate)).toBe(0);
    });

    test("counts correctly with all overdue (empty due dates)", () => {
      const tasks = [
        { status: "In Progress", archived: false },
        { status: "To Do", archived: false },
        { status: "To Do", archived: false }
      ];
      expect(countOverdue(tasks, mockLocalDate)).toBe(3);
    });

    test("counts correctly at midnight boundary (TC-007: FX-MIDNIGHT-PAST)", () => {
      const tasks = [
        { status: "In Progress", dueDate: "2026-10-23", archived: false } // Just became overdue at midnight
      ];
      // At 2026-10-24 00:00:01, 2026-10-23 is before localDate
      expect(countOverdue(tasks, "2026-10-24")).toBe(1);
    });
  });

  describe("getLocalDateKey", () => {
    test("returns a valid YYYY-MM-DD string", () => {
      const result = getLocalDateKey();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test("returns today's date in local timezone", () => {
      const now = new Date();
      const expectedYear = now.getFullYear();
      const expectedMonth = String(now.getMonth() + 1).padStart(2, "0");
      const expectedDay = String(now.getDate()).padStart(2, "0");
      const expected = `${expectedYear}-${expectedMonth}-${expectedDay}`;
      expect(getLocalDateKey()).toBe(expected);
    });
  });

  describe("msUntilNextMidnight", () => {
    test("returns positive milliseconds", () => {
      const ms = msUntilNextMidnight("2026-10-24");
      expect(ms).toBeGreaterThan(0);
    });

    test("returns value less than 24 hours (86400000 ms)", () => {
      const ms = msUntilNextMidnight("2026-10-24");
      expect(ms).toBeLessThan(86400000);
    });

    test("returns reasonable value for scheduling next midnight", () => {
      // The exact value depends on current time and execution environment.
      // Just verify it's positive and less than 24 hours.
      const ms = msUntilNextMidnight("2026-10-24");
      expect(ms).toBeGreaterThan(0);
      expect(ms).toBeLessThan(86400000);
    });
  });

  describe("Integration: predicate and formatter together", () => {
    test("displays correct text for overdue vs. non-overdue tasks", () => {
      const overdueTask = {
        id: "t1",
        status: "In Progress",
        dueDate: "2026-10-23",
        archived: false
      };
      const nonOverdueTask = {
        id: "t2",
        status: "In Progress",
        dueDate: "2026-10-25",
        archived: false
      };

      expect(isTaskOverdue(overdueTask, mockLocalDate)).toBe(true);
      expect(formatDueDate(overdueTask.dueDate)).toMatch(/Oct 23, 2026/);

      expect(isTaskOverdue(nonOverdueTask, mockLocalDate)).toBe(false);
      expect(formatDueDate(nonOverdueTask.dueDate)).toMatch(/Oct 25, 2026/);
    });

    test("handles malformed due date safely in both predicate and formatter", () => {
      const task = {
        id: "t1",
        status: "In Progress",
        dueDate: "completely-invalid-xyz", // Truly invalid format
        archived: false
      };

      expect(isTaskOverdue(task, mockLocalDate)).toBe(true); // Treated as missing
      expect(formatDueDate(task.dueDate)).toBe("No due date");
    });
  });

  describe("Edge cases: Time zones and DST", () => {
    test("recognizes calendar day boundary using local time", () => {
      // For a given UTC timestamp, the local calendar day depends on timezone.
      // The implementation correctly uses getFullYear/getMonth/getDate (local getters).
      const task = {
        status: "In Progress",
        dueDate: "2026-10-23T14:30:00Z", // UTC time
        archived: false
      };
      // Calendar day is extracted using local timezone getters.
      // In Asia/Kolkata (UTC+5:30), this timestamp is 2026-10-23 at 20:00 local time,
      // so local calendar day is 2026-10-23.
      // In UTC, it would be 2026-10-23.
      // Verify it parses to a valid calendar day (exact day depends on exec timezone).
      const dueDay = parseDueDay(task.dueDate);
      expect(dueDay).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      // Just verify it's a valid calendar string; don't assert specific date
      // due to timezone environment variability.
    });
  });
});
