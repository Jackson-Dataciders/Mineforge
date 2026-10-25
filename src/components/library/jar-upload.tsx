"use client";

import { Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { apiErrorKey } from "@/components/ui/use-api-failure";
import { useToast } from "@/components/ui/toast";
import {
  jarFileProblem,
  sanitizeJarName,
  type JarFileProblem,
} from "@/domain/jar-upload";
import { useT } from "@/i18n/client";
import type { MessageKey } from "@/i18n/types";
import { fetchJson } from "@/lib/fetch-json";

type UploadTarget = { token: string; expiresAt: string; blobsUrl: string };

type Entry = {
  file: File;
  name: string;
  problem: JarFileProblem | "exists" | "duplicate" | null;
  status: "waiting" | "uploading" | "uploaded" | "failed";
  percent: number;
  sha?: string;
};

const PROBLEM_KEYS: Record<NonNullable<Entry["problem"]>, MessageKey> = {
  notJar: "upload.notJar",
  tooLarge: "upload.tooLarge",
  empty: "upload.empty",
  exists: "upload.exists",
  duplicate: "upload.duplicate",
};

function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      resolve(url.slice(url.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Creates one blob directly on GitHub (ADR 0005) with upload progress. The
 * JSON body is assembled as a Blob so the base64 string isn't copied again.
 */
async function uploadBlob(
  file: File,
  target: UploadTarget,
  onProgress: (percent: number) => void,
): Promise<string> {
  const base64 = await readBase64(file);
  const body = new Blob(['{"encoding":"base64","content":"', base64, '"}'], {
    type: "application/json",
  });
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", target.blobsUrl);
    xhr.setRequestHeader("Authorization", `Bearer ${target.token}`);
    xhr.setRequestHeader("Accept", "application/vnd.github+json");
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      try {
        const sha = (JSON.parse(xhr.responseText) as { sha?: unknown }).sha;
        if (xhr.status === 201 && typeof sha === "string") resolve(sha);
        else reject(new Error(`Blob upload failed (${xhr.status})`));
      } catch {
        reject(new Error(`Blob upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Blob upload failed"));
    xhr.send(body);
  });
}

/**
 * "Upload jars" (spec 03): multi-select, checks before upload, per-file
 * progress, then one commit of all jars through the server.
 */
export function JarUpload({ existingNames }: { existingNames: string[] }) {
  const t = useT();
  const router = useRouter();
  const toast = useToast();
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [phase, setPhase] = useState<"idle" | "uploading" | "saving">("idle");
  const [error, setError] = useState<string>();

  function select(files: FileList | null) {
    setError(undefined);
    const existing = new Set(existingNames);
    const seen = new Set<string>();
    setEntries(
      [...(files ?? [])].map((file) => {
        const name = sanitizeJarName(file.name);
        let problem: Entry["problem"] = jarFileProblem(file);
        if (!problem && existing.has(name)) problem = "exists";
        if (!problem && seen.has(name)) problem = "duplicate";
        seen.add(name);
        return { file, name, problem, status: "waiting", percent: 0 };
      }),
    );
  }

  const update = (index: number, patch: Partial<Entry>) =>
    setEntries((all) =>
      all.map((e, i) => (i === index ? { ...e, ...patch } : e)),
    );

  const valid = entries.filter((e) => e.problem === null);

  async function start() {
    setError(undefined);
    setPhase("uploading");
    const token = await fetchJson<UploadTarget>("/api/upload-token", {
      method: "POST",
    });
    if (!token.ok) {
      setPhase("idle");
      setError(t(apiErrorKey(token.error)));
      return;
    }
    const uploaded: { name: string; sha: string }[] = [];
    // One file at a time keeps memory use to one jar's base64 string.
    for (const [index, entry] of entries.entries()) {
      if (entry.problem !== null) continue;
      update(index, { status: "uploading", percent: 0 });
      try {
        const sha = await uploadBlob(entry.file, token.data, (percent) =>
          update(index, { percent }),
        );
        update(index, { status: "uploaded", percent: 100, sha });
        uploaded.push({ name: entry.name, sha });
      } catch {
        update(index, { status: "failed" });
        setPhase("idle");
        setError(t("upload.error"));
        return;
      }
    }
    setPhase("saving");
    const commit = await fetchJson("/api/jars", {
      method: "POST",
      body: { files: uploaded },
    });
    setPhase("idle");
    if (!commit.ok) {
      setError(t(apiErrorKey(commit.error)));
      if (commit.error === "conflict") router.refresh();
      return;
    }
    toast(t("upload.done"));
    setOpen(false);
    setEntries([]);
    router.refresh();
  }

  const close = () => {
    if (phase !== "idle") return;
    setOpen(false);
    setEntries([]);
    setError(undefined);
  };

  const statusText = (entry: Entry) => {
    if (entry.problem) return t(PROBLEM_KEYS[entry.problem]);
    if (phase === "saving" && entry.status === "uploaded")
      return t("upload.saving");
    switch (entry.status) {
      case "uploading":
        return t("upload.uploading", { percent: entry.percent });
      case "uploaded":
        return t("upload.uploaded");
      case "failed":
        return t("upload.failed");
      default:
        return t("upload.waiting");
    }
  };

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        <Upload className="size-4" aria-hidden />
        {t("upload.button")}
      </Button>
      {open && (
        <Dialog open onClose={close} title={t("upload.title")}>
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted">{t("upload.hint")}</p>
            <div>
              <label
                htmlFor={inputId}
                className="inline-flex min-h-11 cursor-pointer items-center rounded-md border border-border bg-surface px-3 text-sm font-medium text-text hover:bg-accent/13"
              >
                {t("upload.choose")}
              </label>
              {/* No accept filter: extension filters break on some phone browsers. */}
              <input
                ref={input}
                id={inputId}
                type="file"
                multiple
                disabled={phase !== "idle"}
                onChange={(e) => select(e.target.files)}
                className="sr-only"
              />
            </div>
            {entries.length > 0 && (
              <ul className="flex flex-col gap-2">
                {entries.map((entry, index) => (
                  <li key={index} className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                      <span className="text-sm font-medium break-all">
                        {entry.file.name}
                      </span>
                      <span
                        className={`text-sm ${entry.problem || entry.status === "failed" ? "text-danger" : "text-muted"}`}
                      >
                        {statusText(entry)}
                      </span>
                    </div>
                    {!entry.problem && entry.name !== entry.file.name && (
                      <span className="font-mono text-xs text-muted">
                        {t("upload.renamed", { name: entry.name })}
                      </span>
                    )}
                    {!entry.problem && (
                      <progress
                        value={entry.percent}
                        max={100}
                        aria-label={entry.name}
                        className="h-2 w-full accent-accent"
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button onClick={close} disabled={phase !== "idle"}>
                {t("actions.cancel")}
              </Button>
              <Button
                variant="primary"
                onClick={() => void start()}
                disabled={phase !== "idle" || valid.length === 0}
              >
                {t("upload.start")}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}
