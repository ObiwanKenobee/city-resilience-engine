import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { TopBar } from "@/components/atlas/TopBar";
import { Ticker } from "@/components/atlas/Ticker";
import {
  parseAssetText, computeAssetExposure, rollup, SAMPLE_PORTFOLIO,
  AssetExposure,
} from "@/data/assets";
import { ScenarioId, SCENARIOS, riskColor } from "@/data/nyc";
import { useToast } from "@/hooks/use-toast";
import { generateAssetMemo } from "@/lib/assetMemo";

const Assets = () => {
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const scenario = (params.get("scenario") as ScenarioId) ?? "rcp85";
  const year = Number(params.get("year") ?? 2050);

  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ReturnType<typeof parseAssetText> | null>(null);
  const [exporting, setExporting] = useState(false);

  const exposures = useMemo<AssetExposure[]>(() => {
    if (!parsed?.rows.length) return [];
    return computeAssetExposure(parsed.rows, scenario, year);
  }, [parsed, scenario, year]);

  const roll = useMemo(() => exposures.length ? rollup(exposures) : null, [exposures]);

  const onAnalyze = () => {
    const p = parseAssetText(text);
    setParsed(p);
    if (p.errors.length) toast({ title: `${p.errors.length} row(s) skipped`, description: p.errors.slice(0, 3).join(" · ") });
    if (!p.rows.length) toast({ title: "No valid rows", description: "Need columns: id, value, and lat/lng or district." });
  };

  const onSample = () => {
    setText(SAMPLE_PORTFOLIO);
    const p = parseAssetText(SAMPLE_PORTFOLIO);
    setParsed(p);
  };

  const onUpload = (f: File) => {
    const r = new FileReader();
    r.onload = () => {
      const txt = String(r.result ?? "");
      setText(txt);
      const p = parseAssetText(txt);
      setParsed(p);
    };
    r.readAsText(f);
  };

  const setScenario = (s: ScenarioId) => { params.set("scenario", s); setParams(params); };
  const setYear = (y: number) => { params.set("year", String(y)); setParams(params); };

  const onExport = async () => {
    if (!roll || exporting) return;
    setExporting(true);
    try {
      await generateAssetMemo({
        scenario, year, exposures, roll,
        onProgress: (msg) => toast({ title: "Underwriter brief", description: msg }),
      });
      toast({ title: "Portfolio brief exported", description: "PDF saved to your downloads." });
    } catch (e) {
      console.error(e);
      toast({ title: "Export failed", description: "Could not generate brief.", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="dark min-h-screen flex flex-col bg-background text-foreground">
      <TopBar />
      <main className="flex-1 grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-3 p-3 min-h-0">
        {/* LEFT — input */}
        <aside className="space-y-3 min-h-0 overflow-y-auto">
          <div className="panel rounded-sm">
            <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="ticker-dot" />
                <span className="text-[10px] font-mono tracking-[0.25em] text-muted-foreground">PORTFOLIO INPUT</span>
              </div>
              <Link to="/" className="text-[10px] font-mono tracking-[0.2em] text-primary hover:underline">← MAP</Link>
            </div>
            <div className="p-4 space-y-3">
              <div className="text-xs text-muted-foreground leading-relaxed">
                Paste a CSV or upload one. Required: <span className="font-mono text-foreground">id, value</span>{" "}
                + either <span className="font-mono text-foreground">lat,lng</span> or <span className="font-mono text-foreground">district</span>.
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={"id,lat,lng,value\nOne WTC,40.7127,-74.0134,3800\n…"}
                className="w-full h-44 bg-surface border border-border rounded-sm p-3 text-xs font-mono
                           text-foreground placeholder:text-muted-foreground/50 focus:outline-none
                           focus:border-primary/60 focus:ring-1 focus:ring-primary/30 resize-none"
              />
              <div className="grid grid-cols-3 gap-2">
                <button onClick={onAnalyze}
                  className="text-[11px] font-mono tracking-[0.15em] py-2 rounded-sm bg-primary/10 border border-primary/40 text-primary hover:bg-primary/20 transition-colors">
                  ANALYZE
                </button>
                <button onClick={onSample}
                  className="text-[11px] font-mono tracking-[0.15em] py-2 rounded-sm border border-border text-foreground hover:border-border-strong">
                  SAMPLE
                </button>
                <label className="text-[11px] font-mono tracking-[0.15em] py-2 rounded-sm border border-border text-foreground hover:border-border-strong cursor-pointer text-center">
                  UPLOAD
                  <input type="file" accept=".csv,.txt,.tsv" className="hidden"
                         onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
                </label>
              </div>
              {parsed?.errors.length ? (
                <div className="text-[10px] font-mono text-secondary/90 bg-secondary/5 border border-secondary/30 rounded-sm p-2 max-h-24 overflow-y-auto">
                  {parsed.errors.map((e, i) => <div key={i}>· {e}</div>)}
                </div>
              ) : null}
            </div>
          </div>

          {/* Scenario+year micro-controls */}
          <div className="panel rounded-sm p-4 space-y-3">
            <div className="text-[10px] font-mono tracking-[0.25em] text-muted-foreground">EVALUATION CONTEXT</div>
            <div className="grid grid-cols-2 gap-2">
              {SCENARIOS.map((s) => (
                <button key={s.id} onClick={() => setScenario(s.id)}
                  className={`text-left px-2.5 py-2 rounded-sm border text-[11px] font-mono tracking-[0.15em] transition-colors ${
                    scenario === s.id
                      ? "border-primary/60 text-primary bg-primary/10"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-border-strong"
                  }`}>
                  {s.code}
                </button>
              ))}
            </div>
            <div>
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-[10px] font-mono tracking-[0.25em] text-muted-foreground">HORIZON</span>
                <span className="text-lg font-mono font-semibold text-primary tabular">{year}</span>
              </div>
              <input
                type="range" min={2025} max={2100} step={1}
                value={year} onChange={(e) => setYear(Number(e.target.value))}
                className="w-full h-1 bg-muted rounded-sm appearance-none cursor-pointer accent-primary
                           [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5
                           [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-sm
                           [&::-webkit-slider-thumb]:bg-primary"
              />
            </div>
          </div>
        </aside>

        {/* RIGHT — output */}
        <section className="space-y-3 min-h-0 overflow-y-auto">
          {!roll ? (
            <div className="panel rounded-sm p-12 text-center">
              <div className="text-5xl opacity-30 mb-4">⊞</div>
              <div className="text-sm font-medium">Asset Risk Dashboard</div>
              <div className="text-xs text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
                Drop a portfolio of NYC building addresses or coordinates with values to see per-asset exposure,
                insurance posture, and aggregated portfolio Value-at-Risk under the active scenario.
              </div>
            </div>
          ) : (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <Kpi label="ASSETS" value={`${roll.totalAssets}`} sub="evaluated" tone="primary" />
                <Kpi label="PORTFOLIO VALUE" value={`$${(roll.totalValueM / 1000).toFixed(2)}B`}
                     sub={`${roll.totalAssets} assets`} tone="primary" />
                <Kpi label="EXPECTED EXPOSURE" value={`$${(roll.totalExposureM / 1000).toFixed(2)}B`}
                     sub={`${((roll.totalExposureM / roll.totalValueM) * 100).toFixed(1)}% of value`} tone="warning" />
                <Kpi label="VaR (95%)" value={`$${(roll.totalVaR95M / 1000).toFixed(2)}B`}
                     sub={`weighted comp. ${(roll.weightedComposite * 100).toFixed(1)}`} tone="danger" />
              </div>

              {/* District concentration */}
              <div className="panel rounded-sm p-4">
                <div className="flex items-baseline justify-between mb-3">
                  <div className="text-[10px] font-mono tracking-[0.25em] text-muted-foreground">DISTRICT CONCENTRATION</div>
                  <div className="text-[10px] font-mono text-muted-foreground">
                    Uninsurable share: <span className="text-secondary tabular">{(roll.uninsurablePct * 100).toFixed(1)}%</span>
                  </div>
                </div>
                <div className="space-y-2">
                  {roll.byDistrict.map((b) => {
                    const pct = b.exposureM / roll.totalExposureM;
                    return (
                      <div key={b.district.id} className="grid grid-cols-[140px_1fr_120px_70px] gap-3 items-center text-xs">
                        <div className="font-medium truncate">{b.district.name}</div>
                        <div className="h-3 bg-muted rounded-sm overflow-hidden relative">
                          <div className="h-full transition-all duration-500"
                               style={{ width: `${pct * 100}%`,
                                        background: riskColor(b.exposureM / b.valueM),
                                        boxShadow: `0 0 8px ${riskColor(b.exposureM / b.valueM)}` }} />
                        </div>
                        <div className="text-right font-mono tabular text-muted-foreground">
                          ${b.exposureM.toFixed(0)}M / ${b.valueM.toFixed(0)}M
                        </div>
                        <div className="text-right font-mono tabular text-foreground">{b.count}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Worst-10 */}
              <div className="panel rounded-sm">
                <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
                  <span className="text-[10px] font-mono tracking-[0.25em] text-muted-foreground">TOP 10 BY EXPECTED LOSS</span>
                  <span className="text-[10px] font-mono text-muted-foreground">{exposures.length} total</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-surface">
                      <tr className="text-[9px] font-mono tracking-[0.15em] text-primary">
                        <th className="text-left px-4 py-2 font-semibold">ASSET</th>
                        <th className="text-left px-2 py-2 font-semibold">DISTRICT</th>
                        <th className="text-right px-2 py-2 font-semibold">VALUE</th>
                        <th className="text-right px-2 py-2 font-semibold">COMP</th>
                        <th className="text-right px-2 py-2 font-semibold">EXPOSURE</th>
                        <th className="text-right px-2 py-2 font-semibold">VaR95</th>
                        <th className="text-right px-4 py-2 font-semibold">POSTURE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roll.worst.map((r, i) => (
                        <tr key={i} className={i % 2 ? "bg-surface-raised/40" : ""}>
                          <td className="px-4 py-2 font-medium">{r.asset.id}</td>
                          <td className="px-2 py-2 text-muted-foreground">{r.district.name}</td>
                          <td className="px-2 py-2 text-right font-mono tabular">${r.asset.valueM.toFixed(0)}M</td>
                          <td className="px-2 py-2 text-right font-mono tabular"
                              style={{ color: riskColor(r.composite) }}>
                            {(r.composite * 100).toFixed(0)}
                          </td>
                          <td className="px-2 py-2 text-right font-mono tabular text-secondary">${r.exposureM.toFixed(1)}M</td>
                          <td className="px-2 py-2 text-right font-mono tabular text-risk-extreme">${r.var95M.toFixed(1)}M</td>
                          <td className="px-4 py-2 text-right">
                            <span className="text-[10px] font-mono tracking-[0.15em] px-2 py-0.5 rounded-sm border"
                                  style={{
                                    color: r.insurance === "UNINSURABLE" || r.insurance === "RETREAT"
                                      ? "hsl(var(--risk-extreme))"
                                      : r.insurance === "REPRICE" ? "hsl(var(--secondary))" : "hsl(var(--risk-low))",
                                    borderColor: r.insurance === "UNINSURABLE" || r.insurance === "RETREAT"
                                      ? "hsl(var(--risk-extreme) / 0.5)"
                                      : r.insurance === "REPRICE" ? "hsl(var(--secondary) / 0.5)" : "hsl(var(--risk-low) / 0.5)",
                                  }}>
                              {r.insurance}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </section>
      </main>
      <Ticker scenario={scenario} year={year} />
    </div>
  );
};

const Kpi = ({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: "primary" | "warning" | "danger" }) => {
  const c = tone === "danger" ? "text-risk-extreme" : tone === "warning" ? "text-secondary" : "text-primary";
  return (
    <div className="panel rounded-sm p-3.5">
      <div className="text-[10px] font-mono tracking-[0.25em] text-muted-foreground">{label}</div>
      <div className={`text-2xl font-mono font-semibold tabular mt-1.5 ${c}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground mt-1">{sub}</div>
    </div>
  );
};

export default Assets;
