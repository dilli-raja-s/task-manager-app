import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SearchBar } from '../SearchBar.jsx';

describe('SearchBar Component', () => {
  test('should render input with placeholder', () => {
    render(<SearchBar placeholder="Search tasks..." />);
    const input = screen.getByPlaceholderText('Search tasks...');
    expect(input).toBeInTheDocument();
  });

  test('should call onChange with debounced value', async () => {
    const onChange = jest.fn();
    render(<SearchBar onChange={onChange} />);

    const input = screen.getByPlaceholderText('Search tasks...');
    fireEvent.change(input, { target: { value: 'test' } });

    // Wait for debounce (500ms)
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith('test');
    }, { timeout: 600 });
  });

  test('should show clear button when input has content', () => {
    render(<SearchBar />);
    const input = screen.getByPlaceholderText('Search tasks...');

    fireEvent.change(input, { target: { value: 'test' } });

    const clearButton = screen.getByLabelText('Clear search');
    expect(clearButton).toBeInTheDocument();
  });

  test('should clear input when clear button is clicked', () => {
    const onClear = jest.fn();
    render(<SearchBar onClear={onClear} />);

    const input = screen.getByPlaceholderText('Search tasks...');
    fireEvent.change(input, { target: { value: 'test' } });

    const clearButton = screen.getByLabelText('Clear search');
    fireEvent.click(clearButton);

    expect(onClear).toHaveBeenCalled();
    expect(input.value).toBe('');
  });

  test('should clear input on Escape key', () => {
    const onClear = jest.fn();
    render(<SearchBar onClear={onClear} />);

    const input = screen.getByPlaceholderText('Search tasks...');
    fireEvent.change(input, { target: { value: 'test' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onClear).toHaveBeenCalled();
    expect(input.value).toBe('');
  });

  test('should have accessibility attributes', () => {
    render(<SearchBar ariaLabel="Custom aria label" />);

    const input = screen.getByLabelText('Custom aria label');
    expect(input).toHaveAttribute('aria-describedby', 'search-hint');

    const hint = screen.getByText('Results update as you type');
    expect(hint).toHaveAttribute('id', 'search-hint');
  });

  test('should be disabled when disabled prop is true', () => {
    render(<SearchBar disabled={true} />);

    const input = screen.getByPlaceholderText('Search tasks...');
    expect(input).toBeDisabled();
  });

  test('should have search role for accessibility', () => {
    const { container } = render(<SearchBar />);

    const searchRegion = container.querySelector('[role="search"]');
    expect(searchRegion).toBeInTheDocument();
  });

  test('should not call onChange immediately, only after debounce', async () => {
    const onChange = jest.fn();
    jest.useFakeTimers();

    render(<SearchBar onChange={onChange} />);

    const input = screen.getByPlaceholderText('Search tasks...');
    fireEvent.change(input, { target: { value: 'test' } });

    // Should not be called yet
    expect(onChange).not.toHaveBeenCalled();

    // Advance timers by 500ms
    jest.advanceTimersByTime(500);

    expect(onChange).toHaveBeenCalledWith('test');

    jest.useRealTimers();
  });
});
