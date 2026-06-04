import { renderHook, waitFor } from '@testing-library/react';
import { useDebounce } from '../useDebounce.js';

describe('useDebounce', () => {
  beforeEach(() => {
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  test('should return initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('test', 500));
    expect(result.current).toBe('test');
  });

  test('should debounce value changes', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: 'test' } }
    );

    expect(result.current).toBe('test');

    // Change value
    rerender({ value: 'test2' });
    expect(result.current).toBe('test'); // Should still be old value

    // Wait for debounce timeout
    jest.advanceTimersByTime(500);
    expect(result.current).toBe('test2');
  });

  test('should cancel previous timeout if value changes before delay', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: 'a' } }
    );

    rerender({ value: 'ab' });
    jest.advanceTimersByTime(200);
    expect(result.current).toBe('a');

    rerender({ value: 'abc' });
    jest.advanceTimersByTime(200);
    expect(result.current).toBe('a'); // Still original

    jest.advanceTimersByTime(300); // Complete second timeout
    expect(result.current).toBe('abc');
  });

  test('should handle custom delay', () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'test', delay: 1000 } }
    );

    rerender({ value: 'test2', delay: 1000 });
    jest.advanceTimersByTime(500);
    expect(result.current).toBe('test');

    jest.advanceTimersByTime(500);
    expect(result.current).toBe('test2');
  });

  test('should clean up timeout on unmount', () => {
    const { unmount, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: 'test' } }
    );

    rerender({ value: 'test2' });
    unmount();

    // Advancing timers should not cause errors
    jest.advanceTimersByTime(500);
  });

  test('should use default delay of 500ms', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value),
      { initialProps: { value: 'test' } }
    );

    rerender({ value: 'test2' });
    jest.advanceTimersByTime(499);
    expect(result.current).toBe('test');

    jest.advanceTimersByTime(1);
    expect(result.current).toBe('test2');
  });

  test('should handle rapid updates', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: '' } }
    );

    // Simulate rapid typing: a, ab, abc, abcd
    rerender({ value: 'a' });
    jest.advanceTimersByTime(100);
    rerender({ value: 'ab' });
    jest.advanceTimersByTime(100);
    rerender({ value: 'abc' });
    jest.advanceTimersByTime(100);
    rerender({ value: 'abcd' });

    expect(result.current).toBe('');

    // Only one timeout should be active
    jest.advanceTimersByTime(500);
    expect(result.current).toBe('abcd');
  });
});
