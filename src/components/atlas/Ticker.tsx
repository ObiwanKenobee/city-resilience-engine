import { useMemo } from "react";
import { computeCityTotals, ScenarioId, SCENARIOS } from "@/data/nyc";

interface Props { scenario: ScenarioId; year: number; }

export const Ticker = ({ scenario, year }: Props) => {
  const totals = useMemo(() => computeCityTotals(scenario, year), [scenario, year]);
  const items = [
    { k: "NYC.COMPOSITE", v: (totals.composite * 100).toFixed(2), u: "" },
    { k: "ASSETS.RISK", v: `$${totals.assetAtRiskB.toFixed(1)}B`, u: "" },
    { k: "POP.EXPOSED", v: `${(totals.populationExposed).toFixed(0)}K`, u: "" },
    { k: "SEA.LEVEL", v: `+${(((year - 2025) / 75) * (scenario === "rcp85" ? 1.2 : 0.6)).toFixed(2)}`, u: "M" },
    { k: "HEAT.DAYS", v: `+${Math.round(((year - 2025) / 75) * (scenario === "rcp85" ? 38 : 18))}`, u: "/YR" },
    { k: "STORM.RTRN", v: `${Math.max(7, 50 - Math.round(((year - 2025) / 75) * 43))}`, u: "YR" },
    { k: "SCENARIO", v: SCENARIOS.find((s) => s.id === scenario)!.code, u: "" },
    { k: "MODEL", v: "BAYES-MC.v3", u: "" },
  ];
  return (
    <div className="border-t border-border bg-surface/80 backdrop-blur-xl overflow-hidden">
      <div className="flex items-center gap-6 px-6 h-9 text-[11px] font-mono whitespace-nowrap overflow-x-auto">
        {items.map((it) => (
          <div key={it.k} className="flex items-center gap-2">
            <span className="text-muted-foreground tracking-[0.15em]">{it.k}</span>
            <span className="text-primary tabular">{it.v}{it.u}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
