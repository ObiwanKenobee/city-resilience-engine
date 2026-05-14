// NYC Open Data — Flood Vulnerability Index (mrjc-v9pm)
// Per–census-tract scoring of stormwater + storm-surge flood risk.
// We aggregate to a city total + high-risk count for use as a live
// multiplier in the deterministic risk model.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SOCRATA = "https://data.cityofnewyork.us/resource/mrjc-v9pm.json";

const fetchJson = async (qs: string) => {
  const r = await fetch(`${SOCRATA}?${qs}`, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`NYC OD ${r.status}`);
  return await r.json();
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const fshri = await fetchJson("$select=fshri,count(*) AS n&$group=fshri") as Array<{ fshri?: string; n: string }>;
    const surge = await fetchJson("$select=ss_80s,count(*) AS n&$group=ss_80s") as Array<{ ss_80s?: string; n: string }>;

    let total = 0;
    let high = 0;
    const byIndex: Record<string, number> = {};
    for (const r of fshri) {
      const k = r.fshri ?? "0";
      const n = Number(r.n ?? 0);
      byIndex[k] = n;
      total += n;
      if (Number(k) >= 4) high += n;
    }
    const surgeBy: Record<string, number> = {};
    for (const r of surge) surgeBy[r.ss_80s ?? "0"] = Number(r.n ?? 0);

    const payload = {
      totalParcels: total,                    // census tracts evaluated
      highRiskParcels: high,                  // FSHRI ≥ 4
      highRiskShare: total > 0 ? high / total : 0,
      byZone: byIndex,                        // FSHRI 1..5 distribution
      surge2080: surgeBy,                     // storm surge 2080s 1..5
      dataset: "NYC Flood Vulnerability Index (mrjc-v9pm)",
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
