"use client";

import { useMemo } from "react";
import { createThemeSwatches } from "@/lib/color-themes";
import { useColonusStore } from "@/lib/store";

export function UiSystemThemeSelector() {
  const themeColorHex = useColonusStore((state) => state.themeColorHex);
  const setThemeColor = useColonusStore((state) => state.setThemeColor);
  const swatches = useMemo(() => createThemeSwatches(5), []);

  return (
    <div id="ui-system-theme-selector" className="space-y-2">
      <p className="text-xs uppercase tracking-wide text-slate-500">App Color Theme</p>
      <div id="ui-system-theme-select" className="flex flex-wrap gap-2">
        {swatches.map((swatch) => {
          const isActive = themeColorHex.toLowerCase() === swatch.hex.toLowerCase();
          return (
            <button
              key={swatch.id}
              type="button"
              aria-label={`Select ${swatch.label} theme`}
              title={`${swatch.label} (${swatch.hex})`}
              onClick={() => setThemeColor({ hex: swatch.hex, hueRotate: swatch.hueRotate })}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${
                isActive ? "border-slate-900 ring-2 ring-slate-400" : "border-slate-300 hover:border-slate-500"
              }`}
              style={{ backgroundColor: swatch.hex }}
            />
          );
        })}
      </div>
      <p className="text-xs text-slate-600">Slate is fixed as base; other options are randomized on each load.</p>
    </div>
  );
}
