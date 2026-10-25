"use client";

import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/client";

/** Error boundary for app pages, e.g. when GitHub is unreachable. */
export default function AppError({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  const t = useT();
  return (
    <div
      role="alert"
      className="mx-auto mt-12 flex max-w-sm flex-col items-center gap-3 text-center"
    >
      <p>{t("errors.unknown")}</p>
      <Button onClick={reset}>{t("actions.retry")}</Button>
    </div>
  );
}
