/**
 * The single source of all colors (ADR 0011). Components use the Tailwind
 * names mapped in globals.css (`bg-surface`, `text-muted`, …), never hex values.
 *
 * Values are from the brief, except these minimal lightness-only changes,
 * which were needed to pass WCAG AA (see ADR 0011):
 *   moss light:     muted #626D58 → #5F6A56, accent #4C8A2E → #49842C
 *   lantern light:  muted #6F6A5F → #6B665B, accent #D9A441 → #AC7C22,
 *                   on-accent #2B2110 → #241C0E
 *   lantern dark:   muted #A49C8E → #A59D8F
 *   deepslate-emerald light: accent #2F8A6E → #2D8469
 *   deepslate-emerald dark:  muted #9C9C96 → #9D9D97
 * `danger` and `warning` were derived per variant (not in the brief).
 */

export const THEME_IDS = ["moss", "lantern", "deepslate-emerald"] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export const COLOR_MODES = ["light", "dark", "system"] as const;
export type ColorMode = (typeof COLOR_MODES)[number];
export type ResolvedMode = Exclude<ColorMode, "system">;

export const DEFAULT_THEME: ThemeId = "moss";
export const DEFAULT_MODE: ColorMode = "system";

export const TOKEN_NAMES = [
  "bg",
  "surface",
  "border",
  "text",
  "muted",
  "accent",
  "on-accent",
  "secondary",
  "ok",
  "slot",
  "danger",
  "warning",
] as const;
export type TokenName = (typeof TOKEN_NAMES)[number];
export type Palette = Record<TokenName, string>;

/** Display names are proper names and stay English in every UI language. */
export const THEME_NAMES: Record<ThemeId, string> = {
  moss: "Overworld moss",
  lantern: "Lantern",
  "deepslate-emerald": "Deepslate emerald",
};

export const PALETTES: Record<ThemeId, Record<ResolvedMode, Palette>> = {
  moss: {
    light: {
      bg: "#F1F3EC",
      surface: "#F9FAF5",
      border: "#DCE1D2",
      text: "#2A3224",
      muted: "#5F6A56",
      accent: "#49842C",
      "on-accent": "#FFFFFF",
      secondary: "#8A5A2B",
      ok: "#2F7F6A",
      slot: "#E7EBDF",
      danger: "#BA4941",
      warning: "#9D8216",
    },
    dark: {
      bg: "#171B14",
      surface: "#20261C",
      border: "#343C2E",
      text: "#DCE3D4",
      muted: "#9AA68F",
      accent: "#7CC44E",
      "on-accent": "#0F1A09",
      secondary: "#C9925A",
      ok: "#5BBFA4",
      slot: "#2A3125",
      danger: "#DA6961",
      warning: "#D6BC51",
    },
  },
  lantern: {
    light: {
      bg: "#F5F1E8",
      surface: "#FBF8F2",
      border: "#E3DCCD",
      text: "#33302A",
      muted: "#6B665B",
      accent: "#AC7C22",
      "on-accent": "#241C0E",
      secondary: "#5B7A99",
      ok: "#5E8C4A",
      slot: "#EEE8DB",
      danger: "#BD4353",
      warning: "#D06538",
    },
    dark: {
      bg: "#1C1A17",
      surface: "#252220",
      border: "#3A3632",
      text: "#E6DFD2",
      muted: "#A59D8F",
      accent: "#E0B25C",
      "on-accent": "#221A0C",
      secondary: "#93AFCB",
      ok: "#94C27C",
      slot: "#2F2B27",
      danger: "#DB6474",
      warning: "#D67951",
    },
  },
  "deepslate-emerald": {
    light: {
      bg: "#F3F3F1",
      surface: "#FAFAF8",
      border: "#DEDED9",
      text: "#262624",
      muted: "#64645F",
      accent: "#2D8469",
      "on-accent": "#FFFFFF",
      secondary: "#B5677A",
      ok: "#4A7FB5",
      slot: "#EAEAE6",
      danger: "#B74D3D",
      warning: "#AE7C19",
    },
    dark: {
      bg: "#191A19",
      surface: "#222322",
      border: "#363735",
      text: "#E2E2DE",
      muted: "#9D9D97",
      accent: "#5FC4A2",
      "on-accent": "#0D1C17",
      secondary: "#E09AAB",
      ok: "#86B3E0",
      slot: "#2C2D2B",
      danger: "#D86958",
      warning: "#D6AA51",
    },
  },
};

/** Opacity of a role color over `surface` for tinted backgrounds (`bg-<role>/13`). */
export const TINT_ALPHA = 0.13;

export const isThemeId = (v: unknown): v is ThemeId =>
  typeof v === "string" && (THEME_IDS as readonly string[]).includes(v);
export const isColorMode = (v: unknown): v is ColorMode =>
  typeof v === "string" && (COLOR_MODES as readonly string[]).includes(v);

/** Cookie names; persisted per device (ADR 0011). */
export const THEME_COOKIE = "mf-theme";
export const MODE_COOKIE = "mf-mode";
