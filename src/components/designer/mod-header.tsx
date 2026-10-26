"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/form-fields";
import { useApiFailure } from "@/components/ui/use-api-failure";
import { projectPhaseSchema, type ProjectPhase } from "@/domain/custom-mod";
import { useT } from "@/i18n/client";
import { fetchJson } from "@/lib/fetch-json";

/**
 * Header of a custom mod's pages: name, ID, the current phase (spec 05) and
 * the Entries | Taskboard | Mind map tabs. A phase change reloads the page
 * data, so every form on the page gets the new `mod.json` SHA.
 */
export function ModHeader({
  modId,
  name,
  phase,
  sha,
}: {
  modId: string;
  name: string;
  phase: ProjectPhase;
  sha: string;
}) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const fail = useApiFailure();
  const [value, setValue] = useState(phase);
  const [busy, setBusy] = useState(false);

  // Applied with a button, not on change: keyboard browsing of a select
  // fires a change per key, and a phase change prunes task state.
  async function apply() {
    if (busy || value === phase) return;
    setBusy(true);
    const result = await fetchJson(`/api/custom-mods/${modId}/phase`, {
      method: "PUT",
      body: { phase: value, sha },
    });
    setBusy(false);
    if (result.ok) {
      router.refresh();
    } else {
      setValue(phase);
      fail(result.error);
    }
  }

  const tabs = [
    { href: `/designer/${modId}`, label: t("designer.tabs.entries") },
    { href: `/designer/${modId}/tasks`, label: t("designer.tabs.tasks") },
    { href: `/designer/${modId}/map`, label: t("designer.tabs.map") },
  ];

  return (
    <header className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">{name}</h1>
          <p className="font-mono text-sm text-muted">
            {t("projects.idValue", { id: modId })}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <SelectField
            label={t("designer.phase.label")}
            value={value}
            options={projectPhaseSchema.options.map((p) => ({
              value: p,
              label: t(`phases.${p}`),
            }))}
            onChange={setValue}
            disabled={busy}
            className="w-48"
          />
          {value !== phase && (
            <div className="flex gap-2">
              <Button
                variant="primary"
                onClick={() => void apply()}
                disabled={busy}
              >
                {t("designer.phase.apply")}
              </Button>
              <Button onClick={() => setValue(phase)} disabled={busy}>
                {t("actions.cancel")}
              </Button>
            </div>
          )}
        </div>
      </div>
      <nav aria-label={t("designer.tabs.label")}>
        <ul className="flex gap-1 border-b border-border">
          {tabs.map((tab) => {
            const active = pathname === tab.href;
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={`-mb-px inline-flex min-h-11 items-center border-b-2 px-3 text-sm font-medium ${
                    active
                      ? "border-accent text-text"
                      : "border-transparent text-muted hover:text-text"
                  }`}
                >
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
