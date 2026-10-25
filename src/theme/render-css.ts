import { PALETTES, THEME_IDS, TOKEN_NAMES, type Palette } from "./tokens";

const declarations = (palette: Palette, scheme: "light" | "dark") =>
  `${TOKEN_NAMES.map((name) => `--${name}:${palette[name]};`).join("")}color-scheme:${scheme};`;

/**
 * CSS custom properties for every theme and mode, switched by `data-theme`
 * and `data-mode` on <html> (or on any element, to preview another theme).
 * `system` follows `prefers-color-scheme`, so the server-rendered attributes
 * are enough for a correct first paint (ADR 0011).
 */
export function renderThemeCss(): string {
  const rules: string[] = [];
  const systemDark: string[] = [];
  for (const id of THEME_IDS) {
    const { light, dark } = PALETTES[id];
    const sel = (mode: string) => `[data-theme="${id}"][data-mode="${mode}"]`;
    rules.push(
      `${sel("light")},${sel("system")}{${declarations(light, "light")}}`,
    );
    rules.push(`${sel("dark")}{${declarations(dark, "dark")}}`);
    systemDark.push(`${sel("system")}{${declarations(dark, "dark")}}`);
  }
  return `${rules.join("")}@media (prefers-color-scheme: dark){${systemDark.join("")}}`;
}
