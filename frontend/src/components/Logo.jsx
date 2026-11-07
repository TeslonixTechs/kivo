export default function Logo({ compact = false }) {
  return (
    <div className="brand-lockup" aria-label="Kivo">
      <img src="/kivo-logo.png" alt="" />
      {!compact && <span>Kivo</span>}
    </div>
  );
}
