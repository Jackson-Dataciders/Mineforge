"use client";

import { Pencil, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  CompatBadge,
  type Incompatibility,
} from "@/components/library/compat-badge";
import { Button, IconButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TextField } from "@/components/ui/field";
import { CheckboxField, SelectField } from "@/components/ui/form-fields";
import { apiErrorKey, useApiFailure } from "@/components/ui/use-api-failure";
import {
  customRecipeTypeSchema,
  INPUT_SLOT_TYPES,
  MAX_SLOTS,
  OUTPUT_SLOT_TYPES,
  RECIPE_TYPE_ID_PATTERN,
  type CustomRecipeType,
  type InputSlotType,
  type OutputSlotType,
} from "@/domain/custom-recipe";
import { suggestEntryPath } from "@/domain/entry-id";
import { useT } from "@/i18n/client";
import { fetchJson } from "@/lib/fetch-json";
import type { EntrySummary } from "./designer-context";

export type LibraryOption = {
  id: string;
  name: string;
  incompatibility: Incompatibility | null;
};

/** The custom mod's declared library dependencies, with an edit dialog. */
export function ModDependencies({
  modId,
  sha,
  dependencies,
  library,
}: {
  modId: string;
  sha: string;
  dependencies: string[];
  library: LibraryOption[];
}) {
  const t = useT();
  const router = useRouter();
  const fail = useApiFailure();
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const nameOf = (id: string) => library.find((m) => m.id === id)?.name ?? id;

  async function save() {
    setBusy(true);
    const result = await fetchJson(`/api/custom-mods/${modId}/dependencies`, {
      method: "PUT",
      body: { dependencies: [...chosen], sha },
    });
    setBusy(false);
    setOpen(false);
    if (result.ok) router.refresh();
    else fail(result.error);
  }

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">
          {t("designer.dependencies.title")}
        </h2>
        <Button
          onClick={() => {
            setChosen(
              new Set(
                dependencies.filter((id) => library.some((m) => m.id === id)),
              ),
            );
            setOpen(true);
          }}
        >
          {t("designer.dependencies.edit")}
        </Button>
      </div>
      <p className="text-sm text-muted">{t("designer.dependencies.hint")}</p>
      {dependencies.length === 0 ? (
        <p className="text-sm text-muted">{t("designer.dependencies.none")}</p>
      ) : (
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {dependencies.map((id) => (
            <li key={id} className="text-sm">
              {nameOf(id)}{" "}
              <span className="font-mono text-xs text-muted">{id}</span>
            </li>
          ))}
        </ul>
      )}
      {open && (
        <Dialog
          open
          onClose={() => setOpen(false)}
          title={t("designer.dependencies.title")}
        >
          <div className="flex flex-col gap-3">
            {library.length === 0 && (
              <p className="text-sm text-muted">
                {t("designer.dependencies.empty")}
              </p>
            )}
            {library.map((mod) => (
              <label
                key={mod.id}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-1 hover:bg-accent/13"
              >
                <input
                  type="checkbox"
                  checked={chosen.has(mod.id)}
                  onChange={(e) => {
                    const next = new Set(chosen);
                    if (e.target.checked) next.add(mod.id);
                    else next.delete(mod.id);
                    setChosen(next);
                  }}
                  className="size-5 accent-accent"
                />
                <span className="flex flex-wrap items-center gap-x-2">
                  <span>{mod.name}</span>
                  <span className="font-mono text-xs text-muted">{mod.id}</span>
                  {mod.incompatibility && (
                    <CompatBadge info={mod.incompatibility} />
                  )}
                </span>
              </label>
            ))}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button onClick={() => setOpen(false)}>
                {t("actions.cancel")}
              </Button>
              <Button
                variant="primary"
                onClick={() => void save()}
                disabled={busy}
              >
                {t("actions.save")}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </section>
  );
}

type TypeDraft = {
  id: string;
  name: string;
  machine: string;
  inputs: { type: InputSlotType }[];
  outputs: { type: OutputSlotType; chance: boolean }[];
  parameters: { processingTime: boolean; energyCost: boolean };
};

/** Custom machine recipe types of the mod: list, create, edit, delete. */
export function RecipeTypesSection({
  modId,
  sha,
  recipeTypes,
  machines,
  usersByType,
}: {
  modId: string;
  sha: string;
  recipeTypes: CustomRecipeType[];
  /** Block and multiblock entries of the mod. */
  machines: EntrySummary[];
  usersByType: Record<string, EntrySummary[]>;
}) {
  const t = useT();
  const router = useRouter();
  const fail = useApiFailure();
  const [editing, setEditing] = useState<{
    isNew: boolean;
    draft: TypeDraft;
  } | null>(null);
  const [deleting, setDeleting] = useState<CustomRecipeType | null>(null);
  const [idEdited, setIdEdited] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const machineName = (id: string) =>
    machines.find((m) => m.id === id)?.name ?? t("designer.missing", { id });

  const startNew = () => {
    setError(undefined);
    setIdEdited(false);
    setEditing({
      isNew: true,
      draft: {
        id: "",
        name: "",
        machine: machines[0]?.id ?? "",
        inputs: [{ type: "item" }],
        outputs: [{ type: "item", chance: false }],
        parameters: { processingTime: true, energyCost: false },
      },
    });
  };

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    const draft = {
      ...editing.draft,
      id:
        editing.isNew && !idEdited
          ? suggestEntryPath(editing.draft.name)
          : editing.draft.id,
    };
    const parsed = customRecipeTypeSchema.safeParse(draft);
    if (!parsed.success || !RECIPE_TYPE_ID_PATTERN.test(draft.id)) {
      setError(t("errors.invalidInput"));
      return;
    }
    setBusy(true);
    const result = editing.isNew
      ? await fetchJson(`/api/custom-mods/${modId}/recipe-types`, {
          method: "POST",
          body: { type: parsed.data, sha },
        })
      : await fetchJson(`/api/custom-mods/${modId}/recipe-types/${draft.id}`, {
          method: "PUT",
          body: { type: parsed.data, sha },
        });
    setBusy(false);
    if (result.ok) {
      setEditing(null);
      router.refresh();
    } else if (["conflict", "notFound"].includes(result.error)) {
      setEditing(null);
      fail(result.error);
    } else {
      // Keep the draft: the user can fix the ID or machine and retry.
      setError(t(apiErrorKey(result.error)));
    }
  }

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    const result = await fetchJson(
      `/api/custom-mods/${modId}/recipe-types/${deleting.id}`,
      {
        method: "DELETE",
        body: { sha },
      },
    );
    setBusy(false);
    setDeleting(null);
    if (result.ok) router.refresh();
    else fail(result.error);
  }

  const draft = editing?.draft;
  const setDraft = (patch: Partial<TypeDraft>) =>
    editing &&
    setEditing({ ...editing, draft: { ...editing.draft, ...patch } });
  const shownId =
    draft && editing?.isNew && !idEdited
      ? suggestEntryPath(draft.name)
      : draft?.id;

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">
          {t("designer.recipeTypes.title")}
        </h2>
        <Button onClick={startNew} disabled={machines.length === 0}>
          <Plus className="size-4" aria-hidden />
          {t("designer.recipeTypes.add")}
        </Button>
      </div>
      <p className="text-sm text-muted">
        {machines.length === 0
          ? t("designer.recipeTypes.noMachine")
          : t("designer.recipeTypes.hint")}
      </p>
      {recipeTypes.length === 0 ? (
        <p className="text-sm text-muted">{t("designer.recipeTypes.none")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {recipeTypes.map((type) => (
            <li key={type.id} className="flex items-center gap-2 py-2">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">
                  {type.name}{" "}
                  <span className="font-mono text-xs text-muted">
                    {type.id}
                  </span>
                </span>
                <span className="text-xs text-muted">
                  {t("designer.recipeTypes.summary", {
                    inputs: type.inputs.length,
                    outputs: type.outputs.length,
                    machine: machineName(type.machine),
                  })}
                </span>
              </span>
              <IconButton
                label={t("designer.recipeTypes.editTitle", { name: type.name })}
                onClick={() => {
                  setError(undefined);
                  setEditing({ isNew: false, draft: structuredClone(type) });
                }}
              >
                <Pencil className="size-4" aria-hidden />
              </IconButton>
              <IconButton
                label={t("designer.recipeTypes.delete")}
                onClick={() => setDeleting(type)}
              >
                <Trash2 className="size-4" aria-hidden />
              </IconButton>
            </li>
          ))}
        </ul>
      )}

      {editing && draft && (
        <Dialog
          open
          onClose={() => setEditing(null)}
          title={
            editing.isNew
              ? t("designer.recipeTypes.newTitle")
              : t("designer.recipeTypes.editTitle", { name: draft.name })
          }
        >
          <form onSubmit={save} className="flex flex-col gap-4">
            <TextField
              label={t("designer.recipeTypes.name")}
              value={draft.name}
              required
              maxLength={100}
              onChange={(e) => setDraft({ name: e.target.value })}
            />
            <TextField
              label={t("designer.recipeTypes.id")}
              hint={
                editing.isNew ? t("designer.recipeTypes.idHint") : undefined
              }
              value={shownId ?? ""}
              readOnly={!editing.isNew}
              onChange={(e) => {
                setIdEdited(true);
                setDraft({ id: e.target.value });
              }}
              autoCapitalize="off"
              spellCheck={false}
              inputClassName="font-mono"
            />
            <SelectField
              label={t("designer.recipeTypes.machine")}
              value={draft.machine}
              options={[
                ...(machines.some((m) => m.id === draft.machine)
                  ? []
                  : [
                      {
                        value: draft.machine,
                        label: t("designer.missing", { id: draft.machine }),
                      },
                    ]),
                ...machines.map((m) => ({
                  value: m.id,
                  label: `${m.name} (${m.id})`,
                })),
              ]}
              onChange={(machine) => setDraft({ machine })}
            />
            <SlotList
              legend={t("designer.recipeTypes.inputs")}
              slots={draft.inputs}
              types={INPUT_SLOT_TYPES}
              onChange={(inputs) =>
                setDraft({ inputs: inputs as TypeDraft["inputs"] })
              }
              newSlot={{ type: "item" }}
            />
            <SlotList
              legend={t("designer.recipeTypes.outputs")}
              slots={draft.outputs}
              types={OUTPUT_SLOT_TYPES}
              withChance
              onChange={(outputs) =>
                setDraft({ outputs: outputs as TypeDraft["outputs"] })
              }
              newSlot={{ type: "item", chance: false }}
            />
            <fieldset className="flex flex-col gap-1">
              <legend className="mb-1 text-sm font-medium">
                {t("designer.recipeTypes.parameters")}
              </legend>
              <CheckboxField
                label={t("designer.recipeTypes.processingTime")}
                checked={draft.parameters.processingTime}
                onChange={(processingTime) =>
                  setDraft({
                    parameters: { ...draft.parameters, processingTime },
                  })
                }
              />
              <CheckboxField
                label={t("designer.recipeTypes.energyCost")}
                checked={draft.parameters.energyCost}
                onChange={(energyCost) =>
                  setDraft({ parameters: { ...draft.parameters, energyCost } })
                }
              />
            </fieldset>
            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button onClick={() => setEditing(null)}>
                {t("actions.cancel")}
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={busy || !draft.name.trim()}
              >
                {t("actions.save")}
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {deleting && (
        <Dialog
          open
          onClose={() => setDeleting(null)}
          title={t("designer.recipeTypes.deleteTitle")}
        >
          <div className="flex flex-col gap-4">
            <p>
              {t("designer.recipeTypes.deleteConfirm", { name: deleting.name })}
            </p>
            {(usersByType[deleting.id]?.length ?? 0) > 0 && (
              <div>
                <p className="text-sm">
                  {t("designer.recipeTypes.deleteUsers")}
                </p>
                <ul className="mt-1 list-disc pl-6 text-sm">
                  {usersByType[deleting.id]!.map((e) => (
                    <li key={e.id}>{e.name}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button onClick={() => setDeleting(null)}>
                {t("actions.cancel")}
              </Button>
              <Button
                variant="danger"
                onClick={() => void remove()}
                disabled={busy}
              >
                {t("actions.delete")}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </section>
  );
}

function SlotList<S extends { type: string; chance?: boolean }>({
  legend,
  slots,
  types,
  withChance = false,
  onChange,
  newSlot,
}: {
  legend: string;
  slots: S[];
  types: readonly string[];
  withChance?: boolean;
  onChange: (slots: S[]) => void;
  newSlot: S;
}) {
  const t = useT();
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      {slots.map((slot, i) => (
        <div key={i} className="flex flex-wrap items-end gap-2">
          <SelectField
            label={t("designer.recipeTypes.slot", { n: i + 1 })}
            value={slot.type}
            options={types.map((value) => ({
              value,
              label: t(`enums.slotType.${value as InputSlotType}`),
            }))}
            onChange={(type) =>
              onChange(slots.map((s, j) => (j === i ? { ...s, type } : s)))
            }
            className="min-w-0 flex-1 basis-32"
          />
          {withChance && (
            <CheckboxField
              label={t("designer.recipeTypes.chance")}
              checked={!!slot.chance}
              onChange={(chance) =>
                onChange(slots.map((s, j) => (j === i ? { ...s, chance } : s)))
              }
            />
          )}
          <IconButton
            label={t("designer.recipeTypes.removeSlot", { n: i + 1 })}
            onClick={() => onChange(slots.filter((_, j) => j !== i))}
            disabled={slots.length <= 1}
          >
            <X className="size-4" aria-hidden />
          </IconButton>
        </div>
      ))}
      <div>
        <Button
          onClick={() => onChange([...slots, newSlot])}
          disabled={slots.length >= MAX_SLOTS}
        >
          <Plus className="size-4" aria-hidden />
          {t("designer.recipeTypes.addSlot")}
        </Button>
      </div>
    </fieldset>
  );
}
