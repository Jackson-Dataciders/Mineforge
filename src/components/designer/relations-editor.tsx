"use client";

import { Plus, X } from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import { SelectField } from "@/components/ui/form-fields";
import { TextField } from "@/components/ui/field";
import {
  RELATION_TYPES,
  type Relation,
  type RelationType,
} from "@/domain/entry";
import { useT } from "@/i18n/client";
import { useDesigner } from "./designer-context";

/** Manual typed relations to other entries of the mod (shown in the phase 6 mind map). */
export function RelationsEditor({
  entryId,
  relations,
  onChange,
}: {
  entryId: string;
  relations: Relation[];
  onChange: (relations: Relation[]) => void;
}) {
  const t = useT();
  const { entries } = useDesigner();
  const targets = entries.filter((e) => e.id !== entryId);

  const setType = (index: number, type: RelationType) =>
    onChange(
      relations.map((r, i) => {
        if (i !== index) return r;
        return type === "custom"
          ? {
              type,
              target: r.target,
              label: r.type === "custom" ? r.label : "",
            }
          : { type, target: r.target };
      }),
    );
  const update = (index: number, patch: Partial<Relation>) =>
    onChange(
      relations.map((r, i) =>
        i === index ? ({ ...r, ...patch } as Relation) : r,
      ),
    );

  return (
    <div className="flex flex-col gap-3">
      {relations.length === 0 && (
        <p className="text-sm text-muted">{t("designer.relations.none")}</p>
      )}
      {relations.map((relation, index) => {
        const known = targets.some((e) => e.id === relation.target);
        return (
          <div
            key={index}
            className="flex flex-wrap items-end gap-2 rounded-md border border-border p-2"
          >
            <SelectField
              label={t("designer.relations.type")}
              value={relation.type}
              options={RELATION_TYPES.map((value) => ({
                value,
                label: t(`enums.relationType.${value}`),
              }))}
              onChange={(type) => setType(index, type)}
              className="min-w-0 flex-1 basis-40"
            />
            <SelectField
              label={t("designer.relations.target")}
              value={relation.target}
              options={[
                ...(known
                  ? []
                  : [
                      {
                        value: relation.target,
                        label: t("designer.missing", { id: relation.target }),
                      },
                    ]),
                ...targets.map((e) => ({
                  value: e.id,
                  label: `${e.name} (${e.id})`,
                })),
              ]}
              onChange={(target) => update(index, { target })}
              className="min-w-0 flex-1 basis-48"
            />
            {relation.type === "custom" && (
              <TextField
                label={t("designer.relations.label")}
                value={relation.label}
                maxLength={60}
                onChange={(e) => update(index, { label: e.target.value })}
                className="min-w-0 flex-1 basis-40"
              />
            )}
            <IconButton
              label={t("designer.relations.remove")}
              onClick={() => onChange(relations.filter((_, i) => i !== index))}
            >
              <X className="size-4" aria-hidden />
            </IconButton>
          </div>
        );
      })}
      <div>
        {targets.length === 0 ? (
          <p className="text-sm text-muted">
            {t("designer.relations.noTargets")}
          </p>
        ) : (
          <Button
            onClick={() =>
              onChange([
                ...relations,
                { type: "drops_from", target: targets[0]!.id },
              ])
            }
          >
            <Plus className="size-4" aria-hidden />
            {t("designer.relations.add")}
          </Button>
        )}
      </div>
    </div>
  );
}
