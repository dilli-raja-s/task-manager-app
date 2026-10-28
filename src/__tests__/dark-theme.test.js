import { readFileSync } from 'node:fs';

// Wave 4 Task 4.4 (resolves design review F-19, LOW): dark theme applicability.
// Outcome: the app does not implement a dark theme. The stylesheet declares `color-scheme: light`
// and has no prefers-color-scheme: dark rule. TC-036 (red marker on a dark background, contrast
// >= 4.5:1) is therefore deferred as N/A. The guards below fail if dark mode is added, which
// is the trigger to implement the deferred dark-theme contrast check.
const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

describe('Dark theme applicability (F-19): dark theme not implemented, TC-036 deferred as N/A', () => {
  test('the stylesheet declares a light colour scheme only', () => {
    expect(styles).toMatch(/color-scheme:\s*light\s*;/);
    expect(styles).not.toMatch(/color-scheme:\s*[^;]*dark/);
  });

  test('the stylesheet has no prefers-color-scheme: dark rule', () => {
    expect(styles).not.toMatch(/prefers-color-scheme\s*:\s*dark/);
  });

  test('the app markup has no dark theme class or data-theme switch', () => {
    const appSource = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
    expect(appSource).not.toMatch(/data-theme|theme-dark|dark-mode/);
  });
});
