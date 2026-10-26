"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { ItemSearchDialog } from "@/components/items/item-search-dialog";
import { IngredientSlot } from "@/components/recipes/recipe-slot";
import { Button, IconButton } from "@/components/ui/button";
import {
  CheckboxField,
  CommittedIntField,
  FieldGrid,
  NumberField,
  SelectField,
  TextAreaField,
} from "@/components/ui/form-fields";
import { TextField } from "@/components/ui/field";
import {
  ARMOR_SLOTS,
  BOSS_BAR_COLORS,
  BOSS_BAR_OVERLAYS,
  ENTITY_KINDS,
  HARVEST_TOOLS,
  ITEM_KINDS,
  MAX_MULTIBLOCK_SIZE,
  MECHANIC_CATEGORIES,
  OBTAINED_VIA,
  RARITIES,
  resizeLayers,
  switchKind,
  TOOL_TIERS,
  type Entry,
} from "@/domain/entry";
import { useT } from "@/i18n/client";
import type { MessageKey } from "@/i18n/types";
import { useDesigner } from "./designer-context";
import {
  ChipInput,
  EntryCheckboxList,
  ItemIdList,
  ItemStackList,
} from "./list-inputs";

type Of<T extends Entry["type"]> = Extract<Entry, { type: T }>;

/** Asks before a change that drops filled-in values; `null` message = no loss. */
export type ConfirmChange = (message: string | null, apply: () => void) => void;

type SectionProps<T extends Entry["type"]> = {
  entry: Of<T>;
  onChange: (entry: Entry) => void;
  confirm: ConfirmChange;
};

function useOptions() {
  const t = useT();
  return <V extends string>(values: readonly V[], group: string) =>
    values.map((value) => ({
      value,
      label: t(`enums.${group}.${value}` as MessageKey),
    }));
}

function useKindChange<T extends "item" | "entity">({
  entry,
  onChange,
  confirm,
}: SectionProps<T>) {
  const t = useT();
  return (kind: string) => {
    const { entry: next, lost } = switchKind(entry, kind);
    confirm(
      lost.length > 0
        ? t("designer.entry.kindChangeConfirm", {
            fields: lost.map((f) => t(`fields.${f}` as MessageKey)).join(", "),
          })
        : null,
      () => onChange(next),
    );
  };
}

// --- item -----------------------------------------------------------------

