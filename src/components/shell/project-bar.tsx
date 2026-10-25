"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId } from "react";
import { IconButton } from "@/components/ui/button";
import { useT } from "@/i18n/client";
import {
  VIEW_CONFIG,
  type ModpackSummary,
  type ProjectSummary,
  type ViewId,
} from "./types";

/** Selector for the current custom mod or modpack, with create, rename and delete. */
export function ProjectBar({
  view,
  projects,
  selectedId,
  onCreate,
  onRename,
  onDelete,
}: {
  view: ViewId;
  projects: (ProjectSummary | ModpackSummary)[];
  selectedId: string | null;
  onCreate: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const config = VIEW_CONFIG[view];
  const t = useT();
  const router = useRouter();
  const selectId = useId();
  const selected = projects.find((p) => p.id === selectedId);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1">
      <label htmlFor={selectId} className="sr-only">
        {t(`${config.messages}.selectorLabel`)}
      </label>
      <select
        id={selectId}
        value={selected?.id ?? ""}
        onChange={(e) => router.push(`${config.basePath}/${e.target.value}`)}
        disabled={projects.length === 0}
        className="min-h-11 min-w-0 flex-1 rounded-md border border-border bg-bg px-2 text-base text-text sm:max-w-xs"
      >
        {projects.length === 0 && (
          <option value="">{t(`${config.messages}.none`)}</option>
        )}
        {!selected && projects.length > 0 && <option value="" disabled />}
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <IconButton label={t(`${config.messages}.create`)} onClick={onCreate}>
        <Plus className="size-5" aria-hidden />
      </IconButton>
      <IconButton
        label={t("projects.rename")}
        onClick={onRename}
        disabled={!selected}
      >
        <Pencil className="size-5" aria-hidden />
      </IconButton>
      <IconButton
        label={t("projects.delete")}
        onClick={onDelete}
        disabled={!selected}
      >
        <Trash2 className="size-5" aria-hidden />
      </IconButton>
    </div>
  );
}
