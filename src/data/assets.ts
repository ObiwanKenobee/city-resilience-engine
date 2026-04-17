// Asset risk: parse a CSV / pasted block of NYC building rows,
// snap each to its nearest district by lat/lng (or by district-name match),
// then compute exposure under the active scenario+year.

import Papa from "papaparse";
import { DISTRICTS, computeRisk, ScenarioId, District } from "./nyc";

export interface AssetInput {
  id: string;          // address, building name, or row id
  lat?: number;
  lng?: number;
  district?: string;   // optional explicit district name
  valueM: number;      // asset value in $M
}

export interface AssetExposure {
  asset: AssetInput;
  district: District;
  composite: number;
  flood: number;
  heat: number;
  exposureM: number;          // expected loss = value × composite
  var95M: number;             // 95% tail loss
  insurance: "STABLE" | "REPRICE" | "RETREAT" | "UNINSURABLE";
  rec: string;
}

// District centroids in lat/lng — hand-set to roughly correspond to SVG centroids.
// Real implementation would use PostGIS/GeoJSON. For demo, this is fine.
const DISTRICT_LATLNG: Record<string, [number, number]> = {
  "lower-manhattan":  [40.711, -74.009],
  "midtown":          [40.755, -73.984],
  "upper-manhattan":  [40.825, -73.945],
  "brooklyn-heights": [40.696, -73.994],
  "south-brooklyn":   [40.605, -73.965],
  "queens-west":      [40.745, -73.910],
  "rockaways":        [40.585, -73.812],
  "bronx-south":      [40.820, -73.910],
  "staten-island":    [40.580, -74.150],
};

const haversine = (a: [number, number], b: [number, number]): number => {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]); const lat2 = toRad(b[0]);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};

const snapToDistrict = (asset: AssetInput): District => {
  // Explicit name match first
  if (asset.district) {
    const norm = asset.district.toLowerCase().replace(/\s+/g, "-");
    const hit = DISTRICTS.find((d) => d.id === norm || d.name.toLowerCase() === asset.district!.toLowerCase());
    if (hit) return hit;
  }
  // Lat/lng → nearest centroid
  if (typeof asset.lat === "number" && typeof asset.lng === "number") {
    let best = DISTRICTS[0]; let bestDist = Infinity;
    for (const d of DISTRICTS) {
      const ll = DISTRICT_LATLNG[d.id];
      const dist = haversine([asset.lat, asset.lng], ll);
      if (dist < bestDist) { bestDist = dist; best = d; }
    }
    return best;
  }
  // Fallback — Lower Manhattan
  return DISTRICTS[0];
};

export const computeAssetExposure = (
  assets: AssetInput[],
  scenario: ScenarioId,
  year: number,
): AssetExposure[] => {
  return assets.map((a) => {
    const d = snapToDistrict(a);
    const r = computeRisk(d, scenario, year);
    const exposureM = a.valueM * r.composite;
    // Tail = 1.6x mean for fat-tailed climate distributions
    const var95M = exposureM * 1.6;
    let insurance: AssetExposure["insurance"];
    let rec: string;
    if (r.composite > 0.85)      { insurance = "UNINSURABLE"; rec = "Divest or accept full retention. No carrier will underwrite at horizon."; }
    else if (r.composite > 0.6)  { insurance = "RETREAT"; rec = "Carriers exiting market. Capture residual value pre-2040; relocate operations."; }
    else if (r.composite > 0.4)  { insurance = "REPRICE"; rec = "Premiums rising 8–14%/yr. Consider parametric flood overlay + structural retrofit."; }
    else                         { insurance = "STABLE"; rec = "Monitor annually. Allocate 0.3% of NOI to preventive resilience capex."; }
    return { asset: a, district: d, composite: r.composite, flood: r.flood, heat: r.heat, exposureM, var95M, insurance, rec };
  });
};

export interface PortfolioRollup {
  totalAssets: number;
  totalValueM: number;
  totalExposureM: number;
  totalVaR95M: number;
  weightedComposite: number;
  uninsurablePct: number;
  byDistrict: { district: District; valueM: number; exposureM: number; count: number }[];
  worst: AssetExposure[];
}

