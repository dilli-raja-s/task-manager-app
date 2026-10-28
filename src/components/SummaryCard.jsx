export function SummaryCard({ label, value, tone, ariaLabel }) {
  return (
    <div className={`summary-card ${tone}`} aria-label={ariaLabel}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default SummaryCard;
