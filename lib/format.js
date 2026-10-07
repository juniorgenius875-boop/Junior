export function pct(value, digits = 0) {
  if (!Number.isFinite(Number(value))) return "—";
  return `${Number(value).toFixed(digits)}%`;
}

export function pp(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "—";
  const n = Number(value);
  return `${n > 0 ? "+" : ""}${n.toFixed(0)} pp`;
}

export function statusTone(status = "") {
  const s = String(status).toLowerCase();
  if (s.includes("master") || s.includes("strong")) return "success";
  if (s.includes("board ready") || s === "good") return "blue";
  if (s.includes("weak") || s.includes("attention")) return "danger";
  if (s.includes("develop") || s.includes("revision")) return "warning";
  return "neutral";
}
