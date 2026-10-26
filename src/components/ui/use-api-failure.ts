"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { useT } from "@/i18n/client";
import type { MessageKey } from "@/i18n/types";
import { useToast } from "./toast";

const ERROR_KEYS: Record<string, MessageKey> = {
  conflict: "errors.conflict",
  idTaken: "errors.idTaken",
  idTakenByLibrary: "errors.idTakenByLibrary",
  idReserved: "errors.idReserved",
  unauthorized: "errors.unauthorized",
  invalidId: "errors.invalidId",
  invalidInput: "errors.invalidInput",
  notFound: "errors.notFound",
  jarExists: "errors.jarExists",
  unknownBlob: "errors.unknownBlob",
  unknownMod: "errors.unknownMod",
  notManualTask: "errors.notManualTask",
  itemNotInPack: "errors.itemNotInPack",
  unknownEntry: "errors.unknownEntry",
  unknownRecipeType: "errors.unknownRecipeType",
  invalidRecipe: "errors.invalidRecipe",
  invalidIcon: "errors.invalidIcon",
  invalidMachine: "errors.invalidMachine",
  taskNotMovable: "errors.taskNotMovable",
};

/** Message key for an API error code. */
export const apiErrorKey = (code: string): MessageKey =>
  ERROR_KEYS[code] ?? "errors.unknown";

/**
 * Standard handling of a failed API call: a toast with the error, sign-in
 * after an expired session (401), and on a conflict, not-found, stale-mod or
 * stale-task error a reload, so the user retries on fresh data instead of
 * overwriting (ADR 0002).
 */
export function useApiFailure() {
  const router = useRouter();
  const toast = useToast();
  const t = useT();
  return useCallback(
    (error: string) => {
      toast(t(apiErrorKey(error)), error === "conflict" ? "info" : "error");
      // The session ended: go to sign-in rather than retrying.
      if (error === "unauthorized") {
        router.push("/sign-in");
        return;
      }
      if (
        ["conflict", "notFound", "unknownMod", "taskNotMovable"].includes(error)
      ) {
        router.refresh();
      }
    },
    [router, toast, t],
  );
}
