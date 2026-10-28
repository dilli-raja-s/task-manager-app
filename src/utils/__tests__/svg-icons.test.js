import { render } from '@testing-library/react';
import { getOverdueIcon } from '../svg-icons.jsx';

describe('getOverdueIcon', () => {
  test('renders an SVG with the expected 12x12 viewBox', () => {
    const { container } = render(getOverdueIcon());
    const svg = container.querySelector('svg');

    expect(svg).not.toBeNull();
    expect(svg.getAttribute('width')).toBe('12');
    expect(svg.getAttribute('height')).toBe('12');
    expect(svg.getAttribute('viewBox')).toBe('0 0 12 12');
  });

  test('is decorative and hidden from assistive technology', () => {
    const { container } = render(getOverdueIcon());
    expect(container.querySelector('svg').getAttribute('aria-hidden')).toBe('true');
  });

  test('contains only the hardcoded exclamation mark glyph', () => {
    const { container } = render(getOverdueIcon());
    const text = container.querySelector('svg text');

    expect(text).not.toBeNull();
    expect(text.textContent).toBe('!');
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('foreignObject')).toBeNull();
  });

  test('uses currentColor for the badge so it inherits the surrounding theme', () => {
    const { container } = render(getOverdueIcon());
    expect(container.querySelector('circle').getAttribute('fill')).toBe('currentColor');
  });
});