export function ItemFields(props: SectionProps<"item">) {
  const { entry, onChange } = props;
  const t = useT();
  const options = useOptions();
  const changeKind = useKindChange(props);
  const set = (patch: Record<string, unknown>) =>
    onChange({ ...entry, ...patch } as Entry);

  return (
    <div className="flex flex-col gap-4">
      <FieldGrid>
        <SelectField
          label={t("fields.kind")}
          value={entry.kind}
          options={options(ITEM_KINDS, "itemKind")}
          onChange={changeKind}
        />
        <NumberField
          label={t("fields.stackSize")}
          value={entry.stackSize}
          min={1}
          max={99}
          onChange={(stackSize) => set({ stackSize })}
        />
        <SelectField
          label={t("fields.rarity")}
          value={entry.rarity}
          options={options(RARITIES, "rarity")}
          onChange={(rarity) => set({ rarity })}
        />
      </FieldGrid>
      <CheckboxField
        label={t("fields.fireResistant")}
        checked={entry.fireResistant}
        onChange={(fireResistant) => set({ fireResistant })}
      />
      <TextField
        label={t("fields.tooltip")}
        value={entry.tooltip}
        maxLength={500}
        onChange={(e) => set({ tooltip: e.target.value })}
      />
      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-sm font-medium">
          {t("fields.obtainedVia")}
        </legend>
        <div className="flex flex-wrap gap-x-4">
          {OBTAINED_VIA.map((way) => (
            <CheckboxField
              key={way}
              label={t(`enums.obtainedVia.${way}`)}
              checked={entry.obtainedVia.includes(way)}
              onChange={(checked) =>
                set({
                  obtainedVia: checked
                    ? OBTAINED_VIA.filter(
                        (w) => w === way || entry.obtainedVia.includes(w),
                      )
                    : entry.obtainedVia.filter((w) => w !== way),
                })
              }
            />
          ))}
        </div>
      </fieldset>

      {(entry.kind === "tool" || entry.kind === "weapon") && (
        <FieldGrid>
          {entry.kind === "tool" && (
            <SelectField
              label={t("fields.tier")}
              value={entry.tier}
              options={options(TOOL_TIERS, "toolTier")}
              onChange={(tier) => set({ tier })}
            />
          )}
          <NumberField
            label={t("fields.durability")}
            value={entry.durability}
            min={1}
            onChange={(durability) => set({ durability })}
          />
          <NumberField
            label={t("fields.attackDamage")}
            value={entry.attackDamage}
            min={0}
            step={0.5}
            onChange={(attackDamage) => set({ attackDamage })}
          />
          <NumberField
            label={t("fields.attackSpeed")}
            value={entry.attackSpeed}
            min={0}
            step={0.1}
            onChange={(attackSpeed) => set({ attackSpeed })}
          />
        </FieldGrid>
      )}
      {entry.kind === "armor" && (
        <FieldGrid>
          <SelectField
            label={t("fields.slot")}
            value={entry.slot}
            options={options(ARMOR_SLOTS, "armorSlot")}
            onChange={(slot) => set({ slot })}
          />
          <NumberField
            label={t("fields.durability")}
            value={entry.durability}
            min={1}
            onChange={(durability) => set({ durability })}
          />
          <NumberField
            label={t("fields.defense")}
            value={entry.defense}
            min={0}
            onChange={(defense) => set({ defense })}
          />
          <NumberField
            label={t("fields.toughness")}
            value={entry.toughness}
            min={0}
            step={0.5}
            onChange={(toughness) => set({ toughness })}
          />
        </FieldGrid>
      )}
      {entry.kind === "food" && (
        <>
          <FieldGrid>
            <NumberField
              label={t("fields.nutrition")}
              value={entry.nutrition}
              min={0}
              onChange={(nutrition) => set({ nutrition })}
            />
            <NumberField
              label={t("fields.saturation")}
              value={entry.saturation}
              min={0}
              step={0.1}
              onChange={(saturation) => set({ saturation })}
            />
          </FieldGrid>
          <FoodEffects
            effects={entry.effects}
            onChange={(effects) => set({ effects })}
          />
        </>
      )}
    </div>
  );
}

type FoodEffect = Extract<Of<"item">, { kind: "food" }>["effects"][number];

function FoodEffects({
  effects,
  onChange,
}: {
  effects: FoodEffect[];
  onChange: (effects: FoodEffect[]) => void;
}) {
  const t = useT();
  const update = (i: number, patch: Partial<FoodEffect>) =>
    onChange(effects.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{t("fields.effects")}</span>
      {effects.map((effect, i) => (
        <div
          key={i}
          className="flex flex-wrap items-end gap-2 rounded-md border border-border p-2"
        >
          <TextField
            label={t("fields.effect")}
            value={effect.effect}
            placeholder="minecraft:regeneration"
            autoCapitalize="off"
            spellCheck={false}
            onChange={(e) =>
              update(i, { effect: e.target.value.trim().toLowerCase() })
            }
            className="min-w-0 flex-1 basis-48"
            inputClassName="font-mono"
          />
          <NumberField
            label={t("fields.durationSeconds")}
            value={effect.durationSeconds}
            min={1}
            onChange={(durationSeconds) => update(i, { durationSeconds })}
            className="w-28"
          />
          <NumberField
            label={t("fields.amplifier")}
            value={effect.amplifier}
            min={0}
            max={255}
            onChange={(amplifier) => update(i, { amplifier })}
            className="w-24"
          />
          <NumberField
            label={t("fields.chance")}
            value={effect.chance}
            min={0}
            max={1}
            step={0.05}
            onChange={(chance) => update(i, { chance })}
            className="w-24"
          />
          <IconButton
            label={t("lists.remove", {
              name: effect.effect || t("fields.effect"),
            })}
            onClick={() => onChange(effects.filter((_, j) => j !== i))}
          >
            <X className="size-4" aria-hidden />
          </IconButton>
        </div>
      ))}
      <div>
        <Button
          onClick={() =>
            onChange([
              ...effects,
              {
                effect: "minecraft:regeneration",
                durationSeconds: 5,
                amplifier: 0,
                chance: 1,
              },
            ])
          }
        >
          <Plus className="size-4" aria-hidden />
          {t("lists.add")}
        </Button>
      </div>
    </div>
  );
}

