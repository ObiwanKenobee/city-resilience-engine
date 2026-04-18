import { useEffect, useMemo } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { LEVERS, LeverId, computeWhatIf } from "@/data/whatif";
import { ScenarioId, riskColor } from "@/data/nyc";
import { useWhatIf } from "@/state/WhatIfContext";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  scenario: ScenarioId;
  year: number;
}

export const WhatIfSimulator = ({ open, onOpenChange, scenario, year }: Props) => {
  const { alloc, setAlloc, reset } = useWhatIf();

  useEffect(() => {
    if (!open) return;
  }, [open]);

  const result = useMemo(() => computeWhatIf(scenario, year, alloc), [scenario, year, alloc]);

  const set = (id: LeverId, v: number) => setAlloc({ ...alloc, [id]: v });
  const maxCommit = () =>
    setAlloc(Object.fromEntries(LEVERS.map((l) => [l.id, l.saturationB])) as typeof alloc);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[1100px] w-[96vw] max-h-[92vh] overflow-hidden p-0 border border-primary/40
                   bg-background gap-0 sm:rounded-sm
                   data-[state=open]:animate-whatif-in data-[state=closed]:animate-whatif-out"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-border bg-surface flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-sm bg-primary/10 border border-primary/40 flex items-center justify-center">
              <div className="w-2.5 h-2.5 bg-primary rounded-sm shadow-[0_0_12px_hsl(var(--primary))]" />
            </div>
            <div>
              <div className="text-[10px] font-mono tracking-[0.25em] text-primary">WHAT-IF SIMULATOR</div>
              <div className="text-base font-semibold">Policy Mix Console</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground hidden sm:inline">
              SCENARIO {scenario.toUpperCase()} · HORIZON {year}
            </span>
            <button onClick={reset} className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground hover:text-foreground px-2.5 py-1 rounded-sm border border-border hover:border-border-strong">
              RESET
            </button>
            <button onClick={maxCommit} className="text-[10px] font-mono tracking-[0.2em] text-primary px-2.5 py-1 rounded-sm border border-primary/40 hover:bg-primary/10">
              MAX COMMIT
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] min-h-0 overflow-hidden">
          {/* LEFT — levers */}
          <div className="p-5 space-y-3 overflow-y-auto bg-grid relative">
            <div className="absolute inset-0 bg-aurora pointer-events-none" />
            <div className="relative space-y-3">
              {LEVERS.map((l, i) => {
                const eff = result.mix.perLever[l.id];
                const cap = alloc[l.id];
                const pct = cap / l.saturationB;
                return (
                  <div key={l.id} className="panel rounded-sm p-4 animate-float-up"
                       style={{ animationDelay: `${80 + i * 60}ms` }}>
                    <div className="flex items-baseline justify-between gap-3">
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-[10px] font-mono tracking-[0.2em] text-primary">{l.code}</span>
                          <span className="text-sm font-semibold">{l.name}</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">{l.blurb}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground">CAPITAL</div>
                        <div className="text-xl font-mono font-semibold tabular text-primary">
                          ${cap.toFixed(1)}<span className="text-xs text-muted-foreground">B</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3">
                      <input
                        type="range" min={0} max={l.saturationB} step={0.5}
                        value={cap}
                        onChange={(e) => set(l.id, Number(e.target.value))}
                        className="w-full h-1 bg-muted rounded-sm appearance-none cursor-pointer accent-primary
                                   [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4
                                   [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-sm
                                   [&::-webkit-slider-thumb]:bg-primary
                                   [&::-webkit-slider-thumb]:shadow-[0_0_12px_hsl(var(--primary))]"
                      />
                      <div className="flex justify-between mt-1.5 text-[9px] font-mono text-muted-foreground tabular">
                        <span>$0</span>
                        <span className="text-foreground">{(pct * 100).toFixed(0)}% deployed · effect {(eff * 100).toFixed(0)}%</span>
                        <span>${l.saturationB}B</span>
                      </div>
                    </div>

                    {/* Per-vector chips */}
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      <VectorChip label="FLOOD" weight={l.flood} eff={eff} />
                      <VectorChip label="HEAT" weight={l.heat} eff={eff} />
                      <VectorChip label="INFRA" weight={l.infra} eff={eff} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT — live readout */}
          <div className="border-l border-border bg-surface/60 backdrop-blur p-5 space-y-3 overflow-y-auto">
            <div className="text-[10px] font-mono tracking-[0.25em] text-muted-foreground flex items-center gap-2">
              <span className="ticker-dot" /> LIVE OUTPUT
            </div>

            <Big label="TOTAL CAPITAL" value={`$${result.mix.totalCapitalB.toFixed(1)}B`} tone="primary" />
            <Big label="AVOIDED LOSS" value={`$${result.avoidedLossB.toFixed(0)}B`} tone="good"
                 sub={`vs $${result.baseline.assetAtRiskB.toFixed(0)}B baseline`} />
            <Big label="BLENDED ROI"
                 value={result.mix.totalCapitalB > 0 ? `${result.blendedROI.toFixed(1)}x` : "—"}
                 tone={result.blendedROI >= 1 ? "good" : "warning"}
                 sub={result.blendedROI >= 3 ? "Highly cost-effective" : result.blendedROI >= 1 ? "Net positive" : "Sub-economic"} />
            <Big label="POPULATION SAVED"
                 value={`${(result.avoidedPopK / 1000).toFixed(2)}M`}
                 tone="primary" />

            <div className="panel rounded-sm p-3">
              <div className="text-[10px] font-mono tracking-[0.25em] text-muted-foreground mb-2">RESIDUAL RISK</div>
              <ResidualBar label="FLOOD" mit={result.mix.flood} />
              <ResidualBar label="HEAT" mit={result.mix.heat} />
              <ResidualBar label="INFRA" mit={result.mix.infra} />
              <div className="mt-3 pt-3 border-t border-border flex items-baseline justify-between">
                <span className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground">COMPOSITE</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-mono text-muted-foreground line-through tabular">
                    {(result.baseline.composite * 100).toFixed(1)}
                  </span>
                  <span key={result.mitigated.composite.toFixed(2)}
                        className="text-2xl font-mono font-semibold tabular animate-num-pop"
                        style={{ color: riskColor(result.mitigated.composite) }}>
                    {(result.mitigated.composite * 100).toFixed(1)}
                  </span>
                </div>
              </div>
            </div>

            <div className="panel rounded-sm p-3">
              <div className="text-[10px] font-mono tracking-[0.25em] text-muted-foreground mb-2">VERDICT</div>
              <div className="text-xs leading-relaxed">{verdictFor(result)}</div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const VectorChip = ({ label, weight, eff }: { label: string; weight: number; eff: number }) => {
  const intensity = weight * eff;
  return (
    <div className="rounded-sm border border-border bg-surface-raised/60 px-2 py-1.5">
      <div className="text-[8px] font-mono tracking-[0.15em] text-muted-foreground">{label}</div>
      <div className="flex items-center gap-1.5 mt-1">
        <div className="flex-1 h-1 bg-muted rounded-sm overflow-hidden">
          <div className="h-full bg-primary rounded-sm transition-[width] duration-500 ease-out"
               style={{ width: `${intensity * 100}%`, boxShadow: intensity > 0 ? "0 0 6px hsl(var(--primary))" : undefined }} />
        </div>
        <span className="text-[9px] font-mono tabular text-foreground/70 w-7 text-right">
          {(intensity * 100).toFixed(0)}
        </span>
      </div>
    </div>
  );
};

const Big = ({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: "primary" | "good" | "warning" }) => {
  const c = tone === "good" ? "text-risk-low" : tone === "warning" ? "text-secondary" : "text-primary";
  return (
    <div className="panel rounded-sm p-3">
      <div className="text-[10px] font-mono tracking-[0.25em] text-muted-foreground">{label}</div>
      <div key={value} className={`text-3xl font-mono font-semibold tabular ${c} mt-1 text-glow animate-num-pop`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
};

const ResidualBar = ({ label, mit }: { label: string; mit: number }) => {
  const reduced = (1 - mit) * 100;
  return (
    <div className="mb-2.5 last:mb-0">
      <div className="flex justify-between text-[10px] font-mono mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-risk-low tabular">−{reduced.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 bg-muted rounded-sm overflow-hidden flex">
        <div className="h-full bg-risk-low/80 rounded-l-sm transition-[width] duration-700 ease-out"
             style={{ width: `${reduced}%`, boxShadow: "0 0 6px hsl(var(--risk-low))" }} />
        <div className="h-full bg-risk-extreme/60 transition-[width] duration-700 ease-out"
             style={{ width: `${100 - reduced}%` }} />
      </div>
    </div>
  );
};

function verdictFor(r: ReturnType<typeof computeWhatIf>): string {
  if (r.mix.totalCapitalB === 0) return "No capital deployed. The city absorbs the full baseline exposure under this scenario.";
  if (r.blendedROI > 5) return "Exceptional leverage. Capital structure is dominated by high-saturation, low-overlap interventions. Recommend committing.";
  if (r.blendedROI > 2.5) return "Strong portfolio. Marginal returns positive across all vectors. Consider one additional structural lever.";
  if (r.blendedROI > 1) return "Net positive but sub-optimal. Allocation is over-saturated in one group; reallocate to thermal or structural levers.";
  return "Diminishing returns dominate. Trim coastal allocation and shift toward zoning + cooling for higher leverage.";
}
