export interface ThemeColorSelection {
  hex: string;
  hueRotate: number;
}

export interface ThemeSwatch extends ThemeColorSelection {
  id: string;
  label: string;
}

export const SLATE_BASE_HEX = "#64748b";

const clampHue = (hue: number): number => {
  const normalized = hue % 360;
  return normalized < 0 ? normalized + 360 : normalized;
};

const hexToRgb = (hex: string): { r: number; g: number; b: number } | undefined => {
  const normalized = hex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return undefined;
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16)
  };
};

const rgbToHue = ({ r, g, b }: { r: number; g: number; b: number }): number => {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  if (delta === 0) return 0;
  if (max === rn) return clampHue(((gn - bn) / delta) * 60);
  if (max === gn) return clampHue(((bn - rn) / delta) * 60 + 120);
  return clampHue(((rn - gn) / delta) * 60 + 240);
};

const hslToHex = (h: number, s: number, l: number): string => {
  const hue = clampHue(h);
  const sat = Math.max(0, Math.min(100, s)) / 100;
  const lig = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lig - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hue < 60) [r, g, b] = [c, x, 0];
  else if (hue < 120) [r, g, b] = [x, c, 0];
  else if (hue < 180) [r, g, b] = [0, c, x];
  else if (hue < 240) [r, g, b] = [0, x, c];
  else if (hue < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (value: number): string =>
    Math.round((value + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

export const slateBaseHue = (): number => {
  const rgb = hexToRgb(SLATE_BASE_HEX);
  return rgb ? rgbToHue(rgb) : 215;
};

export const selectionFromHex = (hex: string): ThemeColorSelection => {
  const rgb = hexToRgb(hex);
  if (!rgb) return { hex: SLATE_BASE_HEX, hueRotate: 0 };
  const targetHue = rgbToHue(rgb);
  const hueRotate = clampHue(targetHue - slateBaseHue());
  return {
    hex: `#${hex.replace("#", "").toLowerCase()}`,
    hueRotate
  };
};

export const defaultThemeColorSelection = (): ThemeColorSelection => selectionFromHex(SLATE_BASE_HEX);

export const legacyThemeSelection = (value: unknown): ThemeColorSelection | undefined => {
  if (value === "slate") return selectionFromHex(SLATE_BASE_HEX);
  if (value === "aqua") return selectionFromHex("#14b8a6");
  if (value === "emerald") return selectionFromHex("#10b981");
  if (value === "amber") return selectionFromHex("#f59e0b");
  if (value === "rose") return selectionFromHex("#f43f5e");
  return undefined;
};

export const createThemeSwatches = (randomCount: number): ThemeSwatch[] => {
  const swatches: ThemeSwatch[] = [
    {
      id: "theme-swatch-slate",
      label: "Slate",
      ...selectionFromHex(SLATE_BASE_HEX)
    }
  ];

  const usedHueBuckets = new Set<number>([Math.round(slateBaseHue() / 20)]);
  while (swatches.length < randomCount + 1) {
    const randomHue = Math.floor(Math.random() * 360);
    const bucket = Math.round(randomHue / 20);
    if (usedHueBuckets.has(bucket)) continue;
    usedHueBuckets.add(bucket);
    const hex = hslToHex(randomHue, 75, 52);
    const selection = selectionFromHex(hex);
    swatches.push({
      id: `theme-swatch-${swatches.length}`,
      label: `Color ${swatches.length}`,
      ...selection
    });
  }
  return swatches;
};