// --- block ----------------------------------------------------------------

export function BlockFields({
  entry,
  onChange,
  confirm,
}: SectionProps<"block">) {
  const t = useT();
  const options = useOptions();
  const set = (patch: Record<string, unknown>) =>
    onChange({ ...entry, ...patch } as Entry);
  const lossMessage = t("designer.entry.choiceChangeConfirm");

  return (
    <div className="flex flex-col gap-4">
      <FieldGrid>
        <NumberField
          label={t("fields.hardness")}
          value={entry.hardness}
          min={-1}
          step={0.5}
          onChange={(hardness) => set({ hardness })}
        />
        <NumberField
          label={t("fields.blastResistance")}
          value={entry.blastResistance}
          min={0}
          step={0.5}
          onChange={(blastResistance) => set({ blastResistance })}
        />
        <NumberField
          label={t("fields.lightLevel")}
          value={entry.lightLevel}
          min={0}
          max={15}
          onChange={(lightLevel) => set({ lightLevel })}
        />
        <SelectField
          label={t("fields.harvestTool")}
          value={entry.harvest.tool}
          options={options(["none", ...HARVEST_TOOLS] as const, "harvestTool")}
          onChange={(tool) => {
            if (tool === "none") {
              confirm(entry.harvest.tool !== "none" ? lossMessage : null, () =>
                set({ harvest: { tool: "none" } }),
              );
            } else {
              const tier =
                entry.harvest.tool === "none" ? "wood" : entry.harvest.tier;
              set({ harvest: { tool, tier } });
            }
          }}
        />
        {entry.harvest.tool !== "none" && (
          <SelectField
            label={t("fields.tier")}
            value={entry.harvest.tier}
            options={options(TOOL_TIERS, "toolTier")}
            onChange={(tier) => set({ harvest: { ...entry.harvest, tier } })}
          />
        )}
      </FieldGrid>
      <div className="flex flex-wrap gap-x-6">
        <CheckboxField
          label={t("fields.fullCube")}
          checked={entry.fullCube}
          onChange={(fullCube) => set({ fullCube })}
        />
        <CheckboxField
          label={t("fields.transparent")}
          checked={entry.transparent}
          onChange={(transparent) => set({ transparent })}
        />
        <CheckboxField
          label={t("fields.hasBlockEntity")}
          checked={entry.hasBlockEntity}
          onChange={(hasBlockEntity) => set({ hasBlockEntity })}
        />
        <CheckboxField
          label={t("fields.hasBlockItem")}
          checked={entry.hasBlockItem}
          onChange={(hasBlockItem) => set({ hasBlockItem })}
        />
        <CheckboxField
          label={t("fields.hasGui")}
          checked={entry.gui.hasGui}
          onChange={(hasGui) => {
            if (hasGui) set({ gui: { hasGui: true, slots: "" } });
            else
              confirm(
                entry.gui.hasGui && entry.gui.slots.trim() ? lossMessage : null,
                () => set({ gui: { hasGui: false } }),
              );
          }}
        />
      </div>
      {entry.gui.hasGui && (
        <TextAreaField
          label={t("fields.guiSlots")}
          value={entry.gui.slots}
          maxLength={2000}
          onChange={(slots) => set({ gui: { hasGui: true, slots } })}
        />
      )}
      <SelectField
        label={t("fields.dropsType")}
        value={entry.drops.type}
        options={options(["self", "other", "loot_table"] as const, "dropsType")}
        onChange={(type) => {
          const filled =
            (entry.drops.type === "other" && entry.drops.items.length > 0) ||
            (entry.drops.type === "loot_table" && entry.drops.lootTable !== "");
          const next =
            type === "self"
              ? { type }
              : type === "other"
                ? { type, items: [] }
                : { type, lootTable: "" };
          confirm(
            filled && type !== entry.drops.type ? lossMessage : null,
            () => set({ drops: next }),
          );
        }}
        className="sm:max-w-xs"
      />
      {entry.drops.type === "other" && (
        <ItemStackList
          label={t("fields.dropItems")}
          values={entry.drops.items}
          onChange={(items) => set({ drops: { type: "other", items } })}
        />
      )}
      {entry.drops.type === "loot_table" && (
        <TextField
          label={t("fields.lootTable")}
          value={entry.drops.lootTable}
          placeholder="my_mod:blocks/my_block"
          autoCapitalize="off"
          spellCheck={false}
          inputClassName="font-mono"
          onChange={(e) =>
            set({
              drops: {
                type: "loot_table",
                lootTable: e.target.value.trim().toLowerCase(),
              },
            })
          }
        />
      )}
      <TextAreaField
        label={t("fields.redstone")}
        value={entry.redstone}
        maxLength={2000}
        onChange={(redstone) => set({ redstone })}
      />
      <TextAreaField
        label={t("fields.variants")}
        value={entry.variants}
        maxLength={2000}
        onChange={(variants) => set({ variants })}
      />
    </div>
  );
}

