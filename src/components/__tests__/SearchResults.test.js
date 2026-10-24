import { jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { SearchResults } from '../SearchResults.jsx';

describe('SearchResults Component', () => {
  test('should display loading state', () => {
    render(<SearchResults loading={true} />);

    expect(screen.getByText('Loading results...')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  test('should display error state with retry button', () => {
    const onRetry = jest.fn();
    render(<SearchResults error="Failed to fetch" onRetry={onRetry} />);

    expect(screen.getByText('Search failed')).toBeInTheDocument();
    expect(screen.getByText('Failed to fetch')).toBeInTheDocument();

    const retryButton = screen.getByRole('button', { name: 'Retry' });
    fireEvent.click(retryButton);

    expect(onRetry).toHaveBeenCalled();
  });

  test('should display empty state when no tasks', () => {
    render(<SearchResults tasks={[]} />);

    expect(screen.getByText('No tasks found')).toBeInTheDocument();
    expect(screen.getByText('Try adjusting your search or filters.')).toBeInTheDocument();
  });

  test('should display tasks list', () => {
    const tasks = [
      {
        id: 1,
        title: 'Task 1',
        description: 'Description 1',
        status: 'pending',
        dueDate: '2026-06-10',
        createdAt: '2026-06-01',
      },
      {
        id: 2,
        title: 'Task 2',
        description: 'Description 2',
        status: 'completed',
        dueDate: '2026-06-15',
        createdAt: '2026-06-02',
      },
    ];

    render(<SearchResults tasks={tasks} />);

    expect(screen.getByText('Task 1')).toBeInTheDocument();
    expect(screen.getByText('Task 2')).toBeInTheDocument();
    expect(screen.getByText('Description 1')).toBeInTheDocument();
    expect(screen.getByText('Description 2')).toBeInTheDocument();
  });

  test('should display pagination controls', () => {
    const tasks = [{ id: 1, title: 'Task 1', description: 'Desc', status: 'pending', dueDate: '2026-06-10', createdAt: '2026-06-01' }];
    const pagination = { page: 1, limit: 20, total: 100, pages: 5 };

    render(<SearchResults tasks={tasks} pagination={pagination} />);

    expect(screen.getByRole('navigation', { name: 'Search results pagination' })).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 5')).toBeInTheDocument();
  });

  test('should disable previous button on first page', () => {
    const tasks = [{ id: 1, title: 'Task 1', description: 'Desc', status: 'pending', dueDate: '2026-06-10', createdAt: '2026-06-01' }];
    const pagination = { page: 1, limit: 20, total: 50, pages: 3 };

    render(<SearchResults tasks={tasks} pagination={pagination} />);

    const prevButton = screen.getByLabelText('Previous page');
    expect(prevButton).toBeDisabled();
  });

  test('should disable next button on last page', () => {
    const tasks = [{ id: 1, title: 'Task 1', description: 'Desc', status: 'pending', dueDate: '2026-06-10', createdAt: '2026-06-01' }];
    const pagination = { page: 3, limit: 20, total: 50, pages: 3 };

    render(<SearchResults tasks={tasks} pagination={pagination} />);

    const nextButton = screen.getByLabelText('Next page');
    expect(nextButton).toBeDisabled();
  });

  test('should call onPageChange when page buttons are clicked', () => {
    const onPageChange = jest.fn();
    const tasks = [{ id: 1, title: 'Task 1', description: 'Desc', status: 'pending', dueDate: '2026-06-10', createdAt: '2026-06-01' }];
    const pagination = { page: 2, limit: 20, total: 100, pages: 5 };

    render(<SearchResults tasks={tasks} pagination={pagination} onPageChange={onPageChange} />);

    const nextButton = screen.getByLabelText('Next page');
    fireEvent.click(nextButton);

    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  test('should display results count', () => {
    const tasks = Array.from({ length: 15 }, (_, i) => ({
      id: i + 1,
      title: `Task ${i + 1}`,
      description: `Desc ${i + 1}`,
      status: 'pending',
      dueDate: '2026-06-10',
      createdAt: '2026-06-01',
    }));
    const pagination = { page: 1, limit: 20, total: 35, pages: 2 };

    render(<SearchResults tasks={tasks} pagination={pagination} />);

    expect(screen.getByText(/Showing 1–15 of 35 tasks/)).toBeInTheDocument();
  });

  test('should format status correctly', () => {
    const tasks = [
      {
        id: 1,
        title: 'Task 1',
        description: 'Desc',
        status: 'in-progress',
        dueDate: '2026-06-10',
        createdAt: '2026-06-01',
      },
    ];

    render(<SearchResults tasks={tasks} />);

    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  test('should have results region with aria-label', () => {
    const tasks = [{ id: 1, title: 'Task 1', description: 'Desc', status: 'pending', dueDate: '2026-06-10', createdAt: '2026-06-01' }];

    const { container } = render(<SearchResults tasks={tasks} />);

    const region = container.querySelector('[role="region"][aria-label="Search results"]');
    expect(region).toBeInTheDocument();
  });
});
