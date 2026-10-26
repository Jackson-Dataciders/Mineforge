"use client";

import { X } from "lucide-react";
import {
  createContext,
  use,
  useCallback,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useT } from "@/i18n/client";

type Tone = "info" | "error";
type Toast = { id: number; message: string; tone: Tone };

const ToastContext = createContext<
  ((message: string, tone?: Tone) => void) | null
>(null);

/** Shows short messages (e.g. conflicts) in an aria-live region. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const t = useT();
  const dismiss = useCallback(
    (id: number) => setToasts((all) => all.filter((x) => x.id !== id)),
    [],
  );
  const show = useCallback(
    (message: string, tone: Tone = "info") => {
      const id = Date.now() + Math.random();
      setToasts((all) => [...all, { id, message, tone }]);
      setTimeout(() => dismiss(id), 8000);
    },
    [dismiss],
  );
  const value = useMemo(() => show, [show]);

  return (
    <ToastContext value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-3"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.tone === "error" ? "alert" : "status"}
            className={`pointer-events-auto flex w-full max-w-md items-start gap-2 rounded-lg border bg-surface py-1 pr-1 pl-3 text-sm ${
              toast.tone === "error" ? "border-danger" : "border-border"
            }`}
          >
            <p className="flex-1 py-2">{toast.message}</p>
            <button
              type="button"
              aria-label={t("actions.close")}
              onClick={() => dismiss(toast.id)}
              className="inline-flex size-11 items-center justify-center rounded-md hover:bg-accent/13"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </ToastContext>
  );
}

export function useToast() {
  const show = use(ToastContext);
  if (!show) throw new Error("useToast must be used inside <ToastProvider>");
  return show;
}
