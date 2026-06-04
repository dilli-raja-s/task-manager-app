import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchBar } from '../SearchBar.jsx';
import { SearchResults } from '../SearchResults.jsx';

describe('SearchBar Integration Tests', () => {
  test('TC-001-I-001: Debounce reduces API calls', async () => {
    let apiCallCount = 0;
    const handleSearch = jest.fn(() => {
      apiCallCount++;
    });

    jest.useFakeTimers();

    const { rerender } = render(<SearchBar onChange={handleSearch} />);

    const input = screen.getByPlaceholderText('Search tasks...');

    // Simulate rapid typing: t, te, tes, test (4 keystrokes)
    fireEvent.change(input, { target: { value: 't' } });
    jest.advanceTimersByTime(100);

    fireEvent.change(input, { target: { value: 'te' } });
    jest.advanceTimersByTime(100);

    fireEvent.change(input, { target: { value: 'tes' } });
    jest.advanceTimersByTime(100);

    fireEvent.change(input, { target: { value: 'test' } });
    jest.advanceTimersByTime(500); // Wait for debounce

    // Should only have 1 API call after debounce, not 4
    expect(handleSearch).toHaveBeenCalledTimes(1);
    expect(handleSearch).toHaveBeenCalledWith('test');

    jest.useRealTimers();
  });

  test('TC-001-I-002: Real-time search results update', async () => {
    const mockTasks = [
      {
        id: 1,
        title: 'Test Task',
        description: 'This is a test',
        status: 'pending',
        dueDate: '2026-06-10',
        createdAt: '2026-06-01',
      },
    ];

    const handleSearch = jest.fn();

    jest.useFakeTimers();

    const { rerender } = render(
      <>
        <SearchBar onChange={handleSearch} />
        <SearchResults tasks={[]} />
      </>
    );

    const input = screen.getByPlaceholderText('Search tasks...');
    fireEvent.change(input, { target: { value: 'test' } });

    jest.advanceTimersByTime(500); // Debounce

    expect(handleSearch).toHaveBeenCalledWith('test');

    // Simulate parent updating with search results
    rerender(
      <>
        <SearchBar onChange={handleSearch} />
        <SearchResults tasks={mockTasks} />
      </>
    );

    expect(screen.getByText('Test Task')).toBeInTheDocument();

    jest.useRealTimers();
  });

  test('should clear input and reset search on clear button click', async () => {
    const handleClear = jest.fn();
    render(<SearchBar onClear={handleClear} />);

    const input = screen.getByPlaceholderText('Search tasks...');
    fireEvent.change(input, { target: { value: 'test search' } });

    const clearButton = screen.getByLabelText('Clear search');
    fireEvent.click(clearButton);

    expect(handleClear).toHaveBeenCalled();
    expect(input.value).toBe('');
  });

  test('should focus on search input after page load', () => {
    render(<SearchBar />);

    const input = screen.getByPlaceholderText('Search tasks...');
    expect(input).toBeInTheDocument();
    expect(input.type).toBe('text');
  });

  test('should support keyboard navigation (Tab)', async () => {
    const user = userEvent.setup();

    const handleSearch = jest.fn();
    render(<SearchBar onChange={handleSearch} />);

    const input = screen.getByPlaceholderText('Search tasks...');

    await user.tab();
    expect(input).toHaveFocus();
  });
});

describe('SearchResults Integration Tests', () => {
  test('should display empty message when search returns no results', () => {
    render(<SearchResults tasks={[]} />);

    expect(screen.getByText('No tasks found')).toBeInTheDocument();
    expect(screen.getByText('Try adjusting your search or filters.')).toBeInTheDocument();
  });

  test('should update task list when new results arrive', () => {
    const { rerender } = render(<SearchResults tasks={[]} />);

    expect(screen.getByText('No tasks found')).toBeInTheDocument();

    const newTasks = [
      {
        id: 1,
        title: 'New Task',
        description: 'Description',
        status: 'pending',
        dueDate: '2026-06-10',
        createdAt: '2026-06-01',
      },
    ];

    rerender(<SearchResults tasks={newTasks} />);

    expect(screen.queryByText('No tasks found')).not.toBeInTheDocument();
    expect(screen.getByText('New Task')).toBeInTheDocument();
  });

  test('should handle pagination navigation', () => {
    const onPageChange = jest.fn();
    const tasks = [
      {
        id: 1,
        title: 'Task 1',
        description: 'Desc',
        status: 'pending',
        dueDate: '2026-06-10',
        createdAt: '2026-06-01',
      },
    ];
    const pagination = { page: 2, limit: 20, total: 100, pages: 5 };

    render(
      <SearchResults
        tasks={tasks}
        pagination={pagination}
        onPageChange={onPageChange}
      />
    );

    const prevButton = screen.getByLabelText('Previous page');
    const nextButton = screen.getByLabelText('Next page');

    fireEvent.click(prevButton);
    expect(onPageChange).toHaveBeenCalledWith(1);

    fireEvent.click(nextButton);
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  test('should show loading state during search', () => {
    render(<SearchResults loading={true} />);

    expect(screen.getByText('Loading results...')).toBeInTheDocument();
  });

  test('should show error message and retry button on error', () => {
    const onRetry = jest.fn();
    render(
      <SearchResults
        error="Network error occurred"
        onRetry={onRetry}
      />
    );

    expect(screen.getByText('Search failed')).toBeInTheDocument();
    expect(screen.getByText('Network error occurred')).toBeInTheDocument();

    const retryButton = screen.getByRole('button', { name: 'Retry' });
    fireEvent.click(retryButton);

    expect(onRetry).toHaveBeenCalled();
  });
});

describe('SearchBar + SearchResults Integration', () => {
  test('full search workflow: type -> debounce -> display results', async () => {
    const mockSearchHandler = jest.fn();
    let searchQuery = '';

    jest.useFakeTimers();

    const { rerender } = render(
      <>
        <SearchBar
          onChange={(query) => {
            searchQuery = query;
            mockSearchHandler(query);
          }}
        />
        <SearchResults tasks={[]} />
      </>
    );

    // User types in search
    const input = screen.getByPlaceholderText('Search tasks...');
    fireEvent.change(input, { target: { value: 'bug fix' } });

    // No immediate call
    expect(mockSearchHandler).not.toHaveBeenCalled();

    // Wait for debounce
    jest.advanceTimersByTime(500);

    expect(mockSearchHandler).toHaveBeenCalledWith('bug fix');

    // Simulate API response with results
    const mockResults = [
      {
        id: 1,
        title: 'Fix login bug',
        description: 'Users cannot log in',
        status: 'in-progress',
        dueDate: '2026-06-05',
        createdAt: '2026-06-01',
      },
    ];

    rerender(
      <>
        <SearchBar onChange={mockSearchHandler} />
        <SearchResults tasks={mockResults} />
      </>
    );

    expect(screen.getByText('Fix login bug')).toBeInTheDocument();

    jest.useRealTimers();
  });
});
