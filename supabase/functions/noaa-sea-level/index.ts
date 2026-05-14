// NOAA Tides & Currents — The Battery, NYC (station 8518750)
// Pulls observed monthly mean sea level for the last ~30 years and computes
// a linear trend in mm/yr. Caches the normalized result in live_data_cache.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STATION = "8518750";

interface NoaaRow { t: string; v: string }

const fetchMonthlyMSL = async (years: number) => {
  const end = new Date();
  const begin = new Date(end);
  begin.setFullYear(end.getFullYear() - years);
  const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
  const url = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter` +
    `?product=monthly_mean&application=atlas-sanctum&begin_date=${fmt(begin)}` +
    `&end_date=${fmt(end)}&datum=MSL&station=${STATION}&time_zone=GMT&units=metric&format=json`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`NOAA ${r.status}`);
  const j = await r.json();
  // monthly_mean shape: { data: [{ year, month, MSL, ... }] }
  const data = (j.data ?? []) as Array<{ year: string; month: string; MSL: string }>;
  return data
    .filter((d) => d.MSL && d.MSL !== "")
    .map((d) => ({
      t: Number(d.year) + (Number(d.month) - 1) / 12,
      v: Number(d.MSL), // meters
    }))
    .filter((d) => Number.isFinite(d.v));
};

const linearTrend = (pts: { t: number; v: number }[]) => {
  const n = pts.length;
  const sx = pts.reduce((s, p) => s + p.t, 0);
  const sy = pts.reduce((s, p) => s + p.v, 0);
  const sxx = pts.reduce((s, p) => s + p.t * p.t, 0);
  const sxy = pts.reduce((s, p) => s + p.t * p.v, 0);
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx); // m/yr
  const intercept = (sy - slope * sx) / n;
  return { slope, intercept };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const pts = await fetchMonthlyMSL(30);
    if (pts.length < 24) throw new Error("insufficient NOAA data");
    const { slope } = linearTrend(pts);
    const last = pts[pts.length - 1];
    const refYear = Math.floor(pts[0].t);

    const payload = {
      station: STATION,
      trendMmPerYr: slope * 1000,
      refYear,
      lastObservedYear: Math.floor(last.t),
      lastObservedM: last.v,
      sampleCount: pts.length,
    };

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { error } = await supabase
      .from("live_data_cache")
      .upsert({ source: "noaa_battery", payload, fetched_at: new Date().toISOString() }, { onConflict: "source" });
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
