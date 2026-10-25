import Link from "next/link";
import { getT } from "@/i18n/server";

export default async function NotFound() {
  const t = await getT();
  return (
    <main className="mx-auto mt-16 flex max-w-sm flex-col items-center gap-3 px-4 text-center">
      <h1 className="text-lg font-semibold">{t("notFound.title")}</h1>
      <Link
        href="/"
        className="inline-flex min-h-11 items-center text-text underline"
      >
        {t("notFound.back")}
      </Link>
    </main>
  );
}
