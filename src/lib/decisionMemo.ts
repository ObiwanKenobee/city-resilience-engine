import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import {
  DISTRICTS, SCENARIOS, ScenarioId, DistrictId,
  computeRisk, computeCityTotals, riskLabel,
} from "@/data/nyc";

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
  onProgress?: (msg: string) => void;
}

// Brand colors (hand-converted from HSL design tokens)
const C = {
  bg: [10, 14, 22] as [number, number, number],
  surface: [14, 19, 28] as [number, number, number],
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

export async function generateDecisionMemo({ scenario, year, selected, mapElement, onProgress }: MemoArgs) {
  const scenarioMeta = SCENARIOS.find((s) => s.id === scenario)!;
  const totals = computeCityTotals(scenario, year);
  const district = selected ? DISTRICTS.find((d) => d.id === selected) ?? null : null;
  const districtRisk = district ? computeRisk(district, scenario, year) : null;

  onProgress?.("Capturing spatial intelligence…");

  // Snapshot the map (best-effort)
  let mapImg: string | null = null;
  if (mapElement) {
    try {
      const canvas = await html2canvas(mapElement, {
        backgroundColor: "#0a0e16",
        scale: 2,
        logging: false,
        useCORS: true,
      });
      mapImg = canvas.toDataURL("image/jpeg", 0.92);
    } catch (e) {
      console.warn("Map snapshot failed:", e);
    }
  }

  onProgress?.("Composing decision memo…");

  const pdf = new jsPDF({ unit: "pt", format: "letter", orientation: "portrait" });
  const W = pdf.internal.pageSize.getWidth();   // 612
  const H = pdf.internal.pageSize.getHeight();  // 792
  const M = 48;

  // Helpers
  const fillBg = () => {
    pdf.setFillColor(...C.bg); pdf.rect(0, 0, W, H, "F");
  };
  const text = (
    s: string, x: number, y: number,
    opts: { size?: number; color?: [number, number, number]; font?: string; style?: string; tracking?: number; align?: "left" | "right" | "center" } = {}
  ) => {
    pdf.setFont(opts.font ?? "helvetica", opts.style ?? "normal");
    pdf.setFontSize(opts.size ?? 10);
    pdf.setTextColor(...(opts.color ?? C.fg));
    if (opts.tracking) pdf.setCharSpace(opts.tracking);
    pdf.text(s, x, y, { align: opts.align ?? "left" });
    if (opts.tracking) pdf.setCharSpace(0);
  };
  const line = (x1: number, y1: number, x2: number, y2: number, color = C.border, width = 0.5) => {
    pdf.setDrawColor(...color); pdf.setLineWidth(width);
    pdf.line(x1, y1, x2, y2);
  };
  const rect = (x: number, y: number, w: number, h: number, fill?: [number, number, number], stroke?: [number, number, number]) => {
    if (fill) { pdf.setFillColor(...fill); }
    if (stroke) { pdf.setDrawColor(...stroke); pdf.setLineWidth(0.5); }
    pdf.rect(x, y, w, h, fill && stroke ? "FD" : fill ? "F" : "S");
  };
  const header = (page: number, totalPages: number) => {
    // Top brand bar
    pdf.setFillColor(...C.surface);
    pdf.rect(0, 0, W, 38, "F");
    line(0, 38, W, 38, C.border);
    // Logo dot
    pdf.setFillColor(...C.primary);
    pdf.rect(M, 16, 6, 6, "F");
    text("ATLAS SANCTUM", M + 14, 21, { size: 8, color: C.muted, tracking: 1.5, style: "bold" });
    text("NYC Decision Engine", M + 14, 30, { size: 9, color: C.fg, style: "bold" });
    text("DECISION MEMO", W - M, 21, { size: 8, color: C.primary, tracking: 1.5, align: "right", style: "bold" });
    text(`${page} / ${totalPages}`, W - M, 30, { size: 8, color: C.muted, align: "right" });
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

  // ─── PAGE 1 — COVER ─────────────────────────────────────────────────────
  fillBg();

  // Aurora-ish accent block
  pdf.setFillColor(18, 26, 40);
  pdf.rect(0, 0, W, 240, "F");
  pdf.setFillColor(...C.primary);
  pdf.rect(0, 240, W, 1, "F");

  // Cover content
  text("ATLAS SANCTUM", M, 70, { size: 8, color: C.primary, tracking: 2.5, style: "bold" });
  text("DECISION INTELLIGENCE OUTPUT", M, 84, { size: 8, color: C.muted, tracking: 1.8 });

  text("New York City", M, 140, { size: 28, color: C.fg, style: "bold" });
  text("Climate Decision Memo", M, 172, { size: 22, color: C.primary, style: "bold" });
  text(`${scenarioMeta.code} · ${scenarioMeta.name} · Horizon ${year}`, M, 198, { size: 11, color: C.muted });

  // Stat strip
  const stripY = 280;
  const strip = (i: number, label: string, value: string, color: [number, number, number]) => {
    const colW = (W - 2 * M) / 4;
    const x = M + i * colW;
    text(label, x, stripY, { size: 7, color: C.muted, tracking: 1.5, style: "bold" });
    text(value, x, stripY + 22, { size: 18, color, style: "bold", font: "courier" });
  };
  strip(0, "ASSETS AT RISK", `$${totals.assetAtRiskB.toFixed(0)}B`, C.riskExt);
  strip(1, "POP. EXPOSED", `${(totals.populationExposed / 1000).toFixed(2)}M`, C.amber);
  strip(2, "COMPOSITE", `${(totals.composite * 100).toFixed(1)}`, C.primary);
  strip(3, totals.capitalRequiredB > 0 ? "ROI MITIGATION" : "CAPITAL", totals.capitalRequiredB > 0 ? `${totals.roiOfAction.toFixed(1)}x` : "—", C.riskLow);

  // Executive summary
  let y = sectionHead("EXECUTIVE SUMMARY", 350);
  pdf.setTextColor(...C.fg); pdf.setFontSize(10.5); pdf.setFont("helvetica", "normal");
  const sea = (((year - 2025) / 75) * (scenario === "rcp85" ? 1.2 : 0.6)).toFixed(2);
  const summary =
    `Under the ${scenarioMeta.name} pathway (${scenarioMeta.code}), New York City faces a sea-level rise ` +
    `of +${sea}m by ${year}. Composite climate risk reaches ${(totals.composite * 100).toFixed(1)}, with ` +
    `$${totals.assetAtRiskB.toFixed(0)}B of insured-asset value materially exposed and ${(totals.populationExposed / 1000).toFixed(2)}M residents in the impact corridor. ` +
    (totals.capitalRequiredB > 0
      ? `The recommended mitigation envelope of $${totals.capitalRequiredB}B yields an estimated ${totals.roiOfAction.toFixed(1)}x avoided-loss multiple. `
      : `No mitigation envelope is allocated under this trajectory; the cost of inaction compounds non-linearly past 2055. `) +
    `Capital deployed pre-2045 produces the highest leverage on residual exposure.`;
  const wrapped = pdf.splitTextToSize(summary, W - 2 * M);
  pdf.text(wrapped, M, y + 6);
  y += 6 + wrapped.length * 13;

  // Scenario card
  y += 16;
  rect(M, y, W - 2 * M, 70, C.surface, C.border);
  text("ACTIVE SCENARIO", M + 14, y + 16, { size: 7, color: C.muted, tracking: 1.5, style: "bold" });
  text(`${scenarioMeta.code} · ${scenarioMeta.name}`, M + 14, y + 32, { size: 12, color: C.primary, style: "bold" });
  const desc = pdf.splitTextToSize(scenarioMeta.description, W - 2 * M - 28);
  pdf.setFontSize(9); pdf.setTextColor(...C.fg);
  pdf.text(desc, M + 14, y + 48);

  footer();

  // ─── PAGE 2 — SPATIAL INTELLIGENCE ──────────────────────────────────────
  pdf.addPage();
  fillBg();
  header(2, 4);

  let py = 72;
  py = sectionHead("SPATIAL INTELLIGENCE", py);

  text("Risk distribution across districts at the selected horizon.", M, py + 4, { size: 9, color: C.muted });
  py += 22;

  // Map snapshot
  if (mapImg) {
    const imgW = W - 2 * M;
    const imgH = 280;
    rect(M - 1, py - 1, imgW + 2, imgH + 2, undefined, C.border);
    pdf.addImage(mapImg, "JPEG", M, py, imgW, imgH, undefined, "FAST");
    py += imgH + 16;
  } else {
    rect(M, py, W - 2 * M, 60, C.surface, C.border);
    text("[ map snapshot unavailable ]", W / 2, py + 35, { size: 9, color: C.muted, align: "center" });
    py += 76;
  }

  // Risk gradient legend
  const legendY = py;
  const legendW = W - 2 * M;
  const stops = [C.riskLow, C.riskMed, C.riskHigh, C.riskExt];
  const segW = legendW / stops.length;
  stops.forEach((c, i) => {
    pdf.setFillColor(...c);
    pdf.rect(M + i * segW, legendY, segW, 6, "F");
  });
  text("LOW", M, legendY + 18, { size: 7, color: C.muted, tracking: 1 });
  text("MODERATE", M + segW, legendY + 18, { size: 7, color: C.muted, tracking: 1 });
  text("HIGH", M + 2 * segW, legendY + 18, { size: 7, color: C.muted, tracking: 1 });
  text("EXTREME", W - M, legendY + 18, { size: 7, color: C.muted, tracking: 1, align: "right" });

  footer();

  // ─── PAGE 3 — DISTRICT MATRIX ───────────────────────────────────────────
  pdf.addPage();
  fillBg();
  header(3, 4);

  py = 72;
  py = sectionHead("DISTRICT RISK MATRIX", py);
  text("Per-district decomposition. Sorted by composite risk, descending.", M, py + 4, { size: 9, color: C.muted });
  py += 24;

  // Table header
  const cols = [
    { label: "DISTRICT", w: 130 },
    { label: "FLOOD", w: 60 },
    { label: "HEAT", w: 60 },
    { label: "INFRA", w: 60 },
    { label: "COMPOSITE", w: 80 },
    { label: "ASSETS@R", w: 70 },
    { label: "POP EXP", w: 56 },
  ];
  let cx = M;
  pdf.setFillColor(...C.surface);
  pdf.rect(M, py, W - 2 * M, 22, "F");
  cols.forEach((c) => {
    text(c.label, cx + 6, py + 14, { size: 7, color: C.primary, tracking: 1.2, style: "bold" });
    cx += c.w;
  });
  py += 22;

  // Sorted rows
  const rows = DISTRICTS.map((d) => ({ d, r: computeRisk(d, scenario, year) }))
    .sort((a, b) => b.r.composite - a.r.composite);

  rows.forEach((row, i) => {
    if (i % 2 === 0) {
      pdf.setFillColor(16, 22, 32);
      pdf.rect(M, py, W - 2 * M, 22, "F");
    }
    cx = M;
    text(row.d.name, cx + 6, py + 14, { size: 9, color: C.fg, style: "bold" });
    cx += cols[0].w;
    const cells: { v: number; raw: string; tint: boolean }[] = [
      { v: row.r.flood, raw: (row.r.flood * 100).toFixed(0), tint: true },
      { v: row.r.heat, raw: (row.r.heat * 100).toFixed(0), tint: true },
      { v: row.r.infrastructure, raw: (row.r.infrastructure * 100).toFixed(0), tint: true },
      { v: row.r.composite, raw: (row.r.composite * 100).toFixed(0), tint: true },
      { v: 0, raw: `$${row.r.assetAtRiskB.toFixed(1)}B`, tint: false },
      { v: 0, raw: `${row.r.populationExposed.toFixed(0)}K`, tint: false },
    ];
    cells.forEach((cell, idx) => {
      const colDef = cols[idx + 1];
      if (cell.tint) {
        const c = riskRgb(cell.v);
        // mini pill
        pdf.setFillColor(c[0], c[1], c[2]);
        pdf.roundedRect(cx + 6, py + 6, colDef.w - 12, 11, 1.5, 1.5, "F");
        text(cell.raw, cx + 6 + (colDef.w - 12) / 2, py + 14, {
          size: 8, color: [10, 14, 22], align: "center", style: "bold", font: "courier",
        });
      } else {
        text(cell.raw, cx + 6, py + 14, { size: 9, color: C.fg, font: "courier" });
      }
      cx += colDef.w;
    });
    py += 22;
  });

  footer();

  // ─── PAGE 4 — DRILL-DOWN + RECOMMENDATION ───────────────────────────────
  pdf.addPage();
  fillBg();
  header(4, 4);

  py = 72;
  if (district && districtRisk) {
    py = sectionHead("DISTRICT DRILL-DOWN", py);

    text(district.name, M, py + 8, { size: 22, color: C.fg, style: "bold" });
    text(`${district.borough.toUpperCase()} · POP ${district.population}K · ASSETS $${district.assetValueB}B · ELEV ${district.baseElevation}M`,
      M, py + 26, { size: 8, color: C.muted, tracking: 1, font: "courier" });

    // Risk badge
    const badgeColor = riskRgb(districtRisk.composite);
    const badgeX = W - M - 110, badgeY = py + 2;
    rect(badgeX, badgeY, 110, 26, undefined, badgeColor);
    text(riskLabel(districtRisk.composite), badgeX + 55, badgeY + 17, {
      size: 10, color: badgeColor, align: "center", style: "bold", tracking: 1.5,
    });

    py += 50;

    // Risk bars
    const bar = (label: string, v: number) => {
      text(label, M, py, { size: 8, color: C.muted, tracking: 1, style: "bold" });
      text(`${(v * 100).toFixed(1)}`, W - M, py, { size: 9, color: riskRgb(v), align: "right", font: "courier", style: "bold" });
      py += 6;
      pdf.setFillColor(...C.surface);
      pdf.rect(M, py, W - 2 * M, 6, "F");
      pdf.setFillColor(...riskRgb(v));
      pdf.rect(M, py, (W - 2 * M) * v, 6, "F");
      py += 18;
    };
    bar("FLOOD", districtRisk.flood);
    bar("HEAT", districtRisk.heat);
    bar("INFRASTRUCTURE", districtRisk.infrastructure);
    bar("COMPOSITE", districtRisk.composite);

    // Stat grid 2x2
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
    py = sectionHead("DRILL-DOWN", py);
    text("No district selected.", M, py + 6, { size: 10, color: C.muted });
    py += 24;
  }

  // Recommendation block
  py = sectionHead("RECOMMENDED ACTION", py + 6);
  const rec = districtRisk
    ? recommendFor(districtRisk.composite, scenario)
    : recommendFor(totals.composite, scenario);

  rect(M, py, W - 2 * M, 80, [16, 22, 32], C.primary);
  pdf.setFillColor(...C.primary);
  pdf.rect(M, py, 3, 80, "F");
  pdf.setTextColor(...C.fg);
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "normal");
  const recWrap = pdf.splitTextToSize(rec, W - 2 * M - 28);
  pdf.text(recWrap, M + 18, py + 24);

  py += 96;

  // Capital line
  if (totals.capitalRequiredB > 0) {
    text("CAPITAL ENVELOPE", M, py, { size: 7, color: C.muted, tracking: 1.5, style: "bold" });
    text(`$${totals.capitalRequiredB}B`, M, py + 22, { size: 22, color: C.primary, style: "bold", font: "courier" });
    text(`Estimated ${totals.roiOfAction.toFixed(1)}x avoided-loss multiple over horizon.`,
      M + 140, py + 22, { size: 10, color: C.muted });
  }

  footer();

  // Save
  onProgress?.("Finalizing PDF…");
  const fname = `Atlas_Memo_${scenarioMeta.code.replace(/\s/g, "")}_${year}${district ? "_" + district.id : ""}.pdf`;
  pdf.save(fname);
}
