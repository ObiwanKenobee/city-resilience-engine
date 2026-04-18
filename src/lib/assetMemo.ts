// Underwriter brief — institutional PDF for an asset portfolio.
// Audience framing: insurance carriers / reinsurance / risk officers.

import jsPDF from "jspdf";
import QRCode from "qrcode";
import { AssetExposure, PortfolioRollup } from "@/data/assets";
import { ScenarioId, SCENARIOS } from "@/data/nyc";

interface Args {
  scenario: ScenarioId;
  year: number;
  exposures: AssetExposure[];
  roll: PortfolioRollup;
  shareUrl?: string;
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
const postureColor = (p: AssetExposure["insurance"]): [number, number, number] => {
  if (p === "STABLE") return C.riskLow;
  if (p === "REPRICE") return C.amber;
  if (p === "RETREAT") return C.riskHigh;
  return C.riskExt;
};

export async function generateAssetMemo({ scenario, year, exposures, roll, shareUrl, onProgress }: Args) {
  const scenarioMeta = SCENARIOS.find((s) => s.id === scenario)!;

  onProgress?.("Composing underwriter brief…");

  const url = shareUrl ?? (typeof window !== "undefined"
    ? `${window.location.origin}/assets?scenario=${scenario}&year=${year}`
    : "https://atlas-sanctum.app/assets");
  let qrImg: string | null = null;
  try {
    qrImg = await QRCode.toDataURL(url, {
      margin: 1, width: 160, color: { dark: "#1af0ff", light: "#0a0e16" },
    });
  } catch (e) { console.warn("QR failed", e); }

  const pdf = new jsPDF({ unit: "pt", format: "letter", orientation: "portrait" });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = 48;
  const TOTAL_PAGES = 4;

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
    pdf.setCharSpace(opts.tracking ?? 0);
    if (opts.maxWidth) {
      const lines = pdf.splitTextToSize(s, opts.maxWidth) as string[];
      pdf.text(lines, x, y, { align: opts.align ?? "left" });
      pdf.setCharSpace(0);
      return lines.length;
    }
    pdf.text(s, x, y, { align: opts.align ?? "left" });
    pdf.setCharSpace(0);
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
  const fillBg = () => { pdf.setFillColor(...C.bg); pdf.rect(0, 0, W, H, "F"); };
  const header = (page: number) => {
    pdf.setFillColor(...C.surface); pdf.rect(0, 0, W, 38, "F");
    line(0, 38, W, 38, C.border);
    pdf.setFillColor(...C.primary); pdf.rect(M, 16, 6, 6, "F");
    text("ATLAS SANCTUM", M + 14, 21, { size: 7, color: C.muted, tracking: 1.5, style: "bold" });
    text("Underwriting Intelligence", M + 14, 30, { size: 8.5, color: C.fg, style: "bold" });
    text("PORTFOLIO BRIEF", W - M, 21, { size: 7, color: C.primary, tracking: 1.5, align: "right", style: "bold" });
    text(`${page} / ${TOTAL_PAGES}`, W - M, 30, { size: 8, color: C.muted, align: "right" });
  };
  const footer = () => {
    line(M, H - 32, W - M, H - 32, C.border);
    text("CONFIDENTIAL · Underwriting Output · Decision support, not a binding quote", M, H - 18,
      { size: 7, color: C.muted, tracking: 1 });
    text(new Date().toISOString().slice(0, 19).replace("T", " ") + "Z", W - M, H - 18,
      { size: 7, color: C.muted, align: "right" });
  };
  const sectionHead = (label: string, y: number) => {
    line(M, y, M + 18, y, C.primary, 1.2);
    text(label, M + 26, y + 3.5, { size: 8, color: C.primary, tracking: 1.8, style: "bold" });
    return y + 18;
  };

  // ── PAGE 1 — COVER + ROLLUP ──────────────────────────────────────────────
  fillBg();
  pdf.setFillColor(18, 26, 40); pdf.rect(0, 0, W, 240, "F");
  pdf.setFillColor(...C.primary); pdf.rect(0, 240, W, 1, "F");
  pdf.setDrawColor(...C.primary); pdf.setLineWidth(0.3);
  pdf.line(M, 230, M + 80, 230); pdf.line(W - M - 80, 230, W - M, 230);

  text("ATLAS SANCTUM · UNDERWRITING", M, 70, { size: 8, color: C.primary, tracking: 2.5, style: "bold" });
  text("PORTFOLIO RISK BRIEF", M, 84, { size: 7.5, color: C.muted, tracking: 1.8 });

  text("NYC Asset Portfolio", M, 140, { size: 28, color: C.fg, style: "bold" });
  text("Climate Exposure Underwriting Memo", M, 172, { size: 22, color: C.primary, style: "bold" });
  text(`${scenarioMeta.code} · ${scenarioMeta.name} · Horizon ${year}`, M, 198,
    { size: 11, color: C.muted });

  // KPI strip
  const stripY = 280;
  const stripCol = (i: number, label: string, value: string, color: [number, number, number]) => {
    const colW = (W - 2 * M) / 4;
    const x = M + i * colW;
    text(label, x, stripY, { size: 7, color: C.muted, tracking: 1.5, style: "bold" });
    text(value, x, stripY + 22, { size: 18, color, style: "bold", font: "courier" });
  };
  stripCol(0, "ASSETS", `${roll.totalAssets}`, C.primary);
  stripCol(1, "PORTFOLIO TIV", `$${(roll.totalValueM / 1000).toFixed(2)}B`, C.primary);
  stripCol(2, "EXPECTED LOSS", `$${(roll.totalExposureM / 1000).toFixed(2)}B`, C.amber);
  stripCol(3, "VaR 95%", `$${(roll.totalVaR95M / 1000).toFixed(2)}B`, C.riskExt);

  let py = sectionHead("UNDERWRITER ABSTRACT", 350);
  const expPct = (roll.totalExposureM / roll.totalValueM) * 100;
  const abstract =
    `This portfolio of ${roll.totalAssets} NYC-located assets, with a total insured value (TIV) of ` +
    `$${(roll.totalValueM / 1000).toFixed(2)}B, presents an expected annual climate-driven loss of ` +
    `$${(roll.totalExposureM / 1000).toFixed(2)}B (${expPct.toFixed(1)}% of TIV) under the ` +
    `${scenarioMeta.name} pathway at the ${year} horizon. Tail loss at the 95th percentile reaches ` +
    `$${(roll.totalVaR95M / 1000).toFixed(2)}B. ` +
    `${(roll.uninsurablePct * 100).toFixed(1)}% of TIV occupies zones for which coverage is projected to be ` +
    `unavailable or non-economic at horizon. ` +
    `Asset-weighted composite risk: ${(roll.weightedComposite * 100).toFixed(1)}. ` +
    `Recommended: re-tier premiums, mandate parametric flood overlay on REPRICE-class assets, and ` +
    `initiate divestment workstreams on UNINSURABLE-class concentrations pre-2040.`;
  const lines = text(abstract, M, py + 8, { size: 10.5, color: C.fg, maxWidth: W - 2 * M });
  py += 8 + lines * 13;

  py += 16;
  rect(M, py, W - 2 * M, 76, C.surface, C.border);
  text("EVALUATION CONTEXT", M + 14, py + 16, { size: 7, color: C.muted, tracking: 1.5, style: "bold" });
  text(`${scenarioMeta.code} · ${scenarioMeta.name}`, M + 14, py + 32, { size: 12, color: C.primary, style: "bold" });
  text(scenarioMeta.description, M + 14, py + 50, { size: 9, color: C.fg, maxWidth: W - 2 * M - 28 });

  if (qrImg) {
    const qrSize = 72;
    pdf.addImage(qrImg, "PNG", M, H - 32 - qrSize - 18, qrSize, qrSize);
    text("EXPLORE LIVE PORTFOLIO", M + qrSize + 12, H - 32 - qrSize, {
      size: 7, color: C.primary, tracking: 1.5, style: "bold",
    });
    text("Scan to open this exact scenario in the engine.",
      M + qrSize + 12, H - 32 - qrSize + 14, { size: 9, color: C.fg });
    text(url, M + qrSize + 12, H - 32 - qrSize + 30,
      { size: 7, color: C.muted, font: "courier", maxWidth: W - 2 * M - qrSize - 20 });
  }
  footer();

  // ── PAGE 2 — DISTRICT CONCENTRATION ───────────────────────────────────────
  pdf.addPage(); fillBg(); header(2);
  py = 72;
  py = sectionHead("DISTRICT CONCENTRATION", py);
  text(`Aggregated exposure by district. ${roll.byDistrict.length} districts represented in portfolio.`,
    M, py + 8, { size: 9, color: C.muted });
  py += 28;

  // Concentration bar chart
  const maxExp = Math.max(...roll.byDistrict.map((b) => b.exposureM), 1);
  const rowH = 28;
  roll.byDistrict.forEach((b, i) => {
    if (i % 2 === 0) {
      pdf.setFillColor(...C.surfaceAlt);
      pdf.rect(M, py, W - 2 * M, rowH, "F");
    }
    text(b.district.name, M + 8, py + 12, { size: 9, color: C.fg, style: "bold" });
    text(`${b.count} asset${b.count === 1 ? "" : "s"} · TIV $${b.valueM.toFixed(0)}M`,
      M + 8, py + 22, { size: 7, color: C.muted, font: "courier" });

    const barX = M + 180;
    const barMaxW = W - 2 * M - 180 - 100;
    const barW = (b.exposureM / maxExp) * barMaxW;
    const barRisk = b.valueM > 0 ? b.exposureM / b.valueM : 0;
    pdf.setFillColor(...C.surface); pdf.rect(barX, py + 8, barMaxW, 12, "F");
    pdf.setFillColor(...riskRgb(barRisk)); pdf.rect(barX, py + 8, barW, 12, "F");

    text(`$${b.exposureM.toFixed(1)}M`, W - M - 8, py + 18,
      { size: 10, color: C.fg, font: "courier", style: "bold", align: "right" });
    py += rowH;
  });

  py += 8;
  text(`Uninsurable concentration: ${(roll.uninsurablePct * 100).toFixed(1)}% of TIV`,
    M, py + 14, { size: 9, color: C.amber, style: "bold" });

  footer();

  // ── PAGE 3 — TOP 10 BY EXPECTED LOSS ──────────────────────────────────────
  pdf.addPage(); fillBg(); header(3);
  py = 72;
  py = sectionHead("TOP 10 ASSETS BY EXPECTED LOSS", py);
  text("Concentration drivers. Posture column = recommended underwriting action class.",
    M, py + 8, { size: 9, color: C.muted });
  py += 28;

  const cols = [
    { label: "ASSET", w: 160 },
    { label: "DISTRICT", w: 100 },
    { label: "TIV", w: 60 },
    { label: "COMP", w: 44 },
    { label: "EL", w: 60 },
    { label: "VaR95", w: 60 },
    { label: "POSTURE", w: 60 },
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

  roll.worst.forEach((r, i) => {
    const h = 22;
    if (i % 2 === 0) {
      pdf.setFillColor(...C.surfaceAlt);
      pdf.rect(tableX, py, tableW, h, "F");
    }
    cx = tableX;
    // truncate long asset names
    const name = r.asset.id.length > 26 ? r.asset.id.slice(0, 24) + "…" : r.asset.id;
    text(name, cx + 6, py + 14, { size: 8.5, color: C.fg, style: "bold" });
    cx += cols[0].w;
    text(r.district.name, cx + 6, py + 14, { size: 8, color: C.muted });
    cx += cols[1].w;
    text(`$${r.asset.valueM.toFixed(0)}M`, cx + cols[2].w - 6, py + 14,
      { size: 8.5, color: C.fg, font: "courier", align: "right" });
    cx += cols[2].w;
    // risk pill
    const rc = riskRgb(r.composite);
    pdf.setFillColor(...rc);
    pdf.roundedRect(cx + 6, py + 6, cols[3].w - 12, 11, 1.5, 1.5, "F");
    text(`${(r.composite * 100).toFixed(0)}`, cx + cols[3].w / 2, py + 14,
      { size: 8, color: [10, 14, 22], align: "center", style: "bold", font: "courier" });
    cx += cols[3].w;
    text(`$${r.exposureM.toFixed(1)}M`, cx + cols[4].w - 6, py + 14,
      { size: 8.5, color: C.amber, font: "courier", align: "right" });
    cx += cols[4].w;
    text(`$${r.var95M.toFixed(1)}M`, cx + cols[5].w - 6, py + 14,
      { size: 8.5, color: C.riskExt, font: "courier", align: "right" });
    cx += cols[5].w;
    // posture pill
    const pc = postureColor(r.insurance);
    pdf.setDrawColor(...pc); pdf.setLineWidth(0.7);
    pdf.roundedRect(cx + 6, py + 6, cols[6].w - 12, 11, 1.5, 1.5, "S");
    text(r.insurance, cx + cols[6].w / 2, py + 14,
      { size: 7, color: pc, align: "center", style: "bold", tracking: 1, font: "courier" });
    py += h;
  });

  footer();

  // ── PAGE 4 — PER-ASSET RECOMMENDATIONS + METHODOLOGY ─────────────────────
  pdf.addPage(); fillBg(); header(4);
  py = 72;
  py = sectionHead("PER-ASSET UNDERWRITING ACTIONS", py);
  text("One-line action per top asset. Apply to renewal cycle.",
    M, py + 8, { size: 9, color: C.muted });
  py += 24;

  // Action rows for top 8
  roll.worst.slice(0, 8).forEach((r) => {
    rect(M, py, W - 2 * M, 38, C.surface, C.border);
    const pc = postureColor(r.insurance);
    pdf.setFillColor(...pc); pdf.rect(M, py, 3, 38, "F");
    const name = r.asset.id.length > 32 ? r.asset.id.slice(0, 30) + "…" : r.asset.id;
    text(name, M + 14, py + 14, { size: 9.5, color: C.fg, style: "bold" });
    text(`${r.district.name} · ${r.insurance} · EL $${r.exposureM.toFixed(1)}M`,
      M + 14, py + 26, { size: 7.5, color: C.muted, font: "courier" });
    text(r.rec, M + 14, py + 36, { size: 8, color: C.fg, maxWidth: W - 2 * M - 28 });
    py += 44;
  });

  py += 8;
  py = sectionHead("METHODOLOGY", py + 6);
  const methodology = [
    "Each asset is geocoded to its nearest atlas district (Haversine to district centroid). " +
    "Composite climate risk for that district under the active scenario+year is applied to the asset's TIV, " +
    "yielding expected loss (EL = TIV × composite). Tail loss (VaR 95%) uses a fat-tail multiplier of 1.6× EL, " +
    "consistent with observed climate-loss distributions. Insurance posture is assigned by composite thresholds: " +
    "<0.4 STABLE, 0.4–0.6 REPRICE, 0.6–0.85 RETREAT, >0.85 UNINSURABLE. " +
    "Output is decision-support for underwriting committees and is not a binding quote.",
  ];
  for (const body of methodology) {
    const used = text(body, M, py + 12, { size: 9, color: C.fg, maxWidth: W - 2 * M });
    py += used * 12 + 14;
  }

  footer();

  onProgress?.("Finalizing PDF…");
  pdf.save(`Atlas_Portfolio_Brief_${scenarioMeta.code.replace(/\s/g, "")}_${year}.pdf`);
}
