"use client";

import Link from "next/link";
import { useT } from "@/i18n/client";
import type { ViewId } from "./types";

const VIEWS: {
  id: ViewId;
  href: string;
  label: "views.designer" | "views.modpacks";
}[] = [
  { id: "designer", href: "/designer", label: "views.designer" },
  { id: "modpacks", href: "/modpacks", label: "views.modpacks" },
];

/** Segmented switch between Mod Designer and Modpack Planner. */
export function ViewSwitcher({ active }: { active: ViewId }) {
  const t = useT();
  return (
    <nav
      aria-label={t("views.label")}
      className="flex rounded-lg border border-border p-0.5"
    >
      {VIEWS.map((view) => (
        <Link
          key={view.id}
          href={view.href}
          aria-current={view.id === active ? "page" : undefined}
          className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-muted transition hover:text-text aria-[current=page]:bg-accent/13 aria-[current=page]:text-text"
        >
          {t(view.label)}
        </Link>
      ))}
    </nav>
  );
}
