import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { isAllowedGithubId, type AppUser } from "./access";
import { auth } from "./auth";
import { DEV_FAKE_USER, isDevFakeMode } from "./dev-fake";
import { allowedGithubUserId } from "./env";

/** The signed-in allowlisted user, or `null`. Re-checks the allowlist on every call. */
export const getAllowedUser = cache(async (): Promise<AppUser | null> => {
  if (isDevFakeMode()) return DEV_FAKE_USER;
  const session = await auth();
  const githubId = session?.user?.githubId;
  if (!isAllowedGithubId(githubId, allowedGithubUserId())) return null;
  return { githubId: githubId!, name: session?.user?.name ?? "" };
});

/** For layouts and pages: redirects to sign-in without an allowlisted session (ADR 0013). */
export async function requireUser(): Promise<AppUser> {
  const user = await getAllowedUser();
  if (!user) redirect("/sign-in");
  return user;
}