// --- entity ---------------------------------------------------------------

export function EntityFields(props: SectionProps<"entity">) {
  const { entry, onChange } = props;
  const t = useT();
  const options = useOptions();
  const changeKind = useKindChange(props);
  const set = (patch: Record<string, unknown>) =>
    onChange({ ...entry, ...patch } as Entry);

  return (
    <div className="flex flex-col gap-4">
      <FieldGrid>
        <SelectField
          label={t("fields.kind")}
          value={entry.kind}
          options={options(ENTITY_KINDS, "entityKind")}
          onChange={changeKind}
        />
        <NumberField
          label={t("fields.health")}
          value={entry.health}
          min={0}
          onChange={(health) => set({ health })}
        />
        <NumberField
          label={t("fields.armor")}
          value={entry.armor}
          min={0}
          onChange={(armor) => set({ armor })}
        />
        <NumberField
          label={t("fields.attackDamage")}
          value={entry.attackDamage}
          min={0}
          step={0.5}
          onChange={(attackDamage) => set({ attackDamage })}
        />
        <NumberField
          label={t("fields.movementSpeed")}
          value={entry.movementSpeed}
          min={0}
          step={0.05}
          onChange={(movementSpeed) => set({ movementSpeed })}
        />
        <NumberField
          label={t("fields.width")}
          value={entry.size.width}
          min={0.05}
          step={0.1}
          onChange={(width) => set({ size: { ...entry.size, width } })}
        />
        <NumberField
          label={t("fields.height")}
          value={entry.size.height}
          min={0.05}
          step={0.1}
          onChange={(height) => set({ size: { ...entry.size, height } })}
        />
      </FieldGrid>
      <ItemStackList
        label={t("fields.drops")}
        values={entry.drops}
        onChange={(drops) => set({ drops })}
      />
      <TextAreaField
        label={t("fields.behavior")}
        value={entry.behavior}
        onChange={(behavior) => set({ behavior })}
      />
      {entry.kind !== "projectile" && (
        <fieldset className="flex flex-col gap-3 rounded-md border border-border p-3">
          <legend className="px-1 text-sm font-medium">
            {t("fields.spawn")}
          </legend>
          <ChipInput
            ids
            label={t("fields.dimensions")}
            values={entry.spawn.dimensions}
            onChange={(dimensions) =>
              set({ spawn: { ...entry.spawn, dimensions } })
            }
            max={20}
          />
          <ChipInput
            ids
            label={t("fields.biomes")}
            values={entry.spawn.biomes}
            onChange={(biomes) => set({ spawn: { ...entry.spawn, biomes } })}
            max={100}
          />
          <FieldGrid>
            <NumberField
              label={t("fields.lightMin")}
              value={entry.spawn.lightLevel.min}
              min={0}
              max={15}
              onChange={(min) =>
                set({
                  spawn: {
                    ...entry.spawn,
                    lightLevel: { ...entry.spawn.lightLevel, min },
                  },
                })
              }
            />
            <NumberField
              label={t("fields.lightMax")}
              value={entry.spawn.lightLevel.max}
              min={0}
              max={15}
              onChange={(max) =>
                set({
                  spawn: {
                    ...entry.spawn,
                    lightLevel: { ...entry.spawn.lightLevel, max },
                  },
                })
              }
            />
            <NumberField
              label={t("fields.groupMin")}
              value={entry.spawn.groupSize.min}
              min={1}
              max={100}
              onChange={(min) =>
                set({
                  spawn: {
                    ...entry.spawn,
                    groupSize: { ...entry.spawn.groupSize, min },
                  },
                })
              }
            />
            <NumberField
              label={t("fields.groupMax")}
              value={entry.spawn.groupSize.max}
              min={1}
              max={100}
              onChange={(max) =>
                set({
                  spawn: {
                    ...entry.spawn,
                    groupSize: { ...entry.spawn.groupSize, max },
                  },
                })
              }
            />
          </FieldGrid>
        </fieldset>
      )}
      {entry.kind === "boss" && (
        <fieldset className="flex flex-col gap-3 rounded-md border border-border p-3">
          <legend className="px-1 text-sm font-medium">
            {t("fields.bossBar")}
          </legend>
          <FieldGrid>
            <SelectField
              label={t("fields.bossBarColor")}
              value={entry.bossBar.color}
              options={options(BOSS_BAR_COLORS, "bossBarColor")}
              onChange={(color) =>
                set({ bossBar: { ...entry.bossBar, color } })
              }
            />
            <SelectField
              label={t("fields.bossBarOverlay")}
              value={entry.bossBar.overlay}
              options={options(BOSS_BAR_OVERLAYS, "bossBarOverlay")}
              onChange={(overlay) =>
                set({ bossBar: { ...entry.bossBar, overlay } })
              }
            />
          </FieldGrid>
        </fieldset>
      )}
    </div>
  );
}

