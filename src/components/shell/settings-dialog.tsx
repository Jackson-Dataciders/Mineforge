"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Dialog } from "@/components/ui/dialog";
import { useLocale, useT } from "@/i18n/client";
import { LOCALE_COOKIE, LOCALES, type Locale } from "@/i18n/locale";
import { setPreferenceCookie, setRootDataAttribute } from "@/lib/preferences";
import {
  COLOR_MODES,
  DEFAULT_MODE,
  DEFAULT_THEME,
  isColorMode,
  isThemeId,
  MODE_COOKIE,
  THEME_COOKIE,
  THEME_IDS,
  THEME_NAMES,
  type ColorMode,
  type ThemeId,
} from "@/theme/tokens";

const MODE_ICONS: Record<ColorMode, ReactNode> = {
  light: <Sun className="size-4" aria-hidden />,
  dark: <Moon className="size-4" aria-hidden />,
  system: <Monitor className="size-4" aria-hidden />,
};

function Choice({
  name,
  checked,
  onChange,
  children,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  children: ReactNode;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-border px-3 text-sm has-checked:border-accent has-checked:bg-accent/13 has-focus-visible:outline-2 has-focus-visible:outline-accent">
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      {children}
    </label>
  );
}

/** Language, theme and light/dark/system mode; all persisted per device. */
export function SettingsDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const root =
    typeof document === "undefined" ? undefined : document.documentElement;
  const [theme, setTheme] = useState<ThemeId>(() =>
    isThemeId(root?.dataset.theme) ? root.dataset.theme : DEFAULT_THEME,
  );
  const [mode, setMode] = useState<ColorMode>(() =>
    isColorMode(root?.dataset.mode) ? root.dataset.mode : DEFAULT_MODE,
  );

  const chooseTheme = (id: ThemeId) => {
    setTheme(id);
    setRootDataAttribute("theme", id);
    setPreferenceCookie(THEME_COOKIE, id);
  };
  const chooseMode = (value: ColorMode) => {
    setMode(value);
    setRootDataAttribute("mode", value);
    setPreferenceCookie(MODE_COOKIE, value);
  };
  const chooseLocale = (value: Locale) => {
    setPreferenceCookie(LOCALE_COOKIE, value);
    router.refresh();
  };

  return (
    <Dialog open={open} onClose={onClose} title={t("settings.title")}>
      <div className="flex flex-col gap-5">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">
            {t("settings.language")}
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {LOCALES.map((value) => (
              <Choice
                key={value}
                name="locale"
                checked={value === locale}
                onChange={() => chooseLocale(value)}
              >
                <span lang={value}>{t(`locales.${value}`)}</span>
              </Choice>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">
            {t("settings.theme")}
          </legend>
          {THEME_IDS.map((id) => (
            <Choice
              key={id}
              name="theme"
              checked={id === theme}
              onChange={() => chooseTheme(id)}
            >
              {/* Preview: the theme's own tokens via data attributes, no raw colors. */}
              <span
                data-theme={id}
                data-mode={mode}
                aria-hidden
                className="flex overflow-hidden rounded border border-border"
              >
                {[
                  "bg-bg",
                  "bg-surface",
                  "bg-accent",
                  "bg-secondary",
                  "bg-ok",
                ].map((cls) => (
                  <span key={cls} className={`size-5 ${cls}`} />
                ))}
              </span>
              <span>{THEME_NAMES[id]}</span>
            </Choice>
          ))}
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">
            {t("settings.mode")}
          </legend>
          <div className="grid grid-cols-3 gap-2">
            {COLOR_MODES.map((value) => (
              <Choice
                key={value}
                name="mode"
                checked={value === mode}
                onChange={() => chooseMode(value)}
              >
                {MODE_ICONS[value]}
                {t(`settings.modes.${value}`)}
              </Choice>
            ))}
          </div>
        </fieldset>
      </div>
    </Dialog>
  );
}
