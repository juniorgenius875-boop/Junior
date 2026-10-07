import Icon from "@/components/Icons";

const toneIcon = { blue: "activity", success: "check", purple: "spark", orange: "clock", red: "target" };

export default function StatCard({ label, value, helper, tone = "blue", icon }) {
  return (
    <div className={`stat-card ${tone} stat-card-modern`}>
      <div className="stat-card-top">
        <span className="stat-icon"><Icon name={icon || toneIcon[tone] || "activity"} size={17}/></span>
        <span className="stat-label">{label}</span>
      </div>
      <strong className="stat-value">{value}</strong>
      {helper && <small>{helper}</small>}
    </div>
  );
}
