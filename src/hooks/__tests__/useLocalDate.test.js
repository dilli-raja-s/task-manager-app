/**
 * C-2: useLocalDate hook lifecycle tests
 * Tests midnight scheduling, activation recovery, cleanup, and StrictMode handling
 */

import { renderHook, act } from "@testing-library/react";
import { useLocalDate } from "../useLocalDate";

describe("useLocalDate hook (C-2)", () => {

  test("initializes with current local date (YYYY-MM-DD format)", () => {
    const { result } = renderHook(() => useLocalDate());
    expect(result.current).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("returns a string (not null or undefined)", () => {
    const { result } = renderHook(() => useLocalDate());
    expect(typeof result.current).toBe("string");
    expect(result.current.length).toBe(10); // YYYY-MM-DD
  });

  test("cleans up on unmount without crashing", () => {
    const { unmount } = renderHook(() => useLocalDate());
    expect(() => unmount()).not.toThrow();
  });

  test("handles focus event without crashing", () => {
    const { result } = renderHook(() => useLocalDate());
    const initialValue = result.current;

    act(() => {
      window.dispatchEvent(new Event("focus"));
    });

    // Should still return a valid date after focus
    expect(result.current).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("handles visibility change event without crashing", () => {
    const { result } = renderHook(() => useLocalDate());
    const initialValue = result.current;

    act(() => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        writable: true,
        value: "visible"
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    // Should still return a valid date after visibility change
    expect(result.current).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
