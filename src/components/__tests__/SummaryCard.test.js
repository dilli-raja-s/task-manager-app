import { render, screen } from '@testing-library/react';
import { SummaryCard } from '../SummaryCard.jsx';

describe('SummaryCard Component', () => {
  test('TC-011: renders label and value', () => {
    render(<SummaryCard label="Pending" value={4} tone="sand" />);

    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  test('TC-012: applies the tone class for the alert tone', () => {
    const { container } = render(<SummaryCard label="Overdue" value={2} tone="alert" />);
    const card = container.querySelector('.summary-card');

    expect(card).toHaveClass('summary-card');
    expect(card).toHaveClass('alert');
  });

  test('TC-013: sets the aria-label when provided', () => {
    const { container } = render(
      <SummaryCard label="Overdue" value={2} tone="alert" ariaLabel="2 overdue tasks" />
    );

    expect(container.querySelector('.summary-card')).toHaveAttribute('aria-label', '2 overdue tasks');
  });

  test('omits the aria-label attribute when none is provided', () => {
    const { container } = render(<SummaryCard label="All Tasks" value={5} tone="sun" />);

    expect(container.querySelector('.summary-card')).not.toHaveAttribute('aria-label');
  });
});