// --- structure, mechanic ------------------------------------------------------

export function StructureFields({
  entry,
  onChange,
}: SectionProps<"structure">) {
  const t = useT();
  const set = (patch: Record<string, unknown>) =>
    onChange({ ...entry, ...patch } as Entry);
  return (
    <div className="flex flex-col gap-4">
      <TextField
        label={t("fields.dimension")}
        value={entry.dimension}
        autoCapitalize="off"
        spellCheck={false}
        inputClassName="font-mono"
        onChange={(e) =>
          set({ dimension: e.target.value.trim().toLowerCase() })
        }
      />
      <ChipInput
        ids
        label={t("fields.biomes")}
        values={entry.biomes}
        onChange={(biomes) => set({ biomes })}
        max={100}
      />
      <FieldGrid>
        <NumberField
          label={t("fields.spacing")}
          value={entry.placement.spacing}
          min={1}
          max={4096}
          onChange={(spacing) =>
            set({ placement: { ...entry.placement, spacing } })
          }
        />
        <NumberField
          label={t("fields.separation")}
          value={entry.placement.separation}
          min={0}
          max={4095}
          onChange={(separation) =>
            set({ placement: { ...entry.placement, separation } })
          }
        />
        <NumberField
          label={t("fields.sizeX")}
          value={entry.size.x}
          min={1}
          max={512}
          onChange={(x) => set({ size: { ...entry.size, x } })}
        />
        <NumberField
          label={t("fields.sizeY")}
          value={entry.size.y}
          min={1}
          max={512}
          onChange={(y) => set({ size: { ...entry.size, y } })}
        />
        <NumberField
          label={t("fields.sizeZ")}
          value={entry.size.z}
          min={1}
          max={512}
          onChange={(z) => set({ size: { ...entry.size, z } })}
        />
      </FieldGrid>
      <ItemIdList
        label={t("fields.keyBlocks")}
        values={entry.keyBlocks}
        onChange={(keyBlocks) => set({ keyBlocks })}
      />
      <ChipInput
        ids
        label={t("fields.mobs")}
        values={entry.mobs}
        onChange={(mobs) => set({ mobs })}
        max={30}
      />
      <ItemStackList
        label={t("fields.loot")}
        values={entry.loot}
        onChange={(loot) => set({ loot })}
      />
    </div>
  );
}

