"use client";

import { ArrowLeft, ImageOff, Paintbrush } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PixelEditor } from "@/components/pixel-editor/pixel-editor";
import {
  encodeIconPng,
  iconDataUrl,
  loadIcon,
} from "@/components/pixel-editor/icon-io";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TextField } from "@/components/ui/field";
import {
  FieldSection,
  SelectField,
  TextAreaField,
} from "@/components/ui/form-fields";
import { useToast } from "@/components/ui/toast";
import { useApiFailure } from "@/components/ui/use-api-failure";
import type { CustomRecipeType } from "@/domain/custom-recipe";
import {
  defaultEntry,
  ENTRY_STATUSES,
  entrySchema,
  isItemEntry,
  withEntryId,
  type Entry,
  type EntryType,
} from "@/domain/entry";
import { isEntryPath, suggestEntryPath } from "@/domain/entry-id";
import type { SearchSet } from "@/domain/item-search";
import type { PixelImage } from "@/domain/pixel-image";
import { useLocale, useT } from "@/i18n/client";
import { catalogs } from "@/i18n/locale";
import type { Messages } from "@/i18n/types";
import { fetchJson } from "@/lib/fetch-json";
import { DesignerProvider, type EntrySummary } from "./designer-context";
import { EntryRecipes } from "./entry-recipes";
import {
  BlockFields,
  EntityFields,
  ItemFields,
  MechanicFields,
  MultiblockFields,
  StructureFields,
  type ConfirmChange,
} from "./entry-sections";
import { ChipInput } from "./list-inputs";
import { RelationsEditor } from "./relations-editor";

type IconState =
  { state: "keep" } | { state: "set"; image: PixelImage } | { state: "remove" };

export type EntryEditorMode =
  | { kind: "new"; type: EntryType }
  | { kind: "edit"; entry: Entry; sha: string };

/** Field label for a validation issue path: the deepest segment with a label. */
function issueLabel(
  path: readonly PropertyKey[],
  fields: Messages["fields"],
): string {
  for (let i = path.length - 1; i >= 0; i--) {
    const key = path[i];
    if (typeof key === "string" && key in fields) {
      return fields[key as keyof Messages["fields"]];
    }
  }
  return fields.other;
}

/**
 * The entry form (spec 04): common fields, the fields of the current type
 * and kind, recipes (item and block), relations and the pixel-art icon.
 */
