// Curated NYC decision intelligence dataset.
// Hand-tuned for narrative coherence across scenarios & time horizons.
// Geometry: simplified borough/district polygons in SVG viewBox 0 0 1000 1000.

export type DistrictId =
  | "lower-manhattan"
  | "midtown"
  | "upper-manhattan"
  | "brooklyn-heights"
  | "south-brooklyn"
  | "queens-west"
  | "rockaways"
  | "bronx-south"
  | "staten-island";

export interface District {
  id: DistrictId;
  name: string;
  borough: string;
  population: number;     // thousands
  assetValueB: number;    // billions USD of insured/built assets
  baseElevation: number;  // m above sea level (avg)
  path: string;           // SVG path in 1000x1000 viewbox
  centroid: [number, number];
}

export const DISTRICTS: District[] = [
  {
    id: "lower-manhattan", name: "Lower Manhattan", borough: "Manhattan",
    population: 240, assetValueB: 412, baseElevation: 3,
    path: "M495,612 L520,600 L548,612 L560,640 L555,678 L538,705 L512,712 L488,700 L478,672 L482,638 Z",
    centroid: [518, 658],
  },
  {
    id: "midtown", name: "Midtown", borough: "Manhattan",
    population: 310, assetValueB: 538, baseElevation: 9,
    path: "M478,520 L520,505 L552,512 L560,545 L555,585 L548,612 L520,600 L495,612 L482,592 L470,560 Z",
    centroid: [515, 558],
  },
  {
    id: "upper-manhattan", name: "Upper Manhattan", borough: "Manhattan",
    population: 580, assetValueB: 286, baseElevation: 24,
    path: "M462,395 L502,378 L540,388 L558,418 L562,460 L552,500 L520,505 L478,520 L460,488 L452,440 Z",
    centroid: [507, 450],
  },
  {
    id: "brooklyn-heights", name: "Brooklyn Heights", borough: "Brooklyn",
    population: 420, assetValueB: 198, baseElevation: 12,
    path: "M555,678 L595,672 L638,690 L660,720 L652,755 L618,778 L578,772 L548,752 L538,712 Z",
    centroid: [600, 728],
  },
  {
    id: "south-brooklyn", name: "South Brooklyn", borough: "Brooklyn",
    population: 890, assetValueB: 312, baseElevation: 5,
    path: "M548,752 L618,778 L688,790 L735,820 L740,862 L702,895 L640,902 L578,888 L538,860 L530,810 Z",
    centroid: [635, 838],
  },
  {
    id: "queens-west", name: "Queens West", borough: "Queens",
    population: 720, assetValueB: 245, baseElevation: 8,
    path: "M620,510 L692,498 L758,520 L780,560 L772,610 L735,648 L688,690 L638,690 L595,672 L572,632 L580,580 L598,540 Z",
    centroid: [685, 595],
  },
  {
    id: "rockaways", name: "Rockaways", borough: "Queens",
    population: 130, assetValueB: 42, baseElevation: 2,
    path: "M702,895 L780,905 L858,915 L902,925 L908,948 L862,955 L778,948 L702,938 L668,925 Z",
    centroid: [800, 928],
  },
  {
    id: "bronx-south", name: "South Bronx", borough: "Bronx",
    population: 540, assetValueB: 132, baseElevation: 11,
    path: "M482,310 L538,295 L598,308 L632,335 L628,375 L598,398 L558,408 L518,402 L488,380 L468,348 Z",
    centroid: [550, 352],
  },
  {
    id: "staten-island", name: "Staten Island", borough: "Staten Island",
    population: 480, assetValueB: 168, baseElevation: 18,
    path: "M280,750 L340,735 L398,748 L432,778 L438,820 L420,862 L378,888 L320,892 L268,872 L240,832 L248,790 Z",
    centroid: [340, 815],
  },
];

// ─── Scenarios ────────────────────────────────────────────────────────────────

export type ScenarioId = "rcp45" | "rcp85" | "mitigation" | "retreat";

export interface Scenario {
  id: ScenarioId;
  code: string;
  name: string;
  tagline: string;
  description: string;
  // Per-district risk multipliers (0..1+) at year 2100
  intensity: number;
  // Capital required to execute, billions USD
  capitalRequiredB: number;
}

