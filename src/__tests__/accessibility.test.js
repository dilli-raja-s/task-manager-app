import { readFileSync } from 'node:fs';
import { jest } from '@jest/globals';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App.jsx';

// Wave 4 accessibility tests (Task 4.3). jsdom cannot run a full WCAG engine and no axe package is
// installed, so these checks cover the overdue marker's ARIA names, keyboard reachability, the
// colour contrast of the marker, and the focus styling in the stylesheet. They do not replace a
// browser-based audit.
const PAST = '2000-01-01T00:00:00.000Z';
const FUTURE = '2999-12-31T00:00:00.000Z';
const OVERDUE_RED = '#d32f2f';

function makeTask(id, overrides = {}) {
  return {
    id,
    title: `Task ${id}`,
    description: `Description ${id}`,
    status: 'pending',
    dueDate: FUTURE,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function installFetch(tasks) {
  global.fetch = jest.fn(async (url) => {
    if (String(url).startsWith('/api/tasks/search')) {
      const data = tasks.map((task) => ({ ...task }));
      return {
        ok: true,
        status: 200,
        json: async () => ({ data, pagination: { page: 1, limit: 20, total: data.length, pages: 1 } }),
      };
    }
    return { ok: true, status: 200, json: async () => tasks.map((task) => ({ ...task })) };
  });
}

async function renderApp(tasks) {
  installFetch(tasks);
  const view = render(<App />);
  await waitFor(() => expect(view.container.querySelector('.task-list .task-card')).not.toBeNull());
  await waitFor(() => expect(view.container.querySelector('.search-results')).not.toBeNull());
  return view;
}

// WCAG 2.x relative luminance and contrast ratio for sRGB hex colours.
function relativeLuminance(hex) {
  const value = hex.replace('#', '');
  const channels = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(foreground, background) {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);
  const [lighter, darker] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (lighter + 0.05) / (darker + 0.05);
}

const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

describe('Wave 4 accessibility: overdue marker names (Task 4.3, manifest TC-033)', () => {
  afterEach(() => {
    delete global.fetch;
    jest.restoreAllMocks();
  });

  test('every overdue marker is exposed as an image named "Overdue" on the Task Board and in search results', async () => {
    const { container } = await renderApp([makeTask(1, { title: 'Ship it', dueDate: PAST })]);

    await waitFor(() => expect(container.querySelector('.results-list .overdue-indicator')).not.toBeNull());

    const boardMarker = within(container.querySelector('.task-list')).getByRole('img', { name: 'Overdue' });
    const resultMarker = within(container.querySelector('.results-list')).getByRole('img', { name: 'Overdue' });
    expect(boardMarker).toHaveClass('overdue-indicator');
    expect(resultMarker).toHaveClass('overdue-indicator');
  });

  test('the decorative SVG inside the marker is hidden from assistive technology', async () => {
    const { container } = await renderApp([makeTask(1, { dueDate: PAST })]);

    const marker = within(container.querySelector('.task-list')).getByRole('img', { name: 'Overdue' });
    expect(marker.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  test('the Overdue dashboard card exposes the count in its accessible label', async () => {
    const { container } = await renderApp([
      makeTask(1, { dueDate: PAST }),
      makeTask(2, { dueDate: PAST, status: 'in-progress' }),
      makeTask(3, { dueDate: PAST, status: 'completed' }),
    ]);

    const card = container.querySelector('.summary-grid .summary-card.alert');
    expect(card).toHaveAttribute('aria-label', '2 overdue tasks');
    expect(card.querySelector('span')).toHaveTextContent('Overdue');
  });

  test('a card with no overdue status exposes no "Overdue" image name', async () => {
    const { container } = await renderApp([makeTask(1, { dueDate: FUTURE })]);

    expect(within(container.querySelector('.task-list')).queryByRole('img', { name: 'Overdue' })).toBeNull();
    expect(container.querySelectorAll('.overdue-indicator')).toHaveLength(0);
  });
});

describe('Wave 4 accessibility: keyboard reachability (Task 4.3, manifest TC-035)', () => {
  afterEach(() => {
    delete global.fetch;
    jest.restoreAllMocks();
  });

  test('the overdue marker is not in the tab order; the overdue card Edit button is reachable by keyboard', async () => {
    const { container } = await renderApp([
      makeTask(1, { title: 'Overdue one', dueDate: PAST }),
      makeTask(2, { title: 'Future one', dueDate: FUTURE }),
    ]);

    const board = container.querySelector('.task-list');
    const marker = within(board).getByRole('img', { name: 'Overdue' });
    expect(marker).not.toHaveAttribute('tabindex');
    expect(marker.tagName).toBe('DIV');

    const overdueCard = within(board).getByRole('heading', { name: 'Overdue one', level: 3 }).closest('article');
    const editButton = within(overdueCard).getByRole('button', { name: 'Edit' });

    const user = userEvent.setup();
    // Tab until the overdue card's Edit button receives focus, bounded so a missing control fails fast.
    let reached = false;
    for (let i = 0; i < 60 && !reached; i += 1) {
      await user.tab();
      reached = document.activeElement === editButton;
    }
    expect(reached).toBe(true);
    expect(editButton).toHaveFocus();
  });
});

describe('Wave 4 accessibility: marker colour contrast (Task 4.3, manifest TC-034)', () => {
  test('the marker red on white meets WCAG 2.1 AA for text and non-text (4.5:1 and 3:1)', () => {
    const ratio = contrastRatio(OVERDUE_RED, '#ffffff');
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  test('the computed ratio is below the AAA 7:1 level the manifest assumed (manifest claim corrected in the dev log)', () => {
    const ratio = contrastRatio(OVERDUE_RED, '#ffffff');
    expect(ratio).toBeLessThan(7);
    expect(ratio).toBeGreaterThan(4.9);
  });

  test('the stylesheet uses the red for the card border and the marker background', () => {
    expect(styles).toMatch(/\.task-card\.overdue,\s*\.task-result-card\.overdue\s*\{[^}]*border:\s*2px solid #d32f2f/);
    expect(styles).toMatch(/\.overdue-indicator\s*\{[^}]*background-color:\s*#d32f2f/);
  });
});

describe('Wave 4 accessibility: focus visibility (Task 4.3, manifest TC-035)', () => {
  test('no stylesheet rule removes the outline from buttons, so the browser focus ring stays visible', () => {
    // Matches rules whose selector targets a button and whose body sets outline: none.
    const suppressesButtonFocus = /(^|[\s,}])button[^{]*\{[^}]*outline\s*:\s*none/i.test(styles);
    expect(suppressesButtonFocus).toBe(false);
  });

  test('input focus styling is the only outline override, and it is replaced by a visible box-shadow', () => {
    expect(styles).toMatch(/input:focus,\s*textarea:focus,\s*select:focus\s*\{[^}]*box-shadow/);
  });
});
