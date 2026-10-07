import Icon from "@/components/Icons";

export default function InsightCard({ label, value, helper, icon = "spark", tone = "blue" }) {
  return <div className={`insight-card tone-${tone}`}>
    <div className="insight-icon"><Icon name={icon} size={19}/></div>
    <div className="insight-copy"><span>{label}</span><strong>{value}</strong>{helper && <small>{helper}</small>}</div>
  </div>;
}
