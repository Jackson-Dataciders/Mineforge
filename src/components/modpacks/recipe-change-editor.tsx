"use client";

import { ArrowLeft, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { ItemIcon } from "@/components/items/item-icon";
import {
  InferredBadge,
  ItemSearchDialog,
} from "@/components/items/item-search-dialog";
import { RecipeEditor } from "@/components/recipes/recipe-editor";
import { recipeTypeKey } from "@/components/recipes/recipe-type-key";
import { RawRecipePreview } from "@/components/recipes/recipe-preview";
import type { ItemLookup } from "@/components/recipes/recipe-slot";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useApiFailure } from "@/components/ui/use-api-failure";
import type { SourcedRecipe } from "@/domain/item-sources";
import type { SearchItem, SearchSet } from "@/domain/item-search";
import {
  draftToRecipe,
  emptyDraft,
  JSON_RECIPE,
  parseVisualRecipe,
  rawRecipeToDraft,
  recipeToDraft,
  VISUAL_RECIPE_TYPES,
  type RecipeDraft,
  type VisualRecipeType,
} from "@/domain/recipe";
import type { RecipeChange, RecipeChangeEdit } from "@/domain/recipe-change";
import { useT } from "@/i18n/client";
import type { MessageKey } from "@/i18n/types";
import { fetchJson } from "@/lib/fetch-json";

type Plan =
  | { action: "add"; draft: RecipeDraft }
  | {
      action: "replace";
      replacedRecipeId: string;
      draft: RecipeDraft;
      /** The original couldn't be shown visually and opened as JSON. */
      fallback: boolean;
    }
  | { action: "remove"; removedRecipeId: string };

const NEW_RECIPE_TYPES: (VisualRecipeType | "json")[] = [
  ...VISUAL_RECIPE_TYPES,
  JSON_RECIPE,
];

type ChosenItem = Pick<SearchItem, "id" | "name" | "icon">;

function planOf(change: RecipeChange): Plan {
  switch (change.action) {
    case "add":
      return { action: "add", draft: recipeToDraft(change.recipe) };
    case "replace":
      return {
        action: "replace",
        replacedRecipeId: change.replacedRecipeId,
        draft: recipeToDraft(change.recipe),
        fallback: false,
      };
    case "remove":
      return { action: "remove", removedRecipeId: change.removedRecipeId };
  }
}

const DRAFT_ERRORS: Record<string, MessageKey> = {
  incomplete: "recipeChange.incomplete",
  invalidJson: "recipeChange.invalidJson",
  invalid: "recipeChange.invalid",
};

/**
 * Creates or edits one recipe change (spec 03): pick an item of the pack's
 * set, see the recipes that produce it, then replace or remove one or add a
 * new recipe in the visual (or JSON) editor.
 */
