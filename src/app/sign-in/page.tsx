import { redirect } from "next/navigation";
import { getT } from "@/i18n/server";
import { safeCallbackUrl } from "@/server/access";
import { signIn } from "@/server/auth";
import { getAllowedUser } from "@/server/session";

/** Localized sign-in page; the only page reachable without a session. */
export default async function SignInPage({
  searchParams,
}: PageProps<"/sign-in">) {
  const params = await searchParams;
  const one = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;
  const callbackUrl = safeCallbackUrl(one(params.callbackUrl));
  if (await getAllowedUser()) redirect(callbackUrl);

  const t = await getT();
  const error = one(params.error);

  async function signInWithGitHub() {
    "use server";
    await signIn("github", { redirectTo: callbackUrl });
  }

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6">
        <h1 className="text-xl font-semibold">{t("auth.title")}</h1>
        <p className="mt-2 text-muted">{t("auth.text")}</p>
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-md bg-danger/13 p-3 text-sm text-text"
          >
            {error === "AccessDenied"
              ? t("auth.accessDenied")
              : t("auth.error")}
          </p>
        )}
        <form action={signInWithGitHub} className="mt-6">
          <button
            type="submit"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-accent px-4 font-medium text-on-accent"
          >
            {t("auth.signIn")}
          </button>
        </form>
      </div>
    </main>
  );
}