export function EntryEditor({
  modId,
  modName,
  mode,
  entries,
  recipeTypes,
  referencedBy,
}: {
  modId: string;
  modName: string;
  mode: EntryEditorMode;
  entries: EntrySummary[];
  recipeTypes: CustomRecipeType[];
  /** Entries that reference this one (edit mode, for the delete dialog). */
  referencedBy: EntrySummary[];
}) {
  const t = useT();
  const fields = catalogs[useLocale()].fields;
  const router = useRouter();
  const toast = useToast();
  const fail = useApiFailure();
  const isNew = mode.kind === "new";
  const modHref = `/designer/${modId}`;

  const [draft, setDraft] = useState<Entry>(() =>
    mode.kind === "edit"
      ? mode.entry
      : defaultEntry(mode.type, `${modId}:new_entry`, "New entry"),
  );
  const [path, setPath] = useState(() =>
    mode.kind === "edit" ? mode.entry.id.slice(modId.length + 1) : "",
  );
  const [pathEdited, setPathEdited] = useState(false);
  const [name, setName] = useState(mode.kind === "edit" ? mode.entry.name : "");
  const [icon, setIcon] = useState<IconState>({ state: "keep" });
  const [editingIcon, setEditingIcon] = useState<PixelImage | null | false>(
    false,
  );
  const [set, setSet] = useState<SearchSet | null>(null);
  const [confirmState, setConfirmState] = useState<{
    message: string;
    apply: () => void;
  } | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const effectivePath = isNew && !pathEdited ? suggestEntryPath(name) : path;
  const entryId = `${modId}:${effectivePath}`;
  const entry = useMemo(
    () => ({ ...withEntryId(draft, entryId), name }) as Entry,
    [draft, entryId, name],
  );

  useEffect(() => {
    let active = true;
    void fetchJson<SearchSet>(`/api/custom-mods/${modId}/search-set`).then(
      (result) => {
        if (active && result.ok) setSet(result.data);
      },
    );
    return () => {
      active = false;
    };
  }, [modId]);

  const byId = useMemo(
    () => new Map((set?.items ?? []).map((i) => [i.id, i])),
    [set],
  );
  // Once the set has loaded, unknown IDs are dangling references: mark them.
  const lookup = useCallback(
    (id: string) =>
      byId.get(id) ??
      // The entry itself (maybe not saved yet) is never missing.
      (id === entryId
        ? {
            id,
            name: name || id,
            icon: null,
            source: "entry" as const,
            modName,
          }
        : undefined) ??
      (set
        ? {
            id,
            name: t("designer.missing", { id }),
            icon: null,
            source: "entry" as const,
            modName: "",
            missing: true as const,
          }
        : undefined),
    [byId, set, t, entryId, name, modName],
  );
  const designer = useMemo(
    () => ({
      modId,
      items: set?.items ?? [],
      tags: set?.tags ?? [],
      lookup,
      entries,
      recipeTypes,
    }),
    [modId, set, lookup, entries, recipeTypes],
  );

  const confirm: ConfirmChange = (message, apply) => {
    if (message === null) apply();
    else setConfirmState({ message, apply });
  };
  const onChange = (next: Entry) => setDraft(next);
  const patch = (fieldsPatch: Partial<Entry>) =>
    setDraft((d) => ({ ...d, ...fieldsPatch }) as Entry);

  const storedIconUrl =
    mode.kind === "edit" && mode.entry.icon
      ? `/api/icons/${modId}/${effectivePath}.png?v=${mode.sha.slice(0, 8)}`
      : null;
  const previewUrl =
    icon.state === "set"
      ? iconDataUrl(icon.image)
      : icon.state === "keep"
        ? storedIconUrl
        : null;

  async function openIconEditor() {
    if (icon.state === "set") setEditingIcon(icon.image);
    else if (icon.state === "keep" && storedIconUrl) {
      setEditingIcon(await loadIcon(storedIconUrl).catch(() => null));
    } else setEditingIcon(null);
  }

  async function save() {
    setProblems([]);
    if (!isEntryPath(effectivePath)) {
      setProblems([t("designer.entry.pathLabel")]);
      return;
    }
    const parsed = entrySchema.safeParse(entry);
    if (!parsed.success) {
      setProblems([
        ...new Set(parsed.error.issues.map((i) => issueLabel(i.path, fields))),
      ]);
      return;
    }
    const iconBody =
      icon.state === "set"
        ? encodeIconPng(icon.image)
        : icon.state === "remove"
          ? null
          : undefined;
    setBusy(true);
    const result =
      mode.kind === "edit"
        ? await fetchJson(
            `/api/custom-mods/${modId}/entries/${effectivePath}`,
            {
              method: "PUT",
              body: { entry: parsed.data, sha: mode.sha, icon: iconBody },
            },
          )
        : await fetchJson(`/api/custom-mods/${modId}/entries`, {
            method: "POST",
            body: { entry: parsed.data, icon: iconBody },
          });
    setBusy(false);
    if (!result.ok) {
      if (result.error === "idTaken" || result.error === "invalidId") {
        setProblems([t("designer.entry.pathLabel")]);
      }
      fail(result.error);
      return;
    }
    toast(t("designer.entry.saved"));
    if (isNew) router.push(`/designer/${modId}/entries/${effectivePath}`);
    router.refresh();
  }

  async function remove() {
    if (mode.kind !== "edit") return;
    setBusy(true);
    const result = await fetchJson(
      `/api/custom-mods/${modId}/entries/${effectivePath}`,
      {
        method: "DELETE",
        body: { sha: mode.sha },
      },
    );
    setBusy(false);
    setDeleteOpen(false);
    if (result.ok) {
      router.push(modHref);
      router.refresh();
    } else fail(result.error);
  }

  const typeLabel = t(`entryTypes.${entry.type}`);

  return (
    <DesignerProvider value={designer}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="flex max-w-4xl flex-col gap-5"
      >
        <Link
          href={modHref}
          className="inline-flex min-h-11 w-fit items-center gap-2 rounded-md px-1 text-sm text-muted hover:text-text"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t("designer.back", { name: modName })}
        </Link>
        <h1 className="text-xl font-semibold">
          {isNew
            ? t("designer.entry.newTitle", { type: typeLabel })
            : entry.name}
        </h1>
        {!set && (
          <p className="text-sm text-muted">
            {t("designer.entry.loadingItems")}
          </p>
        )}

        <FieldSection title={t("designer.entry.sections.general")}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex flex-col items-center gap-2">
              <span className="flex size-24 items-center justify-center rounded-md border border-border bg-slot">
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl}
                    alt={t("fields.icon")}
                    width={64}
                    height={64}
                    className="size-16 [image-rendering:pixelated]"
                  />
                ) : (
                  <span className="text-xs text-muted">
                    {t("pixel.noIcon")}
                  </span>
                )}
              </span>
              <Button onClick={() => void openIconEditor()}>
                <Paintbrush className="size-4" aria-hidden />
                {t("pixel.edit")}
              </Button>
              {previewUrl && (
                <Button
                  variant="ghost"
                  onClick={() => setIcon({ state: "remove" })}
                >
                  <ImageOff className="size-4" aria-hidden />
                  {t("pixel.remove")}
                </Button>
              )}
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-4">
              <TextField
                label={t("fields.name")}
                value={name}
                required
                maxLength={100}
                onChange={(e) => setName(e.target.value)}
              />
              <TextField
                label={t("designer.entry.pathLabel")}
                hint={isNew ? t("designer.entry.pathHint") : undefined}
                value={isNew ? effectivePath : entryId}
                readOnly={!isNew}
                onChange={(e) => {
                  setPathEdited(true);
                  setPath(e.target.value);
                }}
                autoCapitalize="off"
                spellCheck={false}
                inputClassName="font-mono"
              />
              <SelectField
                label={t("fields.status")}
                value={entry.status}
                options={ENTRY_STATUSES.map((value) => ({
                  value,
                  label: t(`statuses.${value}`),
                }))}
                onChange={(status) => patch({ status })}
                className="sm:max-w-xs"
              />
              <ChipInput
                label={t("fields.tags")}
                values={entry.tags}
                onChange={(tags) => patch({ tags })}
                max={20}
              />
              <TextAreaField
                label={t("fields.description")}
                value={entry.description}
                onChange={(description) => patch({ description })}
              />
            </div>
          </div>
        </FieldSection>

        <FieldSection title={t("designer.entry.sections.properties")}>
          {entry.type === "item" && (
            <ItemFields entry={entry} onChange={onChange} confirm={confirm} />
          )}
          {entry.type === "block" && (
            <BlockFields entry={entry} onChange={onChange} confirm={confirm} />
          )}
          {entry.type === "entity" && (
            <EntityFields entry={entry} onChange={onChange} confirm={confirm} />
          )}
          {entry.type === "structure" && (
            <StructureFields
              entry={entry}
              onChange={onChange}
              confirm={confirm}
            />
          )}
          {entry.type === "mechanic" && (
            <MechanicFields
              entry={entry}
              onChange={onChange}
              confirm={confirm}
            />
          )}
          {entry.type === "multiblock" && (
            <MultiblockFields
              entry={entry}
              onChange={onChange}
              confirm={confirm}
            />
          )}
        </FieldSection>

        {isItemEntry(entry) && (
          <FieldSection title={t("designer.entry.sections.recipes")}>
            <EntryRecipes
              entryId={entry.id}
              entryName={entry.name}
              recipes={entry.recipes}
              onChange={(recipes) => patch({ recipes } as Partial<Entry>)}
            />
          </FieldSection>
        )}

        <FieldSection title={t("designer.entry.sections.relations")}>
          <RelationsEditor
            entryId={entry.id}
            relations={entry.relations}
            onChange={(relations) => patch({ relations })}
          />
        </FieldSection>

        <FieldSection title={t("designer.entry.sections.notes")}>
          <TextAreaField
            label={t("fields.usage")}
            value={entry.usage}
            onChange={(usage) => patch({ usage })}
          />
          <TextAreaField
            label={t("fields.notes")}
            value={entry.notes}
            rows={5}
            onChange={(notes) => patch({ notes })}
          />
        </FieldSection>

        {problems.length > 0 && (
          <div
            role="alert"
            className="rounded-lg border border-danger bg-surface p-3"
          >
            <p className="font-medium text-danger">
              {t("designer.entry.problems")}
            </p>
            <ul className="mt-1 list-disc pl-6 text-sm">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <div>
            {!isNew && (
              <Button variant="danger" onClick={() => setDeleteOpen(true)}>
                {t("designer.entry.delete")}
              </Button>
            )}
          </div>
          <Button
            type="submit"
            variant="primary"
            disabled={busy || !name.trim()}
          >
            {t("designer.entry.save")}
          </Button>
        </div>
      </form>

      {editingIcon !== false && (
        <Dialog
          open
          onClose={() => setEditingIcon(false)}
          title={t("pixel.title")}
        >
          <PixelEditor
            initial={editingIcon}
            onCancel={() => setEditingIcon(false)}
            onDone={(image) => {
              setIcon({ state: "set", image });
              setEditingIcon(false);
            }}
          />
        </Dialog>
      )}

      {confirmState && (
        <Dialog
          open
          onClose={() => setConfirmState(null)}
          title={t("designer.entry.confirmTitle")}
        >
          <div className="flex flex-col gap-4">
            <p>{confirmState.message}</p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button onClick={() => setConfirmState(null)}>
                {t("actions.cancel")}
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  confirmState.apply();
                  setConfirmState(null);
                }}
              >
                {t("designer.entry.continue")}
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {deleteOpen && (
        <Dialog
          open
          onClose={() => setDeleteOpen(false)}
          title={t("designer.entry.deleteTitle")}
        >
          <div className="flex flex-col gap-4">
            <p>{t("designer.entry.deleteConfirm", { name: entry.name })}</p>
            {referencedBy.length > 0 && (
              <div>
                <p className="text-sm">
                  {t("designer.entry.deleteReferences")}
                </p>
                <ul className="mt-1 list-disc pl-6 text-sm">
                  {referencedBy.map((e) => (
                    <li key={e.id}>
                      {e.name}{" "}
                      <span className="font-mono text-xs text-muted">
                        {e.id}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button onClick={() => setDeleteOpen(false)}>
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
    </DesignerProvider>
  );
}
