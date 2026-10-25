"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/client";
import { useProjectActions } from "./project-actions";
import { VIEW_CONFIG, type ViewId } from "./types";

/** Shown when a view has no projects yet. */
export function EmptyProjectState({ view }: { view: ViewId }) {
  const t = useT();
  const { openCreate } = useProjectActions();
  const messages = VIEW_CONFIG[view].messages;
  return (
    <div className="mx-auto mt-12 flex max-w-sm flex-col items-center gap-3 text-center">
      <h1 className="text-lg font-semibold">{t(`${messages}.emptyTitle`)}</h1>
      <p className="text-muted">{t(`${messages}.emptyText`)}</p>
      <Button variant="primary" onClick={openCreate}>
        <Plus className="size-5" aria-hidden />
        {t(`${messages}.create`)}
      </Button>
    </div>
  );
}
