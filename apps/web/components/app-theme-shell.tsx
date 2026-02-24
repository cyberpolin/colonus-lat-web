"use client";

import { useColonusStore } from "@/lib/store";
import { useIntervalService } from "@/lib/interval-service";
import { useAutoSnapshotSync } from "@/lib/use-auto-snapshot-sync";

const hexToRgb = (hex: string): string => {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return "100 116 139";
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
};

export function AppThemeShell({ children }: { children: React.ReactNode }) {
  useIntervalService();
  useAutoSnapshotSync();
  const themeColorHex = useColonusStore((state) => state.themeColorHex);
  const themeHueRotate = useColonusStore((state) => state.themeHueRotate);
  const themeRgb = hexToRgb(themeColorHex);

  return (
    <div
      id="app-theme-shell"
      data-theme-color={themeColorHex}
      style={{
        ["--theme-hue" as string]: `${themeHueRotate}deg`,
        ["--theme-rgb" as string]: themeRgb
      }}
    >
      {children}
    </div>
  );
}
