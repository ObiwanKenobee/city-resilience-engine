import { SCENARIOS, ScenarioId } from "@/data/nyc";

interface Props {
  value: ScenarioId;
  onChange: (id: ScenarioId) => void;
  year: number;
  onYearChange: (y: number) => void;
  layer: "composite" | "flood" | "heat" | "infrastructure";
  onLayerChange: (l: Props["layer"]) => void;
}

export const ScenarioPanel = ({ value, onChange, year, onYearChange, layer, onLayerChange }: Props) => {
  const layers = [
    { id: "composite" as const, label: "COMPOSITE" },
    { id: "flood" as const, label: "FLOOD" },
    { id: "heat" as const, label: "HEAT" },
    { id: "infrastructure" as const, label: "INFRA" },
  ];

  return (
    <div className="panel rounded-sm">
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="ticker-dot" />
          <span className="text-[10px] font-mono tracking-[0.25em] text-muted-foreground">SCENARIO ENGINE</span>
        </div>
        <span className="text-[10px] font-mono text-primary">MONTE CARLO · 10,000 RUNS</span>
      </div>

      <div className="p-4 space-y-5">
        {/* Scenario selector */}
        <div className="grid grid-cols-2 gap-2">
          {SCENARIOS.map((s) => {
            const active = value === s.id;
            return (
              <button
                key={s.id}
                onClick={() => onChange(s.id)}
                className={`text-left px-3 py-2.5 rounded-sm border transition-all ${
                  active
                    ? "border-primary/60 bg-primary/5 border-glow"
                    : "border-border hover:border-border-strong/50 bg-surface-raised/50"
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className={`text-[10px] font-mono tracking-[0.2em] ${active ? "text-primary" : "text-muted-foreground"}`}>
                    {s.code}
                  </span>
                  {s.capitalRequiredB > 0 && (
                    <span className="text-[10px] font-mono text-secondary tabular">
                      ${s.capitalRequiredB}B
                    </span>
                  )}
                </div>
                <div className="text-xs font-medium mt-0.5">{s.name}</div>
                <div className="text-[10px] text-muted-foreground mt-1 leading-tight">{s.tagline}</div>
              </button>
            );
          })}
        </div>

        {/* Time horizon */}
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-[10px] font-mono tracking-[0.25em] text-muted-foreground">TIME HORIZON</span>
            <span className="text-2xl font-mono font-semibold text-primary tabular text-glow">{year}</span>
          </div>
          <input
            type="range" min={2025} max={2100} step={1}
            value={year}
            onChange={(e) => onYearChange(Number(e.target.value))}
            className="w-full h-1 bg-muted rounded-sm appearance-none cursor-pointer accent-primary
                       [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4
                       [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-sm
                       [&::-webkit-slider-thumb]:bg-primary
                       [&::-webkit-slider-thumb]:shadow-[0_0_12px_hsl(var(--primary))]
                       [&::-webkit-slider-thumb]:cursor-grab"
          />
          <div className="flex justify-between mt-1.5 text-[9px] font-mono text-muted-foreground tabular">
            <span>2025</span><span>2050</span><span>2075</span><span>2100</span>
          </div>
        </div>

        {/* Layer toggle */}
        <div>
          <div className="text-[10px] font-mono tracking-[0.25em] text-muted-foreground mb-2">RISK LAYER</div>
          <div className="grid grid-cols-4 gap-1 p-1 bg-surface rounded-sm border border-border">
            {layers.map((l) => (
              <button
                key={l.id}
                onClick={() => onLayerChange(l.id)}
                className={`text-[10px] font-mono tracking-[0.15em] py-1.5 rounded-sm transition-all ${
                  layer === l.id
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
