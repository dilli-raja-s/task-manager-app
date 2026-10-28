/**
 * Decorative overdue marker icon. Markup is hardcoded (no user-controlled
 * content), so it is XSS-safe. aria-hidden keeps it out of the accessibility
 * tree; the surrounding element carries the accessible label.
 *
 * Named .jsx (not .js) so the Vite React plugin compiles the JSX.
 *
 * @returns {JSX.Element}
 */
export function getOverdueIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="6" cy="6" r="5.5" fill="currentColor" stroke="none" />
      <text
        x="6"
        y="7.5"
        fontSize="8"
        fontWeight="bold"
        textAnchor="middle"
        fill="white"
        fontFamily="system-ui"
      >
        !
      </text>
    </svg>
  );
}
