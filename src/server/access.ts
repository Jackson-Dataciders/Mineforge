/** Pure access rules shared by the proxy and the session checks (ADR 0004). */

export type AppUser = { githubId: string; name: string };

/** True only for the one allowlisted numeric GitHub user ID. */
export function isAllowedGithubId(
  githubId: string | undefined | null,
  allowedId: string | undefined | null,
): boolean {
  return (
    typeof githubId === "string" &&
    typeof allowedId === "string" &&
    /^\d+$/.test(allowedId) &&
    githubId === allowedId
  );
}

/** Paths reachable without a session: the sign-in page and Auth.js endpoints. */
export function isPublicPath(pathname: string): boolean {
  return pathname === "/sign-in" || pathname.startsWith("/api/auth/");
}

export type AccessDecision =
  | { action: "allow" }
  | { action: "unauthorized" }
  | { action: "redirect"; to: string };

/** What the proxy does with a request, given whether an allowlisted session exists. */
export function decideAccess(
  pathname: string,
  search: string,
  signedIn: boolean,
): AccessDecision {
  if (signedIn || isPublicPath(pathname)) return { action: "allow" };
  if (pathname === "/api" || pathname.startsWith("/api/"))
    return { action: "unauthorized" };
  const callbackUrl = encodeURIComponent(pathname + search);
  return { action: "redirect", to: `/sign-in?callbackUrl=${callbackUrl}` };
}

/** Only same-origin relative paths are allowed as post-login targets. */
export function safeCallbackUrl(value: string | undefined | null): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/\\")
  ) {
    return "/";
  }
  return value;
}
