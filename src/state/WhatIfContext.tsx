// Lightweight what-if state shared across map, decision panel, PDF.
// Keeps the simulator modal self-contained while letting the rest of the
// app react when an allocation becomes "active" (totalCapital > 0).

import { createContext, useContext, useMemo, useState, ReactNode, useCallback } from "react";
import { Allocation, computeWhatIf, emptyAllocation } from "@/data/whatif";
import { ScenarioId } from "@/data/nyc";

interface Ctx {
  alloc: Allocation;
  setAlloc: (a: Allocation) => void;
  reset: () => void;
  isActive: boolean;          // any capital deployed
  computeFor: (scenario: ScenarioId, year: number) => ReturnType<typeof computeWhatIf>;
}

const WhatIfCtx = createContext<Ctx | null>(null);

export const WhatIfProvider = ({ children }: { children: ReactNode }) => {
  const [alloc, setAlloc] = useState<Allocation>(() => emptyAllocation());

  const isActive = useMemo(
    () => Object.values(alloc).reduce((s, v) => s + v, 0) > 0,
    [alloc]
  );

  const computeFor = useCallback(
    (scenario: ScenarioId, year: number) => computeWhatIf(scenario, year, alloc),
    [alloc]
  );

  const reset = useCallback(() => setAlloc(emptyAllocation()), []);

  return (
    <WhatIfCtx.Provider value={{ alloc, setAlloc, reset, isActive, computeFor }}>
      {children}
    </WhatIfCtx.Provider>
  );
};

export const useWhatIf = (): Ctx => {
  const ctx = useContext(WhatIfCtx);
  if (!ctx) throw new Error("useWhatIf must be inside WhatIfProvider");
  return ctx;
};
