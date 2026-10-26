"use client";

import { Plus, X } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { ItemIcon } from "@/components/items/item-icon";
import { ItemSearchDialog } from "@/components/items/item-search-dialog";
import { Button, IconButton } from "@/components/ui/button";
import { NumberField } from "@/components/ui/form-fields";
import type { ItemStack } from "@/domain/entry";
import { resourceIdSchema } from "@/domain/library";
import { useT } from "@/i18n/client";
import { useDesigner } from "./designer-context";
import { StatusIcon } from "./status-icon";

function Chip({ text, onRemove }: { text: string; onRemove: () => void }) {
  const t = useT();
  return (
    <li className="flex items-center gap-1 rounded-full border border-border bg-bg py-0.5 pr-0.5 pl-3 text-sm">
      <span className="break-all">{text}</span>
      <IconButton label={t("lists.remove", { name: text })} onClick={onRemove}>
        <X className="size-4" aria-hidden />
      </IconButton>
    </li>
  );
}

/**
 * Free-text chips: category tags, or namespaced IDs (`ids`) such as biomes,
 * dimensions and mobs, which are validated before adding.
 */
export function ChipInput({
  label,
  values,
  onChange,
  ids = false,
  max = 50,
}: {
  label: string;
  values: readonly string[];
  onChange: (values: string[]) => void;
  ids?: boolean;
  max?: number;
}) {
  const t = useT();
  const inputId = useId();
  const [text, setText] = useState("");
  const [error, setError] = useState<string>();

  function add(event: FormEvent) {
    event.preventDefault();
    const value = ids ? text.trim().toLowerCase() : text.trim();
    if (!value) return;
    if (ids && !resourceIdSchema.safeParse(value).success) {
      setError(t("lists.invalidId"));
      return;
    }
    if (!values.includes(value) && values.length < max)
      onChange([...values, value]);
    setText("");
    setError(undefined);
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-medium">
        {label}
      </label>
      {values.length > 0 && (
        <ul className="flex flex-wrap gap-1">
          {values.map((value) => (
            <Chip
              key={value}
              text={value}
              onRemove={() => onChange(values.filter((v) => v !== value))}
            />
          ))}
        </ul>
      )}
      {/* A div, not a form: the entry form is already a form. */}
      <div className="flex gap-2">
        <input
          id={inputId}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add(e);
          }}
          placeholder={ids ? t("lists.idPlaceholder") : undefined}
          autoCapitalize="off"
          spellCheck={!ids}
          aria-invalid={error ? true : undefined}
          className="min-h-11 min-w-0 flex-1 rounded-md border border-border bg-bg px-3 text-base text-text"
        />
        <Button onClick={add} disabled={!text.trim()}>
          <Plus className="size-4" aria-hidden />
          {t("lists.add")}
        </Button>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}

/** The status icon of an item that is an entry of this mod. */
function EntryStatus({ id }: { id: string }) {
  const status = useDesigner().lookup(id)?.status;
  return status ? <StatusIcon status={status} /> : null;
}

