export default function ProgressRing({ value = 0, label, size = "md" }) {
  const safe = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className={`progress-ring ${size}`} style={{ "--progress": `${safe * 3.6}deg` }}>
      <div className="progress-ring-inner">
        <strong>{Math.round(safe)}%</strong>
        {label && <small>{label}</small>}
      </div>
    </div>
  );
}
