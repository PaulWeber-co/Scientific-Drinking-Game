/** Eine Kennzahl-Kachel im Raster – Wert groß, Beschriftung klein darunter. */
export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="stat">
      <div className="stat__value t-mono-num">{value}</div>
      <div className="t-caption">{label}</div>
      {hint && <div className="t-caption" style={{ opacity: 0.6 }}>{hint}</div>}
    </div>
  );
}
