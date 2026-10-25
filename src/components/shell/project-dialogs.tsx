"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TextField } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useT } from "@/i18n/client";
import type { MessageKey } from "@/i18n/types";
import { fetchJson } from "@/lib/fetch-json";
import {
  VIEW_CONFIG,
  type ModpackSummary,
  type ProjectSummary,
  type ViewId,
} from "./types";

const ERROR_KEYS: Record<string, MessageKey> = {
  conflict: "errors.conflict",
  idTaken: "errors.idTaken",
  idTakenByLibrary: "errors.idTakenByLibrary",
  invalidId: "errors.invalidId",
  invalidInput: "errors.invalidInput",
  notFound: "errors.notFound",
};
const errorKey = (code: string): MessageKey =>
  ERROR_KEYS[code] ?? "errors.unknown";

/** Shared handling: on conflict or not-found, reload and tell the user. */
function useFailureHandler() {
  const router = useRouter();
  const toast = useToast();
  const t = useT();
  return (error: string) => {
    toast(t(errorKey(error)), error === "conflict" ? "info" : "error");
    if (error === "conflict" || error === "notFound") router.refresh();
  };
}

export function CreateProjectDialog({
  view,
  open,
  onClose,
}: {
  view: ViewId;
  open: boolean;
  onClose: () => void;
}) {
  const config = VIEW_CONFIG[view];
  const t = useT();
  const router = useRouter();
  const fail = useFailureHandler();
  const [name, setName] = useState("");
  const [id, setId] = useState("");
  const [idEdited, setIdEdited] = useState(false);
  const [idError, setIdError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const effectiveId = idEdited ? id : config.suggestId(name);
  const close = () => {
    setName("");
    setId("");
    setIdEdited(false);
    setIdError(undefined);
    onClose();
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!config.idPattern.test(effectiveId)) {
      setIdError(t("errors.invalidId"));
      return;
    }
    setBusy(true);
    const body =
      view === "designer"
        ? { modId: effectiveId, name }
        : { id: effectiveId, name };
    const result = await fetchJson(config.api, { method: "POST", body });
    setBusy(false);
    if (result.ok) {
      close();
      router.push(`${config.basePath}/${effectiveId}`);
      router.refresh();
    } else if (
      ["idTaken", "idTakenByLibrary", "invalidId"].includes(result.error)
    ) {
      setIdError(t(errorKey(result.error)));
    } else {
      fail(result.error);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title={t(`${config.messages}.createTitle`)}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <TextField
          label={t("projects.nameLabel")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={100}
        />
        <TextField
          label={t(`${config.messages}.idLabel`)}
          hint={t(`${config.messages}.idHint`)}
          error={idError}
          value={effectiveId}
          onChange={(e) => {
            setIdEdited(true);
            setId(e.target.value);
            setIdError(undefined);
          }}
          required
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          inputClassName="font-mono"
        />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={close}>{t("actions.cancel")}</Button>
          <Button
            type="submit"
            variant="primary"
            disabled={busy || !name.trim()}
          >
            {t("actions.create")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function RenameProjectDialog({
  view,
  project,
  open,
  onClose,
}: {
  view: ViewId;
  project: ProjectSummary;
  open: boolean;
  onClose: () => void;
}) {
  const config = VIEW_CONFIG[view];
  const t = useT();
  const router = useRouter();
  const fail = useFailureHandler();
  const [name, setName] = useState(project.name);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    const result = await fetchJson(`${config.api}/${project.id}`, {
      method: "PATCH",
      body: { name, sha: project.sha },
    });
    setBusy(false);
    onClose();
    if (result.ok) router.refresh();
    else fail(result.error);
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t(`${config.messages}.renameTitle`)}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <TextField
          label={t("projects.nameLabel")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={100}
        />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>{t("actions.cancel")}</Button>
          <Button
            type="submit"
            variant="primary"
            disabled={busy || !name.trim()}
          >
            {t("actions.save")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function DeleteProjectDialog({
  view,
  project,
  modpacks,
  open,
  onClose,
}: {
  view: ViewId;
  project: ProjectSummary;
  modpacks: ModpackSummary[];
  open: boolean;
  onClose: () => void;
}) {
  const config = VIEW_CONFIG[view];
  const t = useT();
  const router = useRouter();
  const fail = useFailureHandler();
  const [busy, setBusy] = useState(false);
  const affected =
    view === "designer"
      ? modpacks.filter((p) => p.customModIds.includes(project.id))
      : [];

  async function confirm() {
    setBusy(true);
    const result = await fetchJson(`${config.api}/${project.id}`, {
      method: "DELETE",
      body: { sha: project.sha },
    });
    setBusy(false);
    onClose();
    if (result.ok) {
      router.push(config.basePath);
      router.refresh();
    } else {
      fail(result.error);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t(`${config.messages}.deleteTitle`)}
    >
      <div className="flex flex-col gap-4">
        <p>{t(`${config.messages}.deleteConfirm`, { name: project.name })}</p>
        {affected.length > 0 && (
          <div>
            <p className="text-sm font-medium">
              {t("projects.customMod.deleteAffectedPacks")}
            </p>
            <ul className="mt-1 list-disc pl-5 text-sm">
              {affected.map((pack) => (
                <li key={pack.id}>{pack.name}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose}>{t("actions.cancel")}</Button>
          <Button variant="danger" onClick={confirm} disabled={busy}>
            {t("actions.delete")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
