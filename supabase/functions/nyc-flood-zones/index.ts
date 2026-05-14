// FEMA National Flood Hazard Layer (NFHL) — Flood Hazard Areas (S_Fld_Haz_Ar)
// Filtered to the five NYC counties via DFIRM_ID prefix 36 (NY) and county codes.
// Returns total polygon count + high-risk (V/A zones) count for the city.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// FEMA NFHL public ArcGIS service, layer 28 = S_Fld_Haz_Ar
const NFHL = "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query";

// NYC county DFIRM IDs (state 36 + county FIPS)
const NYC_COUNTIES = ["36005C", "36047C", "36061C", "36081C", "36085C"];

const arcgis = async (where: string) => {
  const url = `${NFHL}?where=${encodeURIComponent(where)}&returnCountOnly=true&f=json`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`FEMA ${r.status}`);
  const j = await r.json();
  return Number(j.count ?? 0);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const countyClause = NYC_COUNTIES.map((c) => `DFIRM_ID LIKE '${c}%'`).join(" OR ");
    const total = await arcgis(`(${countyClause})`);
    const high = await arcgis(`(${countyClause}) AND (FLD_ZONE LIKE 'V%' OR FLD_ZONE LIKE 'A%')`);
    const veZone = await arcgis(`(${countyClause}) AND FLD_ZONE LIKE 'V%'`);
    const aeZone = await arcgis(`(${countyClause}) AND FLD_ZONE LIKE 'A%'`);

    const payload = {
      totalParcels: total,
      highRiskParcels: high,
      highRiskShare: total > 0 ? high / total : 0,
      byZone: { V: veZone, A: aeZone, OTHER: Math.max(0, total - veZone - aeZone) },
      dataset: "FEMA NFHL S_Fld_Haz_Ar — NYC five counties",
    };

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { error } = await supabase
      .from("live_data_cache")
      .upsert({ source: "nyc_flood_zones", payload, fetched_at: new Date().toISOString() }, { onConflict: "source" });
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, payload }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