export function MechanicFields({ entry, onChange }: SectionProps<"mechanic">) {
  const t = useT();
  const options = useOptions();
  const set = (patch: Record<string, unknown>) =>
    onChange({ ...entry, ...patch } as Entry);
  return (
    <div className="flex flex-col gap-4">
      <SelectField
        label={t("fields.category")}
        value={entry.category}
        options={options(MECHANIC_CATEGORIES, "mechanicCategory")}
        onChange={(category) => set({ category })}
        className="sm:max-w-xs"
      />
      <TextAreaField
        label={t("fields.howItWorks")}
        value={entry.howItWorks}
        rows={5}
        onChange={(howItWorks) => set({ howItWorks })}
      />
      <TextAreaField
        label={t("fields.parameters")}
        value={entry.parameters}
        rows={4}
        onChange={(parameters) => set({ parameters })}
      />
      <EntryCheckboxList
        label={t("fields.involvedEntries")}
        values={entry.involvedEntries}
        exclude={entry.id}
        onChange={(involvedEntries) => set({ involvedEntries })}
      />
    </div>
  );
}

// --- multiblock -------------------------------------------------------------

export function MultiblockFields({
  entry,
  onChange,
}: SectionProps<"multiblock">) {
  const t = useT();
  const { items, lookup, recipeTypes } = useDesigner();
  const [layer, setLayer] = useState(0);
  const [picking, setPicking] = useState<number | "controller" | null>(null);
  const set = (patch: Record<string, unknown>) =>
    onChange({ ...entry, ...patch } as Entry);
  const { width, height, depth } = entry.dimensions;
  const shownLayer = Math.min(layer, height - 1);

  // The size fields commit only valid values (CommittedIntField), so the
  // layout is always resized from the size it really has.
  const resize = (patch: Partial<typeof entry.dimensions>) => {
    const next = { ...entry.dimensions, ...patch };
    set({
      dimensions: next,
      layers: resizeLayers(entry.layers, entry.dimensions, next),
    });
  };

  const setCell = (index: number, value: string | null) =>
    set({
      layers: entry.layers.map((cells, y) =>
        y === shownLayer
          ? cells.map((c, i) => (i === index ? value : c))
          : cells,
      ),
    });

  const cells = entry.layers[shownLayer] ?? [];
  const label = (id: string | null) =>
    id
      ? (lookup(id)?.name ?? t("designer.missing", { id }))
      : t("recipe.emptySlot");

  return (
    <div className="flex flex-col gap-4">
      <FieldGrid>
        <CommittedIntField
          label={t("fields.width")}
          value={width}
          min={1}
          max={MAX_MULTIBLOCK_SIZE}
          onCommit={(w) => resize({ width: w })}
        />
        <CommittedIntField
          label={t("fields.height")}
          value={height}
          min={1}
          max={MAX_MULTIBLOCK_SIZE}
          onCommit={(h) => resize({ height: h })}
        />
        <CommittedIntField
          label={t("fields.depth")}
          value={depth}
          min={1}
          max={MAX_MULTIBLOCK_SIZE}
          onCommit={(d) => resize({ depth: d })}
        />
      </FieldGrid>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">{t("fields.layout")}</span>
        <div
          role="tablist"
          aria-label={t("designer.layout.layers")}
          className="flex flex-wrap gap-1"
        >
          {entry.layers.map((_, y) => (
            <button
              key={y}
              type="button"
              role="tab"
              aria-selected={y === shownLayer}
              onClick={() => setLayer(y)}
              className="min-h-11 min-w-11 rounded-md border border-border px-2 text-sm text-muted aria-selected:bg-accent/13 aria-selected:text-text"
            >
              {t("designer.layout.layer", { n: y + 1 })}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto pb-1">
          <div
            className="grid w-fit gap-1"
            style={{ gridTemplateColumns: `repeat(${width}, 3rem)` }}
          >
            {cells.map((cell, index) => (
              <IngredientSlot
                key={index}
                ingredient={cell ? { item: cell } : null}
                lookup={lookup}
                selected={picking === index}
                label={t("designer.layout.cell", {
                  layer: shownLayer + 1,
                  row: Math.floor(index / width) + 1,
                  column: (index % width) + 1,
                })}
                onClick={() => setPicking(index)}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium">{t("fields.controller")}</span>
        <IngredientSlot
          ingredient={entry.controller ? { item: entry.controller } : null}
          lookup={lookup}
          label={t("fields.controller")}
          selected={picking === "controller"}
          onClick={() => setPicking("controller")}
        />
        <span className="text-sm text-muted">
          {entry.controller ? label(entry.controller) : ""}
        </span>
      </div>

      <TextAreaField
        label={t("fields.formationTrigger")}
        value={entry.formationTrigger}
        maxLength={2000}
        onChange={(formationTrigger) => set({ formationTrigger })}
      />
      <TextAreaField
        label={t("fields.function")}
        value={entry.function}
        onChange={(fn) => set({ function: fn })}
      />
      <TextAreaField
        label={t("fields.inputsOutputs")}
        value={entry.inputsOutputs}
        onChange={(inputsOutputs) => set({ inputsOutputs })}
      />

      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-sm font-medium">
          {t("fields.recipeTypes")}
        </legend>
        {recipeTypes.length === 0 && entry.recipeTypes.length === 0 && (
          <p className="text-sm text-muted">{t("designer.recipeTypes.none")}</p>
        )}
        {recipeTypes.map((type) => (
          <CheckboxField
            key={type.id}
            label={type.name}
            checked={entry.recipeTypes.includes(type.id)}
            onChange={(checked) =>
              set({
                recipeTypes: checked
                  ? [...entry.recipeTypes, type.id]
                  : entry.recipeTypes.filter((id) => id !== type.id),
              })
            }
          />
        ))}
        {entry.recipeTypes
          .filter((id) => !recipeTypes.some((type) => type.id === id))
          .map((id) => (
            <CheckboxField
              key={id}
              label={t("designer.missing", { id })}
              checked
              onChange={() =>
                set({ recipeTypes: entry.recipeTypes.filter((r) => r !== id) })
              }
            />
          ))}
      </fieldset>

      {picking !== null && (
        <ItemSearchDialog
          open
          onClose={() => setPicking(null)}
          title={t("itemSearch.title")}
          items={items}
          onSelect={(s) => {
            if (s.kind !== "item") return;
            if (picking === "controller") set({ controller: s.item.id });
            else setCell(picking, s.item.id);
          }}
          onClear={() => {
            if (picking === "controller") set({ controller: null });
            else setCell(picking, null);
          }}
        />
      )}
    </div>
  );
}
