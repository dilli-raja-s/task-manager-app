/**
 * C-2: Local date lifecycle hook
 * Manages the browser's local calendar date with midnight-triggered updates.
 * One App-level hook instance; refreshes on focus/visibility with activation recovery.
 */

import { useState, useEffect, useRef } from "react";
import { getLocalDateKey, msUntilNextMidnight } from "../utils/overdue";

/**
 * Hook: manages local calendar date state and midnight refresh scheduling.
 * Initializes from actual clock, schedules next midnight, refreshes on focus/visibility.
 * @returns {string} - Current local calendar day as "YYYY-MM-DD"
 */
export function useLocalDate() {
  const [localDateKey, setLocalDateKey] = useState(() => getLocalDateKey());
  const timeoutRef = useRef(null);
  const disposedRef = useRef(false);

  useEffect(() => {
    disposedRef.current = false;

    const scheduleNextMidnight = () => {
      // Clear any previous timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // Get current state and calculate time to next midnight
      const now = getLocalDateKey();
      setLocalDateKey(now);

      const timeUntil = msUntilNextMidnight(now);

      // Schedule the next midnight refresh
      timeoutRef.current = setTimeout(() => {
        // Guard against queued callback after cleanup
        if (!disposedRef.current) {
          scheduleNextMidnight();
        }
      }, timeUntil);
    };

    // Initial schedule on mount
    scheduleNextMidnight();

    // Refresh on window focus and visibility change
    const handleFocus = () => {
      if (!disposedRef.current) {
        scheduleNextMidnight();
      }
    };

    const handleVisibilityChange = () => {
      if (!disposedRef.current && document.visibilityState === "visible") {
        scheduleNextMidnight();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Cleanup
    return () => {
      disposedRef.current = true;

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return localDateKey;
}
