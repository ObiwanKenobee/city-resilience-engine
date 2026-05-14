// Live data context — surfaces live NOAA + NYC flood data state
// to the entire app (TopBar indicator, scenario engine, etc).

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { setLiveAdjustments } from "@/data/nyc";

export interface NoaaSeaLevel {
  station: string;          // "8518750" (The Battery, NYC)
  trendMmPerYr: number;     // observed mm/yr trend
  refYear: number;
  lastObservedYear: number;
  lastObservedM: number;    // sea level anomaly in meters vs reference
  fetchedAt: string;        // ISO
}

export interface NycFloodZone {
  totalParcels: number;
  highRiskParcels: number;
  highRiskShare: number;
  fetchedAt: string;
}

interface LiveDataState {
  noaa: NoaaSeaLevel | null;
  flood: NycFloodZone | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  isLive: boolean;
}

const LiveDataCtx = createContext<LiveDataState | null>(null);

export const LiveDataProvider = ({ children }: { children: ReactNode }) => {
  const [noaa, setNoaa] = useState<NoaaSeaLevel | null>(null);
  const [flood, setFlood] = useState<NycFloodZone | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: e } = await (supabase as unknown as {
        from: (t: string) => {
          select: (s: string) => {
            in: (col: string, vals: string[]) => Promise<{
              data: Array<{ source: string; payload: Record<string, unknown>; fetched_at: string }> | null;
              error: { message: string } | null;
            }>;
          };
        };
      })
        .from("live_data_cache")
        .select("source, payload, fetched_at")
        .in("source", ["noaa_battery", "nyc_flood_zones"]);
      if (e) throw e;
      for (const row of data ?? []) {
        if (row.source === "noaa_battery") {
          const p = row.payload as Record<string, unknown>;
          setNoaa({
            station: String(p.station ?? "8518750"),
            trendMmPerYr: Number(p.trendMmPerYr ?? 0),
            refYear: Number(p.refYear ?? 1992),
            lastObservedYear: Number(p.lastObservedYear ?? 0),
            lastObservedM: Number(p.lastObservedM ?? 0),
            fetchedAt: String(row.fetched_at),
          });
        }
        if (row.source === "nyc_flood_zones") {
          const p = row.payload as Record<string, unknown>;
          const total = Number(p.totalParcels ?? 0);
          const high = Number(p.highRiskParcels ?? 0);
          setFlood({
            totalParcels: total,
            highRiskParcels: high,
            highRiskShare: Number(p.highRiskShare ?? (total > 0 ? high / total : 0)),
            fetchedAt: String(row.fetched_at),
          });
        }
      }
      // Push live numbers into the deterministic risk model.
      setLiveAdjustments({
        noaaTrendMmPerYr: (data ?? []).find((r) => r.source === "noaa_battery")
          ? Number((((data ?? []).find((r) => r.source === "noaa_battery")!.payload) as Record<string, unknown>).trendMmPerYr ?? 0) : undefined,
        nycHighRiskShare: (data ?? []).find((r) => r.source === "nyc_flood_zones")
          ? Number((((data ?? []).find((r) => r.source === "nyc_flood_zones")!.payload) as Record<string, unknown>).highRiskShare ?? 0) : undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  // Trigger a refresh by invoking the edge function, then reload.
  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([
        supabase.functions.invoke("noaa-sea-level"),
        supabase.functions.invoke("nyc-flood-zones"),
      ]);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const isLive = !!noaa && !!flood;

  return (
    <LiveDataCtx.Provider value={{ noaa, flood, loading, error, refresh, isLive }}>
      {children}
    </LiveDataCtx.Provider>
  );
};

export const useLiveData = () => {
  const c = useContext(LiveDataCtx);
  if (!c) throw new Error("useLiveData must be inside LiveDataProvider");
  return c;
};
