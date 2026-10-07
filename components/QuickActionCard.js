import Link from "next/link";
import Icon from "@/components/Icons";

export default function QuickActionCard({ href, title, text, icon = "arrow", tone = "blue" }) {
  return <Link href={href} className={`quick-action-card tone-${tone}`}>
    <span className="quick-action-icon"><Icon name={icon} size={20}/></span>
    <span className="quick-action-copy"><strong>{title}</strong><small>{text}</small></span>
    <span className="quick-action-arrow"><Icon name="chevron" size={16}/></span>
  </Link>;
}
