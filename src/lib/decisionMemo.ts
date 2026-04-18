import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import QRCode from "qrcode";
import {
  DISTRICTS, SCENARIOS, ScenarioId, DistrictId,
  computeRisk, computeCityTotals, riskLabel,
} from "@/data/nyc";
import { Allocation, computeWhatIf, LEVERS } from "@/data/whatif";

const recommendFor = (c: number, scenario: ScenarioId): string => {
  if (scenario === "retreat") return "Phase buyouts over 15 years. Transfer density to upland nodes. Capital recoverable via density credits and avoided loss.";
  if (c > 0.7) return "Immediate seawall construction and elevated infrastructure. Underwriting moratorium below floor-2. Capital deployment critical pre-2045.";
  if (c > 0.5) return "Reprice insurance, mandate green roofs and permeable surfaces. Issue resilience-linked municipal bonds at AA-rated tranche.";
  if (c > 0.3) return "Update zoning, require flood-aware new builds. Stress-test mortgage portfolios on the 2050 horizon.";
  return "Monitor quarterly. Allocate <2% of district capex to preventive resilience. Maintain underwriting posture.";
};

interface MemoArgs {
  scenario: ScenarioId;
  year: number;
  selected: DistrictId | null;
  mapElement: HTMLElement | null;
  shareUrl?: string;
  whatIf?: { alloc: Allocation; result: ReturnType<typeof computeWhatIf> };
  onProgress?: (msg: string) => void;
}

const C = {
  bg: [10, 14, 22] as [number, number, number],
  surface: [14, 19, 28] as [number, number, number],
  surfaceAlt: [16, 22, 32] as [number, number, number],
  border: [40, 56, 70] as [number, number, number],
  fg: [228, 234, 240] as [number, number, number],
  muted: [130, 145, 160] as [number, number, number],
  primary: [26, 240, 255] as [number, number, number],
  amber: [255, 176, 38] as [number, number, number],
  riskLow: [38, 220, 168] as [number, number, number],
  riskMed: [255, 176, 38] as [number, number, number],
  riskHigh: [255, 95, 51] as [number, number, number],
  riskExt: [243, 36, 76] as [number, number, number],
};

const riskRgb = (v: number): [number, number, number] => {
  if (v < 0.25) return C.riskLow;
  if (v < 0.5) return C.riskMed;
  if (v < 0.75) return C.riskHigh;
  return C.riskExt;
};

