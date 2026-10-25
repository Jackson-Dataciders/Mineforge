import { describe, expect, it } from "vitest";
import { composite, contrastRatio, parseHex, type Rgb } from "./contrast";
import { renderThemeCss } from "./render-css";
import {
  PALETTES,
  THEME_IDS,
  TINT_ALPHA,
  type Palette,
  type TokenName,
} from "./tokens";

const TEXT = 4.5;
const UI = 3;
const TINTED: TokenName[] = [
  "accent",
  "secondary",
  "ok",
  "muted",
  "danger",
  "warning",
];

/**
 * Every foreground/background pair the UI uses (usage policy in ADR 0011).
 * Add a pair here before using a new combination.
 */
function usedPairs(
  p: Palette,
): { fg: string; bg: string; fgColor: Rgb; bgColor: Rgb; min: number }[] {
  const c = (t: TokenName) => parseHex(p[t]);
  const backgrounds: Record<string, Rgb> = {
    bg: c("bg"),
    surface: c("surface"),
    slot: c("slot"),
  };
  for (const role of TINTED) {
    backgrounds[`${role} tint`] = composite(c(role), c("surface"), TINT_ALPHA);
  }
  const pairs: ReturnType<typeof usedPairs> = [];
  const add = (fg: TokenName, bg: string, min: number) =>
    pairs.push({
      fg,
      bg,
      fgColor: c(fg),
      bgColor: backgrounds[bg] ?? c(bg as TokenName),
      min,
    });

  for (const bg of Object.keys(backgrounds)) {
    add("text", bg, TEXT);
    add("muted", bg, TEXT);
  }
  add("on-accent", "accent", TEXT);
  add("danger", "bg", TEXT); // error messages
  add("danger", "surface", TEXT);
  // Role colors as icons, outlines and focus rings (non-text, 3:1).
  for (const role of TINTED) {
    for (const bg of ["bg", "surface", "slot"]) add(role, bg, UI);
  }
  for (const role of [
    "accent",
    "secondary",
    "ok",
    "muted",
    "danger",
    "warning",
  ] as const) {
    add(role, `${role} tint`, UI); // icon or outline inside its own tint
  }
  return pairs;
}

describe("theme palettes", () => {
  for (const id of THEME_IDS) {
    for (const mode of ["light", "dark"] as const) {
      it(`${id} ${mode} meets WCAG AA for every used pair`, () => {
        const failures = usedPairs(PALETTES[id][mode])
          .map((p) => ({ ...p, ratio: contrastRatio(p.fgColor, p.bgColor) }))
          .filter((p) => p.ratio < p.min)
          .map((p) => `${p.fg} on ${p.bg}: ${p.ratio.toFixed(2)} < ${p.min}`);
        expect(failures).toEqual([]);
      });

      it(`${id} ${mode} avoids pure white backgrounds and pure black`, () => {
        const p = PALETTES[id][mode];
        for (const token of ["bg", "surface", "slot", "text"] as const) {
          expect(p[token]).not.toMatch(/^#(FFFFFF|000000)$/i);
        }
      });
    }
  }

  it("renders a rule for every theme and mode", () => {
    const css = renderThemeCss();
    for (const id of THEME_IDS) {
      for (const mode of ["light", "dark", "system"]) {
        expect(css).toContain(`[data-theme="${id}"][data-mode="${mode}"]`);
      }
    }
    expect(css).toContain("@media (prefers-color-scheme: dark)");
    expect(css).toContain("--on-accent:#FFFFFF;");
  });
});
