"use client";

import { Circle, CircleCheck, CircleDot, type LucideIcon } from "lucide-react";
import type { EntryStatus } from "@/domain/entry";
import { useT } from "@/i18n/client";

const ICONS: Record<EntryStatus, { icon: LucideIcon; color: string }> = {
  backlog: { icon: Circle, color: "text-muted" },
  planned: { icon: CircleDot, color: "text-secondary" },
  implemented: { icon: CircleCheck, color: "text-ok" },
};

/**
 * An entry's status as a small icon (spec 05). By default it sits on its own
 * surface base, so it keeps its contrast on hovered or tinted rows
 * (ADR 0011). `inTint` drops the base for use inside the status's own tint;
 * `decorative` hides it from screen readers when the status text is shown
 * next to it.
 */
export function StatusIcon({
  status,
  inTint = false,
  decorative = false,
}: {
  status: EntryStatus;
  inTint?: boolean;
  decorative?: boolean;
}) {
  const t = useT();
  const { icon: Icon, color } = ICONS[status];
  const label = t(`statuses.${status}`);
  return (
    <span
      className={`inline-flex shrink-0 rounded-full ${inTint ? "" : "bg-surface"}`}
      {...(decorative
        ? { "aria-hidden": true }
        : { role: "img", "aria-label": label, title: label })}
    >
      <Icon className={`size-4 ${color}`} aria-hidden />
    </span>
  );
}