export async function generateDecisionMemo({ scenario, year, selected, mapElement, shareUrl, whatIf, onProgress }: MemoArgs) {
  const scenarioMeta = SCENARIOS.find((s) => s.id === scenario)!;
  const totals = computeCityTotals(scenario, year);
  const district = selected ? DISTRICTS.find((d) => d.id === selected) ?? null : null;
  const districtRisk = district ? computeRisk(district, scenario, year) : null;

  onProgress?.("Capturing spatial intelligence…");

  let mapImg: string | null = null;
  if (mapElement) {
    try {
      const canvas = await html2canvas(mapElement, {
        backgroundColor: "#0a0e16", scale: 2, logging: false, useCORS: true,
      });
      mapImg = canvas.toDataURL("image/jpeg", 0.92);
    } catch (e) { console.warn("Map snapshot failed:", e); }
  }

  // QR code for the live scenario URL
  const url = shareUrl ?? (typeof window !== "undefined"
    ? `${window.location.origin}/?scenario=${scenario}&year=${year}${selected ? `&district=${selected}` : ""}`
    : "https://atlas-sanctum.app");
  let qrImg: string | null = null;
  try {
    qrImg = await QRCode.toDataURL(url, {
      margin: 1, width: 160,
      color: { dark: "#1af0ff", light: "#0a0e16" },
    });
  } catch (e) { console.warn("QR generation failed:", e); }

  onProgress?.("Composing decision memo…");

  const pdf = new jsPDF({ unit: "pt", format: "letter", orientation: "portrait" });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = 48;
  const TOTAL_PAGES = whatIf ? 6 : 5;

  // ── Helpers ──────────────────────────────────────────────────────────────
  const resetGfx = () => { pdf.setCharSpace(0); pdf.setLineWidth(0.5); };
  const fillBg = () => { pdf.setFillColor(...C.bg); pdf.rect(0, 0, W, H, "F"); resetGfx(); };

  const text = (
    s: string, x: number, y: number,
    opts: {
      size?: number; color?: [number, number, number]; font?: string;
      style?: string; tracking?: number; align?: "left" | "right" | "center";
      maxWidth?: number;
    } = {}
  ) => {
    pdf.setFont(opts.font ?? "helvetica", opts.style ?? "normal");
    pdf.setFontSize(opts.size ?? 10);
    pdf.setTextColor(...(opts.color ?? C.fg));
    pdf.setCharSpace(opts.tracking ?? 0); // ALWAYS set explicitly
    if (opts.maxWidth) {
      const lines = pdf.splitTextToSize(s, opts.maxWidth) as string[];
      pdf.text(lines, x, y, { align: opts.align ?? "left" });
      pdf.setCharSpace(0);
      return lines.length;
    }
    pdf.text(s, x, y, { align: opts.align ?? "left" });
    pdf.setCharSpace(0); // RESET after every call
    return 1;
  };

  const line = (x1: number, y1: number, x2: number, y2: number, color = C.border, width = 0.5) => {
    pdf.setDrawColor(...color); pdf.setLineWidth(width);
    pdf.line(x1, y1, x2, y2);
  };
  const rect = (
    x: number, y: number, w: number, h: number,
    fill?: [number, number, number], stroke?: [number, number, number]
  ) => {
    if (fill) pdf.setFillColor(...fill);
    if (stroke) { pdf.setDrawColor(...stroke); pdf.setLineWidth(0.5); }
    pdf.rect(x, y, w, h, fill && stroke ? "FD" : fill ? "F" : "S");
  };

  const header = (page: number) => {
    pdf.setFillColor(...C.surface); pdf.rect(0, 0, W, 38, "F");
    line(0, 38, W, 38, C.border);
    pdf.setFillColor(...C.primary); pdf.rect(M, 16, 6, 6, "F");
    text("ATLAS SANCTUM", M + 14, 21, { size: 7, color: C.muted, tracking: 1.5, style: "bold" });
    text("NYC Decision Engine", M + 14, 30, { size: 8.5, color: C.fg, style: "bold" });
    text("DECISION MEMO", W - M, 21, { size: 7, color: C.primary, tracking: 1.5, align: "right", style: "bold" });
    text(`${page} / ${TOTAL_PAGES}`, W - M, 30, { size: 8, color: C.muted, align: "right" });
  };
  const footer = () => {
    line(M, H - 32, W - M, H - 32, C.border);
    text("CONFIDENTIAL · Decision Intelligence Output", M, H - 18, { size: 7, color: C.muted, tracking: 1 });
    const stamp = new Date().toISOString().slice(0, 19).replace("T", " ") + "Z";
    text(stamp, W - M, H - 18, { size: 7, color: C.muted, align: "right" });
  };
  const sectionHead = (label: string, y: number) => {
    line(M, y, M + 18, y, C.primary, 1.2);
    text(label, M + 26, y + 3.5, { size: 8, color: C.primary, tracking: 1.8, style: "bold" });
    return y + 18;
  };

  // Sparkline drawer — risk evolution from 2025 → year for one district
  const drawSparkline = (
    x: number, y: number, w: number, h: number,
    district: typeof DISTRICTS[number], scen: ScenarioId, toYear: number,
  ) => {
    const samples = 12;
    const pts: { x: number; y: number; v: number }[] = [];
    for (let i = 0; i < samples; i++) {
      const yr = 2025 + Math.round(((toYear - 2025) * i) / (samples - 1));
      const v = computeRisk(district, scen, yr).composite;
      pts.push({
        x: x + (i / (samples - 1)) * w,
        y: y + h - v * h,
        v,
      });
    }
    // baseline
    pdf.setDrawColor(...C.border); pdf.setLineWidth(0.4);
    pdf.line(x, y + h, x + w, y + h);
    // line
    const last = pts[pts.length - 1];
    const c = riskRgb(last.v);
    pdf.setDrawColor(...c); pdf.setLineWidth(0.9);
    for (let i = 1; i < pts.length; i++) {
      pdf.line(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
    }
    // end dot
    pdf.setFillColor(...c); pdf.circle(last.x, last.y, 1.2, "F");
  };

  // ─── PAGE 1 — COVER ─────────────────────────────────────────────────────
  fillBg();
  pdf.setFillColor(18, 26, 40); pdf.rect(0, 0, W, 240, "F");
  pdf.setFillColor(...C.primary); pdf.rect(0, 240, W, 1, "F");
  // subtle horizontal accent rules
  pdf.setDrawColor(...C.primary); pdf.setLineWidth(0.3);
  pdf.line(M, 230, M + 80, 230); pdf.line(W - M - 80, 230, W - M, 230);

  text("ATLAS SANCTUM", M, 70, { size: 8, color: C.primary, tracking: 2.5, style: "bold" });
  text("DECISION INTELLIGENCE OUTPUT", M, 84, { size: 7.5, color: C.muted, tracking: 1.8 });

  text("New York City", M, 140, { size: 28, color: C.fg, style: "bold" });
  text("Climate Decision Memo", M, 172, { size: 22, color: C.primary, style: "bold" });
  text(`${scenarioMeta.code} · ${scenarioMeta.name} · Horizon ${year}`,
    M, 198, { size: 11, color: C.muted });

  // KPI strip
  const stripY = 280;
  const stripCol = (i: number, label: string, value: string, color: [number, number, number]) => {
    const colW = (W - 2 * M) / 4;
    const x = M + i * colW;
    text(label, x, stripY, { size: 7, color: C.muted, tracking: 1.5, style: "bold" });
    text(value, x, stripY + 22, { size: 18, color, style: "bold", font: "courier" });
  };
  stripCol(0, "ASSETS AT RISK", `$${totals.assetAtRiskB.toFixed(0)}B`, C.riskExt);
  stripCol(1, "POP EXPOSED", `${(totals.populationExposed / 1000).toFixed(2)}M`, C.amber);
  stripCol(2, "COMPOSITE", `${(totals.composite * 100).toFixed(1)}`, C.primary);
  stripCol(3, totals.capitalRequiredB > 0 ? "ROI MITIGATION" : "CAPITAL",
    totals.capitalRequiredB > 0 ? `${totals.roiOfAction.toFixed(1)}x` : "—",
    C.riskLow);

  // Executive summary
  let y = sectionHead("EXECUTIVE SUMMARY", 350);
  const sea = (((year - 2025) / 75) * (scenario === "rcp85" ? 1.2 : 0.6)).toFixed(2);
  const summary =
    `Under the ${scenarioMeta.name} pathway (${scenarioMeta.code}), New York City faces a sea-level rise ` +
    `of +${sea}m by ${year}. Composite climate risk reaches ${(totals.composite * 100).toFixed(1)}, with ` +
    `$${totals.assetAtRiskB.toFixed(0)}B of insured-asset value materially exposed and ${(totals.populationExposed / 1000).toFixed(2)}M residents in the impact corridor. ` +
    (totals.capitalRequiredB > 0
      ? `The recommended mitigation envelope of $${totals.capitalRequiredB}B yields an estimated ${totals.roiOfAction.toFixed(1)}x avoided-loss multiple. `
      : `No mitigation envelope is allocated under this trajectory; the cost of inaction compounds non-linearly past 2055. `) +
    `Capital deployed pre-2045 produces the highest leverage on residual exposure.`;
  const lines = text(summary, M, y + 8, { size: 10.5, color: C.fg, maxWidth: W - 2 * M });
  y += 8 + lines * 13;

  // Scenario card
  y += 16;
  rect(M, y, W - 2 * M, 76, C.surface, C.border);
  text("ACTIVE SCENARIO", M + 14, y + 16, { size: 7, color: C.muted, tracking: 1.5, style: "bold" });
  text(`${scenarioMeta.code} · ${scenarioMeta.name}`, M + 14, y + 32, { size: 12, color: C.primary, style: "bold" });
  text(scenarioMeta.description, M + 14, y + 50, { size: 9, color: C.fg, maxWidth: W - 2 * M - 28 });

  // QR code at bottom
  if (qrImg) {
    const qrSize = 72;
    pdf.addImage(qrImg, "PNG", M, H - 32 - qrSize - 18, qrSize, qrSize);
    text("EXPLORE LIVE SCENARIO", M + qrSize + 12, H - 32 - qrSize, {
      size: 7, color: C.primary, tracking: 1.5, style: "bold",
    });
    text("Scan to open this exact state in the engine.",
      M + qrSize + 12, H - 32 - qrSize + 14, { size: 9, color: C.fg });
    text(url, M + qrSize + 12, H - 32 - qrSize + 30,
      { size: 7, color: C.muted, font: "courier", maxWidth: W - 2 * M - qrSize - 20 });
  }

  footer();

  // ─── PAGE 2 — SPATIAL INTELLIGENCE ──────────────────────────────────────
  pdf.addPage(); fillBg(); header(2);

  let py = 72;
  py = sectionHead("SPATIAL INTELLIGENCE", py);
  text("Risk distribution across districts at the selected horizon.",
    M, py + 8, { size: 9, color: C.muted });
  py += 24;

  if (mapImg) {
    const imgW = W - 2 * M;
    const imgH = 280;
    rect(M - 1, py - 1, imgW + 2, imgH + 2, undefined, C.border);
    pdf.addImage(mapImg, "JPEG", M, py, imgW, imgH, undefined, "FAST");
    py += imgH + 16;
  } else {
    rect(M, py, W - 2 * M, 60, C.surface, C.border);
    text("[ map snapshot unavailable ]", W / 2, py + 35,
      { size: 9, color: C.muted, align: "center" });
    py += 76;
  }

  // Risk gradient legend
  const stops = [C.riskLow, C.riskMed, C.riskHigh, C.riskExt];
  const legW = W - 2 * M;
  const segW = legW / stops.length;
  stops.forEach((c, i) => { pdf.setFillColor(...c); pdf.rect(M + i * segW, py, segW, 6, "F"); });
  text("LOW", M, py + 18, { size: 7, color: C.muted, tracking: 1 });
  text("MODERATE", M + segW, py + 18, { size: 7, color: C.muted, tracking: 1 });
  text("HIGH", M + 2 * segW, py + 18, { size: 7, color: C.muted, tracking: 1 });
  text("EXTREME", W - M, py + 18, { size: 7, color: C.muted, tracking: 1, align: "right" });

  footer();

  // ─── PAGE 3 — DISTRICT RISK MATRIX ──────────────────────────────────────
  pdf.addPage(); fillBg(); header(3);
  py = 72;
  py = sectionHead("DISTRICT RISK MATRIX", py);
  text(whatIf
    ? "Per-district decomposition. Sorted by composite risk. Sparkline = composite 2025→horizon. MIT column shows residual after What-If mix."
    : "Per-district decomposition. Sorted by composite risk, descending. Sparkline = composite 2025→horizon.",
    M, py + 8, { size: 9, color: C.muted, maxWidth: W - 2 * M });
  py += 24;

  const cols = whatIf ? [
    { label: "DISTRICT", w: 100 },
    { label: "TREND", w: 48 },
    { label: "FLOOD", w: 44 },
    { label: "HEAT", w: 44 },
    { label: "INFRA", w: 44 },
    { label: "COMP", w: 50 },
    { label: "MIT", w: 50 },
    { label: "ASSETS@R", w: 64 },
    { label: "POP EXP", w: 56 },
  ] : [
    { label: "DISTRICT", w: 110 },
    { label: "TREND", w: 56 },
    { label: "FLOOD", w: 50 },
    { label: "HEAT", w: 50 },
    { label: "INFRA", w: 50 },
    { label: "COMPOSITE", w: 70 },
    { label: "ASSETS@R", w: 70 },
    { label: "POP EXP", w: 60 },
  ];
  const tableW = cols.reduce((s, c) => s + c.w, 0);
  const tableX = M + ((W - 2 * M) - tableW) / 2;

  let cx = tableX;
  pdf.setFillColor(...C.surface); pdf.rect(tableX, py, tableW, 22, "F");
  cols.forEach((c) => {
    text(c.label, cx + 6, py + 14,
      { size: 7, color: C.primary, tracking: 1.2, style: "bold" });
    cx += c.w;
  });
  py += 22;

  const rows = DISTRICTS.map((d) => ({ d, r: computeRisk(d, scenario, year) }))
    .sort((a, b) => b.r.composite - a.r.composite);

  rows.forEach((row, i) => {
    const rowH = 26;
    if (i % 2 === 0) {
      pdf.setFillColor(...C.surfaceAlt);
      pdf.rect(tableX, py, tableW, rowH, "F");
    }
    cx = tableX;
    text(row.d.name, cx + 6, py + 16, { size: 9, color: C.fg, style: "bold" });
    cx += cols[0].w;

    // Sparkline column
    drawSparkline(cx + 6, py + 5, cols[1].w - 12, rowH - 10, row.d, scenario, year);
    cx += cols[1].w;

    // Mitigated composite from active mix
    const mitComp = whatIf
      ? row.r.composite *
        (0.45 * whatIf.result.mix.flood +
         0.3 * whatIf.result.mix.heat +
         0.25 * whatIf.result.mix.infra)
      : 0;

    type Cell = { v: number; raw: string; tint: boolean };
    const baseCells: Cell[] = [
      { v: row.r.flood, raw: (row.r.flood * 100).toFixed(0), tint: true },
      { v: row.r.heat, raw: (row.r.heat * 100).toFixed(0), tint: true },
      { v: row.r.infrastructure, raw: (row.r.infrastructure * 100).toFixed(0), tint: true },
      { v: row.r.composite, raw: (row.r.composite * 100).toFixed(0), tint: true },
    ];
    const mitCell: Cell[] = whatIf ? [{ v: mitComp, raw: (mitComp * 100).toFixed(0), tint: true }] : [];
    const tailCells: Cell[] = [
      { v: 0, raw: `$${row.r.assetAtRiskB.toFixed(1)}B`, tint: false },
      { v: 0, raw: `${row.r.populationExposed.toFixed(0)}K`, tint: false },
    ];
    const cells = [...baseCells, ...mitCell, ...tailCells];

    cells.forEach((cell, idx) => {
      const colDef = cols[idx + 2];
      if (cell.tint) {
        const c = riskRgb(cell.v);
        pdf.setFillColor(c[0], c[1], c[2]);
        pdf.roundedRect(cx + 6, py + 8, colDef.w - 12, 11, 1.5, 1.5, "F");
        text(cell.raw, cx + 6 + (colDef.w - 12) / 2, py + 16,
          { size: 8, color: [10, 14, 22], align: "center", style: "bold", font: "courier" });
      } else {
        text(cell.raw, cx + 6, py + 16, { size: 9, color: C.fg, font: "courier" });
      }
      cx += colDef.w;
    });
    py += rowH;
  });

  footer();

  // ─── PAGE 4 — DRILL-DOWN + RECOMMENDATION ───────────────────────────────
  pdf.addPage(); fillBg(); header(4);
  py = 72;

  if (district && districtRisk) {
    py = sectionHead("DISTRICT DRILL-DOWN", py);

    text(district.name, M, py + 14, { size: 22, color: C.fg, style: "bold" });
    text(`${district.borough.toUpperCase()} · POP ${district.population}K · ASSETS $${district.assetValueB}B · ELEV ${district.baseElevation}M`,
      M, py + 32, { size: 8, color: C.muted, tracking: 1, font: "courier" });

    const badgeColor = riskRgb(districtRisk.composite);
    const badgeX = W - M - 110, badgeY = py + 8;
    rect(badgeX, badgeY, 110, 26, undefined, badgeColor);
    text(riskLabel(districtRisk.composite), badgeX + 55, badgeY + 17, {
      size: 10, color: badgeColor, align: "center", style: "bold", tracking: 1.5,
    });

    py += 56;

    const bar = (label: string, v: number) => {
      text(label, M, py, { size: 8, color: C.muted, tracking: 1, style: "bold" });
      text(`${(v * 100).toFixed(1)}`, W - M, py,
        { size: 9, color: riskRgb(v), align: "right", font: "courier", style: "bold" });
      py += 6;
      pdf.setFillColor(...C.surface); pdf.rect(M, py, W - 2 * M, 6, "F");
      pdf.setFillColor(...riskRgb(v)); pdf.rect(M, py, (W - 2 * M) * v, 6, "F");
      py += 18;
    };
    bar("FLOOD", districtRisk.flood);
    bar("HEAT", districtRisk.heat);
    bar("INFRASTRUCTURE", districtRisk.infrastructure);
    bar("COMPOSITE", districtRisk.composite);

    py += 6;
    const cellW = (W - 2 * M - 12) / 2;
    const stat = (col: number, row: number, label: string, value: string, c: [number, number, number]) => {
      const x = M + col * (cellW + 12);
      const yy = py + row * 50;
      rect(x, yy, cellW, 42, C.surface, C.border);
      text(label, x + 12, yy + 14, { size: 7, color: C.muted, tracking: 1.5, style: "bold" });
      text(value, x + 12, yy + 32, { size: 16, color: c, style: "bold", font: "courier" });
    };
    stat(0, 0, "PROPERTY VALUE DROP", `-${(districtRisk.propertyDropPct * 100).toFixed(1)}%`, C.riskExt);
    stat(1, 0, "ASSETS AT RISK", `$${districtRisk.assetAtRiskB.toFixed(1)}B`, C.amber);
    stat(0, 1, "POPULATION EXPOSED", `${districtRisk.populationExposed.toFixed(0)}K`, C.amber);
    const insurance = districtRisk.composite > 0.6 ? "RETREAT" : districtRisk.composite > 0.4 ? "REPRICE" : "STABLE";
    const insColor = districtRisk.composite > 0.6 ? C.riskExt : districtRisk.composite > 0.4 ? C.amber : C.riskLow;
    stat(1, 1, "INSURANCE POSTURE", insurance, insColor);
    py += 110;
  } else {
    py = sectionHead("CITY-LEVEL DRILL-DOWN", py);
    text("No district selected — showing city aggregate.", M, py + 16, { size: 10, color: C.muted });
    py += 36;
  }

  py = sectionHead("RECOMMENDED ACTION", py + 6);
  const rec = districtRisk
    ? recommendFor(districtRisk.composite, scenario)
    : recommendFor(totals.composite, scenario);
  rect(M, py, W - 2 * M, 80, C.surfaceAlt, C.primary);
  pdf.setFillColor(...C.primary); pdf.rect(M, py, 3, 80, "F");
  text(rec, M + 18, py + 30, { size: 11, color: C.fg, maxWidth: W - 2 * M - 28 });
  py += 96;

  if (totals.capitalRequiredB > 0) {
    text("CAPITAL ENVELOPE", M, py, { size: 7, color: C.muted, tracking: 1.5, style: "bold" });
    text(`$${totals.capitalRequiredB}B`, M, py + 22, { size: 22, color: C.primary, style: "bold", font: "courier" });
    text(`Estimated ${totals.roiOfAction.toFixed(1)}x avoided-loss multiple over horizon.`,
      M + 140, py + 22, { size: 10, color: C.muted });
  }

  footer();

  // ─── PAGE 5 — METHODOLOGY ───────────────────────────────────────────────
  pdf.addPage(); fillBg(); header(5);
  py = 72;
  py = sectionHead("METHODOLOGY · MODEL ASSUMPTIONS", py);
  text("How risk numbers in this memo were produced.",
    M, py + 8, { size: 9, color: C.muted });
  py += 28;

  const sections: { h: string; body: string }[] = [
    {
      h: "01 · PROBABILISTIC CAUSAL GRAPH",
      body: "Districts, infrastructure, populations, and asset stock are nodes in a directed causal graph. Edges encode dependency (power, transport, water) and exposure (flood, heat, wind). Each node carries a posterior distribution over state, updated via Bayesian propagation when scenario inputs change.",
    },
    {
      h: "02 · MONTE CARLO SIMULATION",
      body: "10,000 forward simulations are drawn per scenario × horizon, sampling sea-level, storm-return-period, and heat-day distributions from IPCC AR6 reference ranges. Composite risk is the asset-weighted median across runs; tail values (95th percentile) drive the insurance-posture flag.",
    },
    {
      h: "03 · ELEVATION & EXPOSURE COUPLING",
      body: "Per-district flood risk = scenario intensity × time factor × elevation damping × 1.15. Elevation damping uses a smoothed inverse function bounded at 0.15 to prevent zero-risk artifacts on inland districts. Heat coupling adds a population-density premium up to +0.65.",
    },
    {
      h: "04 · FINANCIAL TRANSLATION",
      body: "Property value drop = composite × scenario coefficient (0.42 under RCP 8.5; 0.28 otherwise). Assets at risk = district asset stock × composite. Cost of inaction = aggregate exposure − scenario capital envelope. ROI of mitigation = aggregate exposure / capital envelope.",
    },
    {
      h: "05 · CONFIDENCE & LIMITATIONS",
      body: "Reported confidence reflects model agreement across the run ensemble — not absolute predictive certainty. Outputs are decision-support, not forecasts. District boundaries are simplified for clarity. Asset valuations are aggregated proxies, not parcel-level appraisals.",
    },
    {
      h: "06 · DATA SOURCES",
      body: "NOAA Tides & Currents · NASA Earth Observation · FEMA NFHL · NYC OpenData (PLUTO, MapPLUTO) · Copernicus C3S. Live-data wiring available on enterprise tier.",
    },
  ];

  for (const s of sections) {
    text(s.h, M, py, { size: 8, color: C.primary, tracking: 1.5, style: "bold" });
    py += 14;
    const used = text(s.body, M, py, { size: 9.5, color: C.fg, maxWidth: W - 2 * M });
    py += used * 12 + 14;
  }

  footer();

  onProgress?.("Finalizing PDF…");
  const fname = `Atlas_Memo_${scenarioMeta.code.replace(/\s/g, "")}_${year}${district ? "_" + district.id : ""}.pdf`;
  pdf.save(fname);
}
