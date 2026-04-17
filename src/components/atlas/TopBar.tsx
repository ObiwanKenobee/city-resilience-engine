import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

export const TopBar = () => {
  const [time, setTime] = useState(new Date());
  const { pathname } = useLocation();
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const utc = time.toISOString().replace("T", " ").slice(0, 19) + "Z";

  return (
    <header className="border-b border-border bg-surface/80 backdrop-blur-xl">
      <div className="flex items-center justify-between px-6 h-14">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="relative">
              <div className="w-7 h-7 rounded-sm bg-primary/10 border border-primary/40 flex items-center justify-center">
                <div className="w-2.5 h-2.5 bg-primary rounded-sm shadow-[0_0_12px_hsl(var(--primary))]" />
              </div>
            </div>
            <div className="leading-tight">
              <div className="text-[10px] font-mono tracking-[0.25em] text-muted-foreground">ATLAS SANCTUM</div>
              <div className="text-sm font-semibold tracking-tight">NYC Decision Engine</div>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-1 ml-4 text-[11px] font-mono">
            <NavTab to="/" label="MAP" active={pathname === "/"} />
            <NavTab to="/assets" label="ASSETS" active={pathname === "/assets"} />
            <NavTab to="#" label="SCENARIOS" />
            <NavTab to="#" label="REPORTS" />
            <NavTab to="#" label="API" />
          </nav>
        </div>

        <div className="flex items-center gap-5 text-[11px] font-mono text-muted-foreground">
          <div className="hidden lg:flex items-center gap-2">
            <span className="ticker-dot" />
            <span>LIVE · NOAA · NASA · NYC OPEN DATA</span>
          </div>
          <div className="hidden sm:block tabular text-foreground/70">{utc}</div>
          <div className="px-2.5 py-1 rounded-sm border border-primary/30 bg-primary/5 text-primary text-[10px] tracking-[0.2em]">
            v0.9 · BETA
          </div>
        </div>
      </div>
    </header>
  );
};

const NavTab = ({ to, label, active }: { to: string; label: string; active?: boolean }) => (
  <Link
    to={to}
    className={`px-3 py-1.5 rounded-sm tracking-[0.2em] transition-colors ${
      active
        ? "text-primary bg-primary/10 border border-primary/30"
        : "text-muted-foreground hover:text-foreground hover:bg-muted/40 border border-transparent"
    }`}
  >
    {label}
  </Link>
);
