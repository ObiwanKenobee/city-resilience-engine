import { useState } from "react";
import { TopBar } from "@/components/atlas/TopBar";
import { RiskMap } from "@/components/atlas/RiskMap";
import { ScenarioPanel } from "@/components/atlas/ScenarioPanel";
import { DecisionPanel } from "@/components/atlas/DecisionPanel";
import { Ticker } from "@/components/atlas/Ticker";
import type { DistrictId, ScenarioId } from "@/data/nyc";

const Index = () => {
  const [scenario, setScenario] = useState<ScenarioId>("rcp85");
  const [year, setYear] = useState(2050);
  const [selected, setSelected] = useState<DistrictId | null>("lower-manhattan");
  const [layer, setLayer] = useState<"composite" | "flood" | "heat" | "infrastructure">("composite");

  return (
    <div className="dark min-h-screen flex flex-col bg-background text-foreground">
      <TopBar />

      <main className="flex-1 grid grid-cols-1 xl:grid-cols-[340px_1fr_400px] gap-3 p-3 min-h-0">
        {/* LEFT — scenario controls */}
        <aside className="space-y-3 min-h-0 overflow-y-auto">
          <ScenarioPanel
            value={scenario} onChange={setScenario}
            year={year} onYearChange={setYear}
            layer={layer} onLayerChange={setLayer}
          />
          <BriefingCard scenario={scenario} year={year} />
        </aside>

        {/* CENTER — map */}
        <section className="panel rounded-sm relative min-h-[480px] xl:min-h-0 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 z-10 px-4 py-2.5 flex items-center justify-between border-b border-border bg-surface/70 backdrop-blur">
            <div>
              <div className="text-[10px] font-mono tracking-[0.25em] text-muted-foreground">SPATIAL INTELLIGENCE</div>
              <div className="text-sm font-medium">New York City · Decision Twin</div>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
              <span className="ticker-dot" />
              <span>{(9 + Math.floor(Math.random() * 3))} ZONES · 4.31M ASSETS</span>
            </div>
          </div>
          <div className="absolute inset-0 pt-[58px]">
            <RiskMap scenario={scenario} year={year} selected={selected} onSelect={setSelected} layer={layer} />
          </div>
        </section>

        {/* RIGHT — decision intelligence */}
        <aside className="min-h-0">
          <DecisionPanel scenario={scenario} year={year} selected={selected} />
        </aside>
      </main>

      <Ticker scenario={scenario} year={year} />
    </div>
  );
};

const BriefingCard = ({ scenario, year }: { scenario: ScenarioId; year: number }) => {
  const sea = (((year - 2025) / 75) * (scenario === "rcp85" ? 1.2 : 0.6)).toFixed(2);
  return (
    <div className="panel rounded-sm p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-aurora pointer-events-none" />
      <div className="relative">
        <div className="text-[10px] font-mono tracking-[0.25em] text-muted-foreground">EXECUTIVE BRIEFING</div>
        <div className="text-xs leading-relaxed mt-2 text-foreground/85">
          By <span className="font-mono text-primary tabular">{year}</span>, sea level rises{" "}
          <span className="font-mono text-secondary tabular">+{sea}m</span> under this trajectory.
          Coastal districts face material repricing. Capital deployed pre-2045 yields{" "}
          <span className="font-mono text-risk-low">3–7×</span> avoided loss.
        </div>
        <div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-between">
          <span className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground">SOURCE</span>
          <span className="text-[10px] font-mono text-foreground/70">NOAA · NASA · FEMA · NYC.OD</span>
        </div>
      </div>
    </div>
  );
};

export default Index;
