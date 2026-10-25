"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  CompatBadge,
  type Incompatibility,
} from "@/components/library/compat-badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useApiFailure } from "@/components/ui/use-api-failure";
import { useT } from "@/i18n/client";
import { fetchJson } from "@/lib/fetch-json";

export type ModOption = {
  id: string;
  name: string;
  incompatibility?: Incompatibility | null;
};

/** The pack's mods, with a dialog to add and remove library and custom mods. */
export function PackMods({
  packId,
  sha,
  libraryMods,
  customMods,
  libraryModIds,
  customModIds,
}: {
  packId: string;
  sha: string;
  libraryMods: ModOption[];
  customMods: ModOption[];
  libraryModIds: string[];
  customModIds: string[];
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const chosenLibrary = libraryMods.filter((m) => libraryModIds.includes(m.id));
  const chosenCustom = customMods.filter((m) => customModIds.includes(m.id));
  // IDs in pack.json without a library mod (e.g. deleted from the library).
  const unknownLibrary = libraryModIds.filter(
    (id) => !libraryMods.some((m) => m.id === id),
  );

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{t("modpack.modsTitle")}</h2>
        <Button onClick={() => setOpen(true)}>{t("modpack.editMods")}</Button>
      </div>
      {chosenLibrary.length + chosenCustom.length + unknownLibrary.length ===
      0 ? (
        <p className="text-muted">{t("modpack.noMods")}</p>
      ) : (
        <div className="grid gap-3 rounded-lg border border-border bg-surface p-3 sm:grid-cols-2">
          <ModList
            title={t("modpack.libraryMods")}
            mods={chosenLibrary}
            extra={unknownLibrary}
          />
          <ModList title={t("modpack.customMods")} mods={chosenCustom} />
        </div>
      )}
      {open && (
        <EditModsDialog
          packId={packId}
          sha={sha}
          libraryMods={libraryMods}
          customMods={customMods}
          initialLibrary={libraryModIds}
          initialCustom={customModIds}
          onClose={() => setOpen(false)}
        />
      )}
    </section>
  );
}

function ModList({
  title,
  mods,
  extra = [],
}: {
  title: string;
  mods: ModOption[];
  extra?: string[];
}) {
  if (mods.length === 0 && extra.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-sm font-medium text-muted">{title}</h3>
      <ul className="flex flex-col gap-1">
        {mods.map((mod) => (
          <li key={mod.id} className="flex flex-wrap items-center gap-2">
            <span>{mod.name}</span>
            <span className="font-mono text-xs text-muted">{mod.id}</span>
            {mod.incompatibility && <CompatBadge info={mod.incompatibility} />}
          </li>
        ))}
        {extra.map((id) => (
          <li key={id} className="font-mono text-sm text-muted">
            {id}
          </li>
        ))}
      </ul>
    </div>
  );
}

function EditModsDialog({
  packId,
  sha,
  libraryMods,
  customMods,
  initialLibrary,
  initialCustom,
  onClose,
}: {
  packId: string;
  sha: string;
  libraryMods: ModOption[];
  customMods: ModOption[];
  initialLibrary: string[];
  initialCustom: string[];
  onClose: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const fail = useApiFailure();
  // Unknown IDs are dropped on save; the server rejects them anyway.
  const [library, setLibrary] = useState(
    () =>
      new Set(
        initialLibrary.filter((id) => libraryMods.some((m) => m.id === id)),
      ),
  );
  const [custom, setCustom] = useState(() => new Set(initialCustom));
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const result = await fetchJson(`/api/modpacks/${packId}/mods`, {
      method: "PUT",
      body: {
        libraryModIds: [...library],
        customModIds: [...custom],
        sha,
      },
    });
    setBusy(false);
    if (result.ok) {
      onClose();
      router.refresh();
    } else {
      fail(result.error);
      onClose();
    }
  }

  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };

  return (
    <Dialog open onClose={onClose} title={t("modpack.editModsTitle")}>
      <div className="flex flex-col gap-4">
        <CheckboxGroup
          legend={t("modpack.libraryMods")}
          empty={t("modpack.noLibraryMods")}
          options={libraryMods}
          checked={library}
          onToggle={(id) => setLibrary((s) => toggle(s, id))}
        />
        <CheckboxGroup
          legend={t("modpack.customMods")}
          empty={t("modpack.noCustomMods")}
          options={customMods}
          checked={custom}
          onToggle={(id) => setCustom((s) => toggle(s, id))}
        />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>{t("actions.cancel")}</Button>
          <Button variant="primary" onClick={() => void save()} disabled={busy}>
            {t("actions.save")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

function CheckboxGroup({
  legend,
  empty,
  options,
  checked,
  onToggle,
}: {
  legend: string;
  empty: string;
  options: ModOption[];
  checked: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      {options.length === 0 && <p className="text-sm text-muted">{empty}</p>}
      {options.map((option) => (
        <label
          key={option.id}
          className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-1 hover:bg-accent/13"
        >
          <input
            type="checkbox"
            checked={checked.has(option.id)}
            onChange={() => onToggle(option.id)}
            className="size-5 accent-accent"
          />
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2">
            <span>{option.name}</span>
            <span className="font-mono text-xs text-muted">{option.id}</span>
            {option.incompatibility && (
              <CompatBadge info={option.incompatibility} />
            )}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