export function RecipeChangeEditor({
  packId,
  existing,
}: {
  packId: string;
  existing?: { change: RecipeChange; sha: string };
}) {
  const t = useT();
  const router = useRouter();
  const fail = useApiFailure();
  const typeSelectId = useId();
  const packHref = `/modpacks/${packId}`;

  const [set, setSet] = useState<SearchSet | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [item, setItem] = useState<ChosenItem | null>(
    existing
      ? { id: existing.change.item, name: existing.change.itemName, icon: null }
      : null,
  );
  const [recipes, setRecipes] = useState<SourcedRecipe[] | null>(null);
  const [plan, setPlan] = useState<Plan | null>(
    existing ? planOf(existing.change) : null,
  );
  const [newType, setNewType] = useState<VisualRecipeType | "json">(
    VISUAL_RECIPE_TYPES[0],
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  // The pack's item set, loaded once per page; retried with `attempt`.
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void fetchJson<SearchSet>(`/api/modpacks/${packId}/search-set`).then(
      (result) => {
        if (!active) return;
        if (result.ok) setSet(result.data);
        else setLoadError(true);
      },
    );
    return () => {
      active = false;
    };
  }, [packId, attempt]);
  const retryLoad = () => {
    setLoadError(false);
    setAttempt((n) => n + 1);
  };

  const byId = useMemo(
    () => new Map((set?.items ?? []).map((i) => [i.id, i])),
    [set],
  );
  const lookup: ItemLookup = useCallback((id) => byId.get(id), [byId]);
  const shownItem = item ? (byId.get(item.id) ?? item) : null;

  // The item whose recipes are being loaded; older responses are ignored.
  const latestItem = useRef<string | null>(null);

  async function chooseItem(chosen: SearchItem) {
    latestItem.current = chosen.id;
    setItem(chosen);
    setPlan(null);
    setRecipes(null);
    setError(undefined);
    const result = await fetchJson<SourcedRecipe[]>(
      `/api/modpacks/${packId}/recipes?item=${encodeURIComponent(chosen.id)}`,
    );
    if (latestItem.current !== chosen.id) return;
    if (result.ok) setRecipes(result.data);
    else fail(result.error);
  }

  function editBody(): RecipeChangeEdit | null {
    if (!plan || !item) return null;
    if (plan.action === "remove") {
      return { action: "remove", removedRecipeId: plan.removedRecipeId };
    }
    const built = draftToRecipe(plan.draft, item.id);
    if (!built.ok) {
      setError(t(DRAFT_ERRORS[built.error] ?? "recipeChange.invalid"));
      return null;
    }
    return plan.action === "add"
      ? { action: "add", recipe: built.recipe }
      : {
          action: "replace",
          replacedRecipeId: plan.replacedRecipeId,
          recipe: built.recipe,
        };
  }

  async function save() {
    setError(undefined);
    const change = editBody();
    if (!change || !item) return;
    setBusy(true);
    const result = existing
      ? await fetchJson(
          `/api/modpacks/${packId}/recipe-changes/${existing.change.id}`,
          { method: "PUT", body: { change, sha: existing.sha } },
        )
      : await fetchJson(`/api/modpacks/${packId}/recipe-changes`, {
          method: "POST",
          body: { item: item.id, change },
        });
    setBusy(false);
    if (result.ok) {
      router.push(packHref);
      router.refresh();
    } else {
      fail(result.error);
    }
  }

  async function remove() {
    if (!existing) return;
    setBusy(true);
    const result = await fetchJson(
      `/api/modpacks/${packId}/recipe-changes/${existing.change.id}`,
      { method: "DELETE", body: { sha: existing.sha } },
    );
    setBusy(false);
    setDeleteOpen(false);
    if (result.ok) {
      router.push(packHref);
      router.refresh();
    } else {
      fail(result.error);
    }
  }

  const summary =
    plan?.action === "add"
      ? t("recipeChange.adding")
      : plan?.action === "replace"
        ? t("recipeChange.replacing", { id: plan.replacedRecipeId })
        : plan?.action === "remove"
          ? t("recipeChange.removing", { id: plan.removedRecipeId })
          : null;

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <Link
        href={packHref}
        className="inline-flex min-h-11 w-fit items-center gap-2 rounded-md px-1 text-sm text-muted hover:text-text"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t("recipeChange.back")}
      </Link>
      <h1 className="text-xl font-semibold">
        {existing
          ? t("recipeChange.editTitle", { id: existing.change.id })
          : t("recipeChange.newTitle")}
      </h1>

      {!set && !loadError && (
        <p className="text-muted">{t("recipeChange.loadingItems")}</p>
      )}
      {loadError && (
        <div className="flex flex-col items-start gap-2">
          <p className="text-danger">{t("recipeChange.loadFailed")}</p>
          <Button onClick={retryLoad}>{t("actions.retry")}</Button>
        </div>
      )}

      {set && (
        <>
          {/* Item */}
          {shownItem ? (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface p-3">
              <ItemIcon icon={shownItem.icon} size={32} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">{shownItem.name}</span>
                <span className="font-mono text-xs break-all text-muted">
                  {shownItem.id}
                </span>
              </div>
              {!existing && (
                <Button onClick={() => setPickerOpen(true)}>
                  <Search className="size-4" aria-hidden />
                  {t("recipeChange.changeItem")}
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-start gap-2">
              <p className="text-muted">{t("recipeChange.pickItemHint")}</p>
              <Button variant="primary" onClick={() => setPickerOpen(true)}>
                <Search className="size-4" aria-hidden />
                {t("recipeChange.pickItem")}
              </Button>
            </div>
          )}

          {/* Choose what to do */}
          {item && !plan && !existing && (
            <section className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold">
                {t("recipeChange.existingTitle")}
              </h2>
              {recipes === null ? (
                <p className="text-muted">{t("recipeChange.loadingRecipes")}</p>
              ) : recipes.length === 0 ? (
                <p className="text-muted">{t("recipeChange.existingNone")}</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {recipes.map((recipe) => (
                    <li
                      key={recipe.id}
                      className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3"
                    >
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-mono text-sm break-all">
                          {recipe.id}
                        </span>
                        {recipe.source === "inferred" && <InferredBadge />}
                        <span className="text-xs text-muted">
                          {recipe.type} ·{" "}
                          {t("recipeChange.fromMod", { mod: recipe.modName })}
                        </span>
                      </div>
                      <RawRecipePreview data={recipe.data} lookup={lookup} />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={() =>
                            setPlan({
                              action: "replace",
                              replacedRecipeId: recipe.id,
                              draft: rawRecipeToDraft(recipe.data),
                              fallback:
                                parseVisualRecipe(recipe.data) === null &&
                                (
                                  VISUAL_RECIPE_TYPES as readonly string[]
                                ).includes(recipe.type),
                            })
                          }
                        >
                          {t("recipeChange.replace")}
                        </Button>
                        <Button
                          variant="danger"
                          onClick={() =>
                            setPlan({
                              action: "remove",
                              removedRecipeId: recipe.id,
                            })
                          }
                        >
                          {t("recipeChange.remove")}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex flex-wrap items-end gap-2">
                <div className="flex flex-col gap-1">
                  <label htmlFor={typeSelectId} className="text-sm font-medium">
                    {t("recipeChange.recipeType")}
                  </label>
                  <select
                    id={typeSelectId}
                    value={newType}
                    onChange={(e) =>
                      setNewType(e.target.value as VisualRecipeType | "json")
                    }
                    className="min-h-11 rounded-md border border-border bg-bg px-2 text-base text-text"
                  >
                    {NEW_RECIPE_TYPES.map((type: VisualRecipeType | "json") => (
                      <option key={type} value={type}>
                        {t(recipeTypeKey(type))}
                      </option>
                    ))}
                  </select>
                </div>
                <Button
                  variant="primary"
                  onClick={() =>
                    setPlan({ action: "add", draft: emptyDraft(newType) })
                  }
                >
                  <Plus className="size-4" aria-hidden />
                  {t("recipeChange.addNew")}
                </Button>
              </div>
            </section>
          )}

          {/* Edit */}
          {item && plan && (
            <section className="flex flex-col gap-4">
              <p className="font-medium break-all">{summary}</p>
              {plan.action === "remove" ? (
                <p className="text-muted">{t("recipeChange.removeHint")}</p>
              ) : (
                <>
                  {plan.action === "replace" && plan.fallback && (
                    <p className="text-muted">
                      {t("recipeChange.jsonFallback")}
                    </p>
                  )}
                  <RecipeEditor
                    draft={plan.draft}
                    onChange={(draft) => setPlan({ ...plan, draft })}
                    items={set.items}
                    tags={set.tags}
                    lookup={lookup}
                    resultItem={byId.get(item.id) ?? { ...item, icon: null }}
                  />
                </>
              )}
              {error && (
                <p role="alert" className="text-danger">
                  {error}
                </p>
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                <div className="flex flex-col-reverse gap-2 sm:flex-row">
                  {existing ? (
                    <Button
                      variant="danger"
                      onClick={() => setDeleteOpen(true)}
                    >
                      {t("recipeChange.delete")}
                    </Button>
                  ) : (
                    <Button onClick={() => setPlan(null)}>
                      {t("recipeChange.cancelEdit")}
                    </Button>
                  )}
                </div>
                <Button
                  variant="primary"
                  onClick={() => void save()}
                  disabled={busy}
                >
                  {t("recipeChange.save")}
                </Button>
              </div>
            </section>
          )}

          {pickerOpen && (
            <ItemSearchDialog
              open
              onClose={() => setPickerOpen(false)}
              title={t("itemSearch.title")}
              items={set.items}
              onSelect={(selection) => {
                if (selection.kind === "item") void chooseItem(selection.item);
              }}
            />
          )}
        </>
      )}

      {existing && deleteOpen && (
        <Dialog
          open
          onClose={() => setDeleteOpen(false)}
          title={t("recipeChange.deleteTitle")}
        >
          <div className="flex flex-col gap-4">
            <p>{t("recipeChange.deleteConfirm")}</p>
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
    </div>
  );
}
