import type { AppUser } from "./access";

/**
 * Dev-only fake mode (ADR 0014): in-memory storage and an automatic fake
 * login, for local verification without GitHub credentials. It can never be
 * active in a production build or on Vercel.
 */
export function isDevFakeMode(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return (
    env.MINEFORGE_DEV_FAKE === "1" &&
    env.NODE_ENV === "development" &&
    !env.VERCEL
  );
}

export const DEV_FAKE_USER: AppUser = { githubId: "0", name: "Dev (fake)" };