/** Item IDs picked with the item search (key blocks). */
export function ItemIdList({
  label,
  values,
  onChange,
}: {
  label: string;
  values: readonly string[];
  onChange: (values: string[]) => void;
}) {
  const t = useT();
  const { items, lookup } = useDesigner();
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>
      {values.length > 0 && (
        <ul className="flex flex-col gap-1">
          {values.map((id) => (
            <li key={id} className="flex items-center gap-2">
              <ItemIcon icon={lookup(id)?.icon} size={24} />
              <EntryStatus id={id} />
              <span className="min-w-0 flex-1 text-sm">
                {lookup(id)?.name ?? id}{" "}
                <span className="font-mono text-xs text-muted">{id}</span>
              </span>
              <IconButton
                label={t("lists.remove", { name: lookup(id)?.name ?? id })}
                onClick={() => onChange(values.filter((v) => v !== id))}
              >
                <X className="size-4" aria-hidden />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
      <div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4" aria-hidden />
          {t("lists.pickItem")}
        </Button>
      </div>
      {open && (
        <ItemSearchDialog
          open
          onClose={() => setOpen(false)}
          title={t("itemSearch.title")}
          items={items}
          onSelect={(s) => {
            if (s.kind === "item" && !values.includes(s.item.id)) {
              onChange([...values, s.item.id]);
            }
          }}
        />
      )}
    </div>
  );
}

/** Items with count and chance (drops, loot). */
export function ItemStackList({
  label,
  values,
  onChange,
}: {
  label: string;
  values: readonly ItemStack[];
  onChange: (values: ItemStack[]) => void;
}) {
  const t = useT();
  const { items, lookup } = useDesigner();
  const [open, setOpen] = useState(false);
  const update = (index: number, patch: Partial<ItemStack>) =>
    onChange(values.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      {values.map((stack, index) => (
        <div
          key={`${stack.item}-${index}`}
          className="flex flex-wrap items-end gap-2 rounded-md border border-border p-2"
        >
          <div className="flex min-h-11 min-w-0 flex-1 basis-40 items-center gap-2">
            <ItemIcon icon={lookup(stack.item)?.icon} size={24} />
            <EntryStatus id={stack.item} />
            <span className="text-sm break-all">
              {lookup(stack.item)?.name ?? stack.item}
            </span>
          </div>
          <NumberField
            label={t("designer.recipes.count")}
            value={stack.count}
            min={1}
            max={99}
            onChange={(count) => update(index, { count })}
            className="w-24"
          />
          <NumberField
            label={t("fields.chance")}
            value={stack.chance}
            min={0}
            max={1}
            step={0.05}
            onChange={(chance) => update(index, { chance })}
            className="w-24"
          />
          <IconButton
            label={t("lists.remove", {
              name: lookup(stack.item)?.name ?? stack.item,
            })}
            onClick={() => onChange(values.filter((_, i) => i !== index))}
          >
            <X className="size-4" aria-hidden />
          </IconButton>
        </div>
      ))}
      <div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="size-4" aria-hidden />
          {t("lists.pickItem")}
        </Button>
      </div>
      {open && (
        <ItemSearchDialog
          open
          onClose={() => setOpen(false)}
          title={t("itemSearch.title")}
          items={items}
          onSelect={(s) => {
            if (s.kind === "item") {
              onChange([...values, { item: s.item.id, count: 1, chance: 1 }]);
            }
          }}
        />
      )}
    </div>
  );
}

/** Checkbox list of the mod's other entries (involved entries). */
export function EntryCheckboxList({
  label,
  values,
  onChange,
  exclude,
}: {
  label: string;
  values: readonly string[];
  onChange: (values: string[]) => void;
  exclude: string;
}) {
  const t = useT();
  const { entries } = useDesigner();
  const options = entries.filter((e) => e.id !== exclude);
  const missing = values.filter((v) => !entries.some((e) => e.id === v));
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-sm font-medium">{label}</legend>
      {options.length === 0 && missing.length === 0 && (
        <p className="text-sm text-muted">{t("lists.empty")}</p>
      )}
      {options.map((entry) => (
        <label
          key={entry.id}
          className="flex min-h-11 cursor-pointer items-center gap-3"
        >
          <input
            type="checkbox"
            checked={values.includes(entry.id)}
            onChange={(e) =>
              onChange(
                e.target.checked
                  ? [...values, entry.id]
                  : values.filter((v) => v !== entry.id),
              )
            }
            className="size-5 accent-accent"
          />
          <StatusIcon status={entry.status} />
          <span className="text-sm">
            {entry.name}{" "}
            <span className="font-mono text-xs text-muted">{entry.id}</span>
          </span>
        </label>
      ))}
      {missing.length > 0 && (
        <ul className="flex flex-wrap gap-1">
          {missing.map((id) => (
            <Chip
              key={id}
              text={t("designer.missing", { id })}
              onRemove={() => onChange(values.filter((v) => v !== id))}
            />
          ))}
        </ul>
      )}
    </fieldset>
  );
}
