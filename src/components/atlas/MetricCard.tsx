interface Props {
  label: string;
  value: string;
  unit?: string;
  delta?: string;
  tone?: "primary" | "warning" | "danger" | "good" | "muted";
  sub?: string;
  spark?: number[];
}

const toneClass = {
  primary: "text-primary",
  warning: "text-secondary",
  danger: "text-risk-extreme",
  good: "text-risk-low",
  muted: "text-foreground",
};

export const MetricCard = ({ label, value, unit, delta, tone = "muted", sub, spark }: Props) => {
  return (
    <div className="panel rounded-sm p-3.5 relative overflow-hidden">
      <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="flex items-baseline gap-1.5 mt-1.5">
        <div className={`text-2xl font-mono font-semibold tabular ${toneClass[tone]}`}>
          {value}
        </div>
        {unit && <div className="text-xs font-mono text-muted-foreground">{unit}</div>}
      </div>
      <div className="flex items-center justify-between mt-1">
        {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
        {delta && (
          <div className={`text-[10px] font-mono tabular ${toneClass[tone]}`}>
            {delta}
          </div>
        )}
      </div>
      {spark && <Sparkline data={spark} tone={tone} />}
    </div>
  );
};

const Sparkline = ({ data, tone }: { data: number[]; tone: Props["tone"] }) => {
  const max = Math.max(...data, 0.0001);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 100, h = 24;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const stroke = tone === "danger" ? "hsl(var(--risk-extreme))"
    : tone === "warning" ? "hsl(var(--secondary))"
    : tone === "good" ? "hsl(var(--risk-low))"
    : "hsl(var(--primary))";
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-6 mt-2" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="1.2" opacity="0.9" />
      <polyline points={`0,${h} ${pts} ${w},${h}`} fill={stroke} opacity="0.12" />
    </svg>
  );
};
