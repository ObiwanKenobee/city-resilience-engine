import { useMemo, useState } from "react";
import { computeCityTotals, computeRisk, DISTRICTS, DistrictId, ScenarioId, SCENARIOS, riskLabel, riskColor } from "@/data/nyc";
import { MetricCard } from "./MetricCard";
import { generateDecisionMemo } from "@/lib/decisionMemo";
import { useToast } from "@/hooks/use-toast";
import { useWhatIf } from "@/state/WhatIfContext";

interface Props {
  scenario: ScenarioId;
  year: number;
  selected: DistrictId | null;
  mapRef: React.RefObject<HTMLDivElement>;
}

export const DecisionPanel = ({ scenario, year, selected, mapRef }: Props) => {
  const { toast } = useToast();
  const { isActive: whatIfActive, alloc, computeFor } = useWhatIf();
  const [exporting, setExporting] = useState(false);
  const totals = useMemo(() => computeCityTotals(scenario, year), [scenario, year]);
  const district = selected ? DISTRICTS.find((d) => d.id === selected)! : null;
  const districtRisk = district ? computeRisk(district, scenario, year) : null;
  const scenarioMeta = SCENARIOS.find((s) => s.id === scenario)!;
  const whatIf = useMemo(() => computeFor(scenario, year), [computeFor, scenario, year]);

  const spark = useMemo(() => {
    const years = Array.from({ length: 8 }, (_, i) => 2025 + Math.round(((year - 2025) * i) / 7));
    return years.map((y) => computeCityTotals(scenario, y));
  }, [scenario, year]);

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await generateDecisionMemo({
        scenario, year, selected,
        mapElement: mapRef.current,
        whatIf: whatIfActive ? { alloc, result: whatIf } : undefined,
        onProgress: (msg) => toast({ title: "Atlas Memo", description: msg }),
      });
      toast({ title: "Decision memo exported", description: "PDF saved to your downloads." });
    } catch (e) {
      console.error(e);
      toast({ title: "Export failed", description: "Could not generate memo.", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const copyShareLink = async () => {
    const url = `${window.location.origin}/?scenario=${scenario}&year=${year}${selected ? `&district=${selected}` : ""}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied", description: "Same scenario state — paste anywhere." });
    } catch {
      toast({ title: "Copy failed", description: url, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-3 h-full overflow-y-auto pr-1">
      {/* Header */}
      <div className="panel rounded-sm px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] font-mono tracking-[0.25em] text-muted-foreground">DECISION INTELLIGENCE</div>
            <div className="text-sm font-medium mt-0.5">{scenarioMeta.name}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-mono text-muted-foreground">CONFIDENCE</div>
            <div className="text-sm font-mono text-primary tabular">{(78 + (year % 9)).toFixed(1)}%</div>
          </div>
        </div>
        <div className="text-[11px] text-muted-foreground mt-2 leading-relaxed">{scenarioMeta.description}</div>
      </div>

      {/* City-level KPIs */}
      <div className="grid grid-cols-2 gap-2">
        <MetricCard
          label="ASSETS AT RISK"
          value={`$${totals.assetAtRiskB.toFixed(0)}`} unit="B"
          tone="danger"
          sub={`${((totals.assetAtRiskB / totals.totalAssets) * 100).toFixed(1)}% of portfolio`}
          spark={spark.map((s) => s.assetAtRiskB)}
        />
        <MetricCard
          label="POPULATION EXPOSED"
          value={`${(totals.populationExposed / 1000).toFixed(2)}`} unit="M"
          tone="warning"
          sub={`of ${(totals.totalPop / 1000).toFixed(1)}M residents`}
          spark={spark.map((s) => s.populationExposed)}
        />
        <MetricCard
          label="COST OF INACTION"
          value={`$${Math.max(0, totals.costOfInactionB).toFixed(0)}`} unit="B"
          tone="danger"
          sub="vs scenario capital"
        />
        <MetricCard
          label={totals.capitalRequiredB > 0 ? "ROI · MITIGATION" : "MITIGATION"}
          value={totals.capitalRequiredB > 0 ? `${totals.roiOfAction.toFixed(1)}x` : "—"}
          tone={totals.capitalRequiredB > 0 ? "good" : "muted"}
          sub={totals.capitalRequiredB > 0 ? `$${totals.capitalRequiredB}B capital` : "no plan active"}
        />
      </div>

      {/* District drill-down */}
      <div className="panel rounded-sm">
        <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
          <span className="text-[10px] font-mono tracking-[0.25em] text-muted-foreground">DISTRICT INTELLIGENCE</span>
          {district && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-sm border"
                  style={{ borderColor: riskColor(districtRisk!.composite), color: riskColor(districtRisk!.composite) }}>
              {riskLabel(districtRisk!.composite)}
            </span>
          )}
        </div>
        {district && districtRisk ? (
          <div className="p-4 space-y-3">
            <div>
              <div className="text-base font-semibold">{district.name}</div>
              <div className="text-[11px] text-muted-foreground font-mono">
                {district.borough.toUpperCase()} · POP {district.population}K · ASSETS ${district.assetValueB}B · ELEV {district.baseElevation}M
              </div>
            </div>

            <Bar label="FLOOD" v={districtRisk.flood} />
            <Bar label="HEAT" v={districtRisk.heat} />
            <Bar label="INFRASTRUCTURE" v={districtRisk.infrastructure} />
            <Bar label="COMPOSITE" v={districtRisk.composite} bold />

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
              <Stat label="VALUE DROP" value={`-${(districtRisk.propertyDropPct * 100).toFixed(1)}%`} tone="danger" />
              <Stat label="ASSETS AT RISK" value={`$${districtRisk.assetAtRiskB.toFixed(1)}B`} tone="warning" />
              <Stat label="POP EXPOSED" value={`${districtRisk.populationExposed.toFixed(0)}K`} tone="warning" />
              <Stat label="INSURANCE" value={districtRisk.composite > 0.6 ? "RETREAT" : districtRisk.composite > 0.4 ? "REPRICE" : "STABLE"}
                    tone={districtRisk.composite > 0.6 ? "danger" : districtRisk.composite > 0.4 ? "warning" : "good"} />
            </div>

            <div className="mt-3 p-3 rounded-sm bg-primary/5 border border-primary/20">
              <div className="text-[10px] font-mono tracking-[0.2em] text-primary mb-1">→ RECOMMENDED ACTION</div>
              <div className="text-xs leading-relaxed">{recommendFor(district.id, districtRisk.composite, scenario)}</div>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-xs text-muted-foreground">
            <div className="opacity-60 mb-2">⌖</div>
            Select a district on the map to drill into building-level intelligence.
          </div>
        )}
      </div>

      {/* Export */}
      <button
        onClick={handleExport}
        disabled={exporting}
        className="w-full panel rounded-sm px-4 py-3 hover:border-primary/50 transition-all group disabled:opacity-60 disabled:cursor-wait"
      >
        <div className="flex items-center justify-between">
          <div className="text-left">
            <div className="text-[10px] font-mono tracking-[0.25em] text-primary">
              {exporting ? "GENERATING…" : "EXPORT"}
            </div>
            <div className="text-sm font-medium mt-0.5">
              {exporting ? "Composing institutional memo" : "Generate Decision Memo"}
            </div>
          </div>
          <div className={`text-primary transition-transform ${exporting ? "animate-pulse" : "group-hover:translate-x-1"}`}>
            {exporting ? "◐" : "→"}
          </div>
        </div>
      </button>
    </div>
  );
};

const Bar = ({ label, v, bold }: { label: string; v: number; bold?: boolean }) => (
  <div>
    <div className="flex justify-between text-[10px] font-mono mb-1">
      <span className={bold ? "text-foreground" : "text-muted-foreground"}>{label}</span>
      <span className="tabular" style={{ color: riskColor(v) }}>{(v * 100).toFixed(1)}</span>
    </div>
    <div className="h-1.5 bg-muted rounded-sm overflow-hidden">
      <div className="h-full rounded-sm transition-all duration-700"
           style={{ width: `${v * 100}%`, background: riskColor(v), boxShadow: `0 0 8px ${riskColor(v)}` }} />
    </div>
  </div>
);

const Stat = ({ label, value, tone }: { label: string; value: string; tone: "danger" | "warning" | "good" }) => {
  const c = tone === "danger" ? "text-risk-extreme" : tone === "warning" ? "text-secondary" : "text-risk-low";
  return (
    <div className="bg-surface-raised/50 rounded-sm px-2.5 py-2 border border-border/60">
      <div className="text-[9px] font-mono tracking-[0.15em] text-muted-foreground">{label}</div>
      <div className={`text-sm font-mono font-semibold tabular mt-0.5 ${c}`}>{value}</div>
    </div>
  );
};

const recommendFor = (id: DistrictId, c: number, scenario: ScenarioId): string => {
  if (scenario === "retreat") return "Phase buyouts over 15 yrs. Transfer density to upland nodes. Capital recoverable via density credits.";
  if (c > 0.7) return "Immediate seawall + elevated infrastructure. Underwriting moratorium below floor-2. Capital deployment critical pre-2045.";
  if (c > 0.5) return "Reprice insurance, mandate green roofs + permeable surfaces. Issue resilience-linked municipal bonds.";
  if (c > 0.3) return "Update zoning, require flood-aware new builds. Stress-test mortgage portfolios on 2050 horizon.";
  return "Monitor quarterly. Allocate <2% of district capex to preventive resilience. Maintain underwriting posture.";
};
