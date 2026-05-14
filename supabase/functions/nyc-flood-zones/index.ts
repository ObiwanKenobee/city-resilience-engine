// NYC Open Data — FEMA Preliminary Flood Insurance Rate Map zones
// Counts total flood-zone polygons and identifies high-risk (V/A) zones.
// Dataset: https://data.cityofnewyork.us/resource/mc5h-5freedom.json (FIRM 2015)
// We use the public Socrata endpoint; no auth required.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// FEMA Effective FIRM flood hazard zones for NYC (Socrata)
const DATASET = "https://data.cityofnewyork.us/resource/mc5h-5frd.json";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    // Fetch a counts breakdown by FLD_ZONE
    const url = `${DATASET}?$select=fld_zone,count(*)&$group=fld_zone&$limit=200`;
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error(`NYC OD ${r.status}`);
    const rows = await r.json() as Array<{ fld_zone?: string; count_fld_zone?: string; count?: string }>;

    let total = 0;
    let high = 0;
    const byZone: Record<string, number> = {};
    for (const row of rows) {
      const zone = (row.fld_zone ?? "UNK").toUpperCase();
      const n = Number(row.count_fld_zone ?? row.count ?? 0);
      byZone[zone] = n;
      total += n;
      // V = coastal high hazard (waves), A = 1% annual chance flood
      if (zone.startsWith("V") || zone.startsWith("A")) high += n;
    }

    const payload = {
      totalParcels: total,
      highRiskParcels: high,
      highRiskShare: total > 0 ? high / total : 0,
      byZone,
      dataset: "FEMA Effective FIRM (NYC)",
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
