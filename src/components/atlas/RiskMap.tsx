import { useMemo } from "react";
import {
  DISTRICTS, DistrictId, ScenarioId, computeRisk, riskColor,
} from "@/data/nyc";
import { useWhatIf } from "@/state/WhatIfContext";

interface Props {
  scenario: ScenarioId;
  year: number;
  selected: DistrictId | null;
  onSelect: (id: DistrictId) => void;
  layer: "composite" | "flood" | "heat" | "infrastructure";
}

export const RiskMap = ({ scenario, year, selected, onSelect, layer }: Props) => {
  const { isActive: whatIfActive, computeFor } = useWhatIf();
  const whatIf = useMemo(() => computeFor(scenario, year), [computeFor, scenario, year]);

  const data = useMemo(() => DISTRICTS.map((d) => {
    const r = computeRisk(d, scenario, year);
    const v = r[layer];
    // mitigated value for the same layer
    const mixMul = layer === "flood" ? whatIf.mix.flood
      : layer === "heat" ? whatIf.mix.heat
      : layer === "infrastructure" ? whatIf.mix.infra
      : (0.45 * whatIf.mix.flood + 0.3 * whatIf.mix.heat + 0.25 * whatIf.mix.infra);
    const mit = v * mixMul;
    return { d, r, v, mit };
  }), [scenario, year, layer, whatIf]);

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Background grid + aurora */}
      <div className="absolute inset-0 bg-grid opacity-30" />
      <div className="absolute inset-0 bg-aurora pointer-events-none" />

      {/* Compass */}
      <div className="absolute top-4 right-4 z-10 panel rounded-sm px-3 py-2 text-[10px] font-mono">
        <div className="text-primary tracking-[0.2em]">N ↑</div>
        <div className="text-muted-foreground mt-1">40.71° N · 74.00° W</div>
      </div>

      {/* What-if active banner */}
      {whatIfActive && (
        <div className="absolute top-4 left-4 z-10 panel rounded-sm px-3 py-2 max-w-[260px] animate-float-up">
          <div className="flex items-center gap-2 text-[10px] font-mono tracking-[0.2em] text-primary">
            <span className="ticker-dot" /> WHAT-IF OVERLAY ACTIVE
          </div>
          <div className="text-[10px] text-muted-foreground mt-1 leading-tight">
            Each district shows <span className="text-foreground">baseline</span> /{" "}
            <span className="text-risk-low">mitigated</span> · ${whatIf.mix.totalCapitalB.toFixed(1)}B deployed
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-10 panel rounded-sm px-3 py-2.5 min-w-[220px]">
        <div className="text-[10px] font-mono tracking-[0.2em] text-muted-foreground mb-1.5">
          {layer.toUpperCase()} RISK · {year}
        </div>
        <div className="h-2 rounded-sm" style={{ background: "var(--gradient-risk)" }} />
        <div className="flex justify-between mt-1 text-[9px] font-mono text-muted-foreground">
          <span>LOW</span><span>MODERATE</span><span>HIGH</span><span>EXTREME</span>
        </div>
      </div>

      <svg viewBox="0 0 1000 1000" className="w-full h-full">
        <defs>
          <radialGradient id="water" cx="50%" cy="50%">
            <stop offset="0%" stopColor="hsl(200 60% 12%)" />
            <stop offset="100%" stopColor="hsl(220 50% 5%)" />
          </radialGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="hsl(var(--primary) / 0.15)" strokeWidth="1" />
          </pattern>
          {/* split-fill clips — left half baseline, right half mitigated */}
          {data.map(({ d }) => (
            <clipPath id={`clip-l-${d.id}`} key={`l-${d.id}`}>
              <rect x="0" y="0" width={d.centroid[0]} height="1000" />
            </clipPath>
          ))}
          {data.map(({ d }) => (
            <clipPath id={`clip-r-${d.id}`} key={`r-${d.id}`}>
              <rect x={d.centroid[0]} y="0" width={1000 - d.centroid[0]} height="1000" />
            </clipPath>
          ))}
        </defs>

        <rect width="1000" height="1000" fill="url(#water)" />

        {/* Coastline ghost paths for atmosphere */}
        <g opacity="0.4">
          <path d="M0,300 Q200,280 400,320 T800,300 L1000,340 L1000,1000 L0,1000 Z"
                fill="none" stroke="hsl(var(--border-strong) / 0.3)" strokeWidth="1" strokeDasharray="2,4" />
        </g>

        {/* Districts */}
        {data.map(({ d, v, mit }) => {
          const isSel = selected === d.id;
          const baselineFill = riskColor(v);
          const mitigatedFill = riskColor(mit);
          return (
            <g key={d.id} className="cursor-pointer group" onClick={() => onSelect(d.id)}>
              {/* Glow halo (always baseline color) */}
              <path
                d={d.path}
                fill={baselineFill}
                opacity={0.18 + v * 0.35}
                filter="url(#glow)"
                className="transition-opacity"
              />

              {whatIfActive ? (
                <>
                  {/* Left half — BASELINE */}
                  <g clipPath={`url(#clip-l-${d.id})`}>
                    <path d={d.path} fill={baselineFill} fillOpacity={0.35 + v * 0.45} />
                  </g>
                  {/* Right half — MITIGATED */}
                  <g clipPath={`url(#clip-r-${d.id})`}>
                    <path d={d.path} fill={mitigatedFill} fillOpacity={0.35 + mit * 0.45} />
                  </g>
                  {/* Outline on top */}
                  <path
                    d={d.path}
                    fill="none"
                    stroke={isSel ? "hsl(var(--primary))" : "hsl(var(--border-strong) / 0.6)"}
                    strokeWidth={isSel ? 2 : 1}
                    style={{ filter: isSel ? "drop-shadow(0 0 16px hsl(var(--primary)))" : undefined }}
                  />
                  {/* Centroid divider */}
                  <line
                    x1={d.centroid[0]} y1={d.centroid[1] - 30}
                    x2={d.centroid[0]} y2={d.centroid[1] + 30}
                    stroke="hsl(var(--primary) / 0.6)" strokeWidth="0.6" strokeDasharray="2,2"
                  />
                </>
              ) : (
                <>
                  <path
                    d={d.path}
                    fill={baselineFill}
                    fillOpacity={0.35 + v * 0.45}
                    stroke={isSel ? "hsl(var(--primary))" : "hsl(var(--border-strong) / 0.6)"}
                    strokeWidth={isSel ? 2 : 1}
                    className="transition-all duration-300 group-hover:fill-opacity-80"
                    style={{ filter: isSel ? "drop-shadow(0 0 16px hsl(var(--primary)))" : undefined }}
                  />
                  {v > 0.7 && <path d={d.path} fill="url(#hatch)" pointerEvents="none" />}
                </>
              )}

              {/* Centroid pulse */}
              <circle
                cx={d.centroid[0]} cy={d.centroid[1]}
                r={isSel ? 6 : 3}
                fill="hsl(var(--background))"
                stroke={isSel ? "hsl(var(--primary))" : baselineFill}
                strokeWidth="2"
                className="transition-all"
              />
              {isSel && (
                <circle cx={d.centroid[0]} cy={d.centroid[1]} r="14"
                        fill="none" stroke="hsl(var(--primary))" strokeWidth="1" opacity="0.5">
                  <animate attributeName="r" values="6;22;6" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.7;0;0.7" dur="2s" repeatCount="indefinite" />
                </circle>
              )}
              {/* Label */}
              <text
                x={d.centroid[0]} y={d.centroid[1] - 14}
                textAnchor="middle"
                className="font-mono pointer-events-none select-none"
                fontSize="11"
                fill={isSel ? "hsl(var(--primary))" : "hsl(var(--foreground) / 0.85)"}
                style={{ textShadow: "0 1px 4px hsl(220 40% 4%)" }}
              >
                {d.name.toUpperCase()}
              </text>
              {whatIfActive ? (
                <text
                  x={d.centroid[0]} y={d.centroid[1] + 22}
                  textAnchor="middle"
                  className="font-mono pointer-events-none select-none tabular"
                  fontSize="10"
                >
                  <tspan fill={baselineFill}>{(v * 100).toFixed(0)}</tspan>
                  <tspan fill="hsl(var(--muted-foreground))" dx="3" dy="0">→</tspan>
                  <tspan fill={mitigatedFill} dx="3">{(mit * 100).toFixed(0)}</tspan>
                </text>
              ) : (
                <text
                  x={d.centroid[0]} y={d.centroid[1] + 22}
                  textAnchor="middle"
                  className="font-mono pointer-events-none select-none tabular"
                  fontSize="10"
                  fill={baselineFill}
                >
                  {(v * 100).toFixed(0)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};
