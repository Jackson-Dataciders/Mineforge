"use client";

import { TriangleAlert } from "lucide-react";
import type { Loader } from "@/domain/library";
import { useT } from "@/i18n/client";

/** Why a library mod doesn't target NeoForge 1.21.1 (ADR 0016), for display. */
export type Incompatibility =
  { reason: "loader"; loader: Loader } | { reason: "version"; range: string };

const LOADER_NAMES: Record<Loader, string> = {
  neoforge: "NeoForge",
  forge: "Forge",
  fabric: "Fabric",
};

export function useIncompatibilityText() {
  const t = useT();
  return (info: Incompatibility) =>
    info.reason === "loader"
      ? t("library.incompatibleLoader", { loader: LOADER_NAMES[info.loader] })
      : t("library.incompatibleVersion", { range: info.range });
}

/** Badge shown on mods that are not for NeoForge 1.21.1. */
export function CompatBadge({ info }: { info: Incompatibility }) {
  const text = useIncompatibilityText();
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-warning/13 px-2 text-xs text-text">
      <TriangleAlert className="size-3 text-warning" aria-hidden />
      {text(info)}
    </span>
  );
}