export const SCENARIOS: Scenario[] = [
  {
    id: "rcp45", code: "RCP 4.5",
    name: "Stabilization Pathway",
    tagline: "Coordinated global emissions decline post-2040.",
    description: "Sea level +0.6m by 2100. Heat days +18/yr. Moderate adaptation absorbs most shock.",
    intensity: 0.55, capitalRequiredB: 38,
  },
  {
    id: "rcp85", code: "RCP 8.5",
    name: "Business as Usual",
    tagline: "Emissions continue on current trajectory.",
    description: "Sea level +1.2m by 2100. Category-4 storm return: every 7 yrs. Insurance retreat by 2055.",
    intensity: 1.0, capitalRequiredB: 0,
  },
  {
    id: "mitigation", code: "MIT-A",
    name: "Harbor Barrier + Green Bonds",
    tagline: "$42B coastal defense + zoning + cooling grid.",
    description: "Storm surge barriers, elevated infrastructure, distributed cooling. 71% of exposure neutralized.",
    intensity: 0.32, capitalRequiredB: 42,
  },
  {
    id: "retreat", code: "RET-1",
    name: "Managed Retreat",
    tagline: "Strategic relocation from <3m elevation zones.",
    description: "Phased buyouts, density transfer to upland districts. Highest social cost, lowest residual risk.",
    intensity: 0.18, capitalRequiredB: 67,
  },
];

// ─── Risk model (deterministic, narrative-coherent) ──────────────────────────

export interface DistrictRisk {
  flood: number;          // 0..1
  heat: number;           // 0..1
  infrastructure: number; // 0..1
  composite: number;      // 0..1
  propertyDropPct: number;
  populationExposed: number; // thousands
  assetAtRiskB: number;
}

const yearFactor = (year: number) => {
  // 2025 → 0, 2100 → 1, smooth
  const t = Math.max(0, Math.min(1, (year - 2025) / 75));
  return t * t * (3 - 2 * t); // smoothstep
};

export const computeRisk = (
  district: District,
  scenarioId: ScenarioId,
  year: number,
): DistrictRisk => {
  const scenario = SCENARIOS.find((s) => s.id === scenarioId)!;
  const t = yearFactor(year);
  // Elevation dampens flood; population dampens nothing; coastline distance baked into elevation.
  const elevDamp = Math.max(0.15, 1 - district.baseElevation / 30);
  const flood = Math.min(1, scenario.intensity * t * elevDamp * 1.15);
  const heat = Math.min(1, scenario.intensity * t * (0.55 + (district.population / 1500)));
  // Infra failure = flood + heat coupled
  const infrastructure = Math.min(1, 0.6 * flood + 0.5 * heat);
  const composite = Math.min(1, 0.45 * flood + 0.3 * heat + 0.25 * infrastructure);

  const propertyDropPct = composite * (scenarioId === "rcp85" ? 0.42 : 0.28);
  const populationExposed = district.population * (0.35 * flood + 0.4 * heat);
  const assetAtRiskB = district.assetValueB * composite;

  return { flood, heat, infrastructure, composite, propertyDropPct, populationExposed, assetAtRiskB };
};

export const computeCityTotals = (scenarioId: ScenarioId, year: number) => {
  const rows = DISTRICTS.map((d) => ({ d, r: computeRisk(d, scenarioId, year) }));
  const assetAtRiskB = rows.reduce((s, x) => s + x.r.assetAtRiskB, 0);
  const populationExposed = rows.reduce((s, x) => s + x.r.populationExposed, 0);
  const totalAssets = DISTRICTS.reduce((s, d) => s + d.assetValueB, 0);
  const totalPop = DISTRICTS.reduce((s, d) => s + d.population, 0);
  const composite = rows.reduce((s, x) => s + x.r.composite * x.d.assetValueB, 0) / totalAssets;
  const scenario = SCENARIOS.find((s) => s.id === scenarioId)!;
  const costOfInactionB = assetAtRiskB - scenario.capitalRequiredB;
  const roiOfAction = scenario.capitalRequiredB > 0
    ? (assetAtRiskB / scenario.capitalRequiredB)
    : 0;

  return {
    assetAtRiskB,
    populationExposed,
    totalAssets,
    totalPop,
    composite,
    capitalRequiredB: scenario.capitalRequiredB,
    costOfInactionB,
    roiOfAction,
  };
};

export const riskColor = (v: number): string => {
  // Map 0..1 → low → extreme HSL
  if (v < 0.25) return "hsl(var(--risk-low))";
  if (v < 0.5) return "hsl(var(--risk-med))";
  if (v < 0.75) return "hsl(var(--risk-high))";
  return "hsl(var(--risk-extreme))";
};

export const riskLabel = (v: number): string => {
  if (v < 0.25) return "LOW";
  if (v < 0.5) return "MODERATE";
  if (v < 0.75) return "HIGH";
  return "EXTREME";
};