export const rollup = (rows: AssetExposure[]): PortfolioRollup => {
  const totalValueM = rows.reduce((s, r) => s + r.asset.valueM, 0);
  const totalExposureM = rows.reduce((s, r) => s + r.exposureM, 0);
  const totalVaR95M = rows.reduce((s, r) => s + r.var95M, 0);
  const weightedComposite = totalValueM > 0
    ? rows.reduce((s, r) => s + r.composite * r.asset.valueM, 0) / totalValueM
    : 0;
  const uninsurable = rows.filter((r) => r.insurance === "UNINSURABLE" || r.insurance === "RETREAT");
  const uninsurableValue = uninsurable.reduce((s, r) => s + r.asset.valueM, 0);

  const byMap = new Map<string, { district: District; valueM: number; exposureM: number; count: number }>();
  for (const r of rows) {
    const k = r.district.id;
    const cur = byMap.get(k) ?? { district: r.district, valueM: 0, exposureM: 0, count: 0 };
    cur.valueM += r.asset.valueM;
    cur.exposureM += r.exposureM;
    cur.count += 1;
    byMap.set(k, cur);
  }
  const byDistrict = Array.from(byMap.values()).sort((a, b) => b.exposureM - a.exposureM);
  const worst = [...rows].sort((a, b) => b.exposureM - a.exposureM).slice(0, 10);

  return {
    totalAssets: rows.length,
    totalValueM,
    totalExposureM,
    totalVaR95M,
    weightedComposite,
    uninsurablePct: totalValueM > 0 ? uninsurableValue / totalValueM : 0,
    byDistrict,
    worst,
  };
};

// Parse CSV / TSV / pasted text. Accepts:
//   id, lat, lng, value
//   id, district, value
//   address, district, value_m
// Auto-detects header presence.
export const parseAssetText = (text: string): { rows: AssetInput[]; errors: string[] } => {
  const errors: string[] = [];
  const trimmed = text.trim();
  if (!trimmed) return { rows: [], errors: ["Empty input"] };

  const parsed = Papa.parse<Record<string, string>>(trimmed, {
    header: true, skipEmptyLines: true, transformHeader: (h) => h.trim().toLowerCase(),
  });

  const rows: AssetInput[] = [];
  parsed.data.forEach((row, i) => {
    const id = row.id ?? row.address ?? row.name ?? row.building ?? `Asset ${i + 1}`;
    const lat = parseFloat(row.lat ?? row.latitude ?? "");
    const lng = parseFloat(row.lng ?? row.lon ?? row.long ?? row.longitude ?? "");
    const district = row.district ?? row.borough ?? undefined;
    const valueRaw = row.value ?? row.value_m ?? row.valuem ?? row.value_usd ?? row.value_million ?? "";
    const valueM = parseFloat(String(valueRaw).replace(/[$,_\sM]/gi, ""));

    if (isNaN(valueM) || valueM <= 0) {
      errors.push(`Row ${i + 1} (${id}): missing or invalid value`);
      return;
    }
    const hasGeo = (!isNaN(lat) && !isNaN(lng)) || !!district;
    if (!hasGeo) {
      errors.push(`Row ${i + 1} (${id}): need lat/lng or district`);
      return;
    }
    rows.push({
      id: String(id),
      lat: isNaN(lat) ? undefined : lat,
      lng: isNaN(lng) ? undefined : lng,
      district,
      valueM,
    });
  });

  return { rows, errors };
};

export const SAMPLE_PORTFOLIO = `id,lat,lng,value
One World Trade,40.7127,-74.0134,3800
432 Park Ave,40.7615,-73.9718,1300
Brooklyn Navy Yard Tower,40.6979,-73.9712,420
Hunter's Point S,40.7421,-74.0085,650
Coney Island Resort,40.5749,-73.9857,180
Rockaway Boardwalk Lofts,40.5853,-73.8121,95
Stapleton Waterfront,40.6263,-74.0762,140
Hudson Yards Block C,40.7547,-74.0021,2100
Riverdale Heights,40.8835,-73.9051,310
Long Island City Mixed-Use,40.7486,-73.9418,890
SoHo Cast-Iron Holdings,40.7237,-74.0006,560
Williamsburg Navy Quarter,40.7141,-73.9618,720
Far Rockaway Senior Estate,40.6041,-73.7553,72
Battery Park City Phase 4,40.7115,-74.0156,1450
Sunset Park Industrial,40.6457,-74.0107,330`;
