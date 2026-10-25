"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { useT } from "@/i18n/client";
import { IconButton } from "./button";

/**
 * Modal based on the native <dialog> element (focus trap, Escape, backdrop).
 * Full-width sheet on phones, centered card from `sm` up.
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const t = useT();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // showModal() focuses the first focusable element (the close button);
      // move focus to the first form field instead, if there is one.
      dialog
        .querySelector<HTMLElement>("input:not([type=radio]), select, textarea")
        ?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className="mx-0 mt-auto mb-0 w-full max-w-none rounded-t-xl border border-border bg-surface p-0 text-text sm:m-auto sm:max-w-md sm:rounded-xl"
    >
      {open && (
        <div className="flex max-h-[85dvh] flex-col">
          <div className="flex items-center justify-between gap-2 border-b border-border py-1 pr-1 pl-4">
            <h2 id={titleId} className="text-base font-semibold">
              {title}
            </h2>
            <IconButton label={t("actions.close")} onClick={onClose}>
              <X className="size-5" aria-hidden />
            </IconButton>
          </div>
          <div className="overflow-y-auto p-4">{children}</div>
        </div>
      )}
    </dialog>
  );
}
