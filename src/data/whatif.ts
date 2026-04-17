// What-If policy mixer.
// Each lever has a current capital allocation in $B and a risk-reduction
// curve. Effects are damped (diminishing returns), partially overlap
// (seawall + retreat target the same flood vector), and combined into a
// blended residual-risk multiplier applied to the base scenario.

import { computeCityTotals, ScenarioId, computeRisk, DISTRICTS } from "./nyc";

export type LeverId = "seawall" | "zoning" | "cooling" | "retreat";

export interface Lever {
  id: LeverId;
  name: string;
  code: string;
  blurb: string;
  // capital required to fully saturate this lever, $B
  saturationB: number;
  // weight on each risk vector (0..1)
  flood: number;
  heat: number;
  infra: number;
  // overlap group — levers in same group don't double-count
  group: "coastal" | "thermal" | "structural";
}

export const LEVERS: Lever[] = [
  {
    id: "seawall",
    name: "Storm Barrier + Coastal Defense",
    code: "SEA-DEF",
    blurb: "Outer-harbor surge gates, elevated bulkheads, marsh restoration.",
    saturationB: 38, flood: 0.85, heat: 0.05, infra: 0.40, group: "coastal",
  },
  {
    id: "zoning",
    name: "Resilience Zoning + Building Code",
    code: "ZON-04",
    blurb: "Mandatory flood-aware new builds, permeable surfaces, raised mechanicals.",
    saturationB: 14, flood: 0.30, heat: 0.20, infra: 0.55, group: "structural",
  },
  {
    id: "cooling",
    name: "Distributed Cooling Grid",
    code: "COOL-2",
    blurb: "Neighborhood cooling centers, white roofs, urban tree canopy doubling.",
    saturationB: 18, flood: 0.02, heat: 0.78, infra: 0.20, group: "thermal",
  },
  {
    id: "retreat",
    name: "Managed Retreat (under 3m elev)",
    code: "RET-A",
    blurb: "Phased buyouts, density transfer to upland nodes.",
    saturationB: 56, flood: 0.92, heat: 0.10, infra: 0.30, group: "coastal",
  },
];

export type Allocation = Record<LeverId, number>; // capital in $B per lever

export const emptyAllocation = (): Allocation => ({
  seawall: 0, zoning: 0, cooling: 0, retreat: 0,
});

// Smooth saturating curve: 1 - exp(-3x)
const saturation = (capital: number, sat: number) =>
  sat === 0 ? 0 : 1 - Math.exp(-3 * Math.min(1, capital / sat));

// Compute residual risk multipliers per vector after applying allocation
export interface ResidualMix {
  flood: number;     // 0..1, 1 = no reduction
  heat: number;
  infra: number;
  composite: number;
  totalCapitalB: number;
  // diagnostic per-lever effective contribution (0..1 along its vector)
  perLever: Record<LeverId, number>;
}

export const computeResidual = (alloc: Allocation): ResidualMix => {
  // Per group, aggregate flood reduction with overlap damping (partial intersection)
  const perLever: Record<LeverId, number> = { seawall: 0, zoning: 0, cooling: 0, retreat: 0 };
  for (const l of LEVERS) {
    perLever[l.id] = saturation(alloc[l.id], l.saturationB);
  }

  // Combine per vector. Levers in same group: 1 - prod(1 - eff*weight).
  // Across groups: same OR-style combine.
  const combine = (vector: "flood" | "heat" | "infra"): number => {
    let p = 1;
    for (const l of LEVERS) {
      const eff = perLever[l.id] * l[vector];
      p *= (1 - eff);
    }
    return 1 - p; // 0..1 reduction
  };

  const fr = combine("flood");
  const hr = combine("heat");
  const ir = combine("infra");

  const residualFlood = 1 - fr;
  const residualHeat = 1 - hr;
  const residualInfra = 1 - ir;
  // Composite uses same weights as the base risk model
  const residualComposite = 0.45 * residualFlood + 0.3 * residualHeat + 0.25 * residualInfra;

  const total = (Object.values(alloc) as number[]).reduce((s, v) => s + v, 0);

  return {
    flood: residualFlood,
    heat: residualHeat,
    infra: residualInfra,
    composite: residualComposite,
    totalCapitalB: total,
    perLever,
  };
};

// Apply a residual mix to a baseline scenario+year and return the
// blended city outcome.
export const computeWhatIf = (scenario: ScenarioId, year: number, alloc: Allocation) => {
  const baseline = computeCityTotals(scenario, year);
  const mix = computeResidual(alloc);

  // Recompute per-district under the mix multipliers
  let mitigatedAssetAtRiskB = 0;
  let mitigatedPopExposed = 0;
  let mitigatedCompositeWeighted = 0;
  let totalAssets = 0;
  let totalPop = 0;

  const perDistrict = DISTRICTS.map((d) => {
    const r = computeRisk(d, scenario, year);
    const newFlood = r.flood * mix.flood;
    const newHeat = r.heat * mix.heat;
    const newInfra = r.infrastructure * mix.infra;
    const newComposite = 0.45 * newFlood + 0.3 * newHeat + 0.25 * newInfra;
    const newAssetsAtRisk = d.assetValueB * newComposite;
    const newPopExposed = d.population * (0.35 * newFlood + 0.4 * newHeat);
    mitigatedAssetAtRiskB += newAssetsAtRisk;
    mitigatedPopExposed += newPopExposed;
    mitigatedCompositeWeighted += newComposite * d.assetValueB;
    totalAssets += d.assetValueB;
    totalPop += d.population;
    return { id: d.id, baseline: r.composite, mitigated: newComposite };
  });

  const avoidedLossB = Math.max(0, baseline.assetAtRiskB - mitigatedAssetAtRiskB);
  const blendedROI = mix.totalCapitalB > 0 ? avoidedLossB / mix.totalCapitalB : 0;
  const blendedComposite = mitigatedCompositeWeighted / totalAssets;

  return {
    baseline,
    mix,
    mitigated: {
      assetAtRiskB: mitigatedAssetAtRiskB,
      populationExposed: mitigatedPopExposed,
      composite: blendedComposite,
    },
    avoidedLossB,
    avoidedPopK: Math.max(0, baseline.populationExposed - mitigatedPopExposed),
    blendedROI,
    perDistrict,
  };
};
