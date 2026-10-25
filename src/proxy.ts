import {
  NextResponse,
  type NextFetchEvent,
  type NextRequest,
} from "next/server";
import { decideAccess, isAllowedGithubId } from "@/server/access";
import { auth } from "@/server/auth";
import { isDevFakeMode } from "@/server/dev-fake";
import { allowedGithubUserId } from "@/server/env";

function respond(request: NextRequest, signedIn: boolean) {
  const decision = decideAccess(
    request.nextUrl.pathname,
    request.nextUrl.search,
    signedIn,
  );
  if (decision.action === "unauthorized") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (decision.action === "redirect") {
    return NextResponse.redirect(new URL(decision.to, request.nextUrl.origin));
  }
  return NextResponse.next();
}

const withSession = auth((request) =>
  respond(
    request,
    isAllowedGithubId(request.auth?.user?.githubId, allowedGithubUserId()),
  ),
);

/**
 * Every page and API route requires the allowlisted GitHub session (ADR 0004).
 * Pages redirect to /sign-in, API routes get 401. Routes re-check the session
 * themselves (ADR 0013). Dev fake mode skips Auth.js entirely (ADR 0014).
 */
export function proxy(request: NextRequest, event: NextFetchEvent) {
  if (isDevFakeMode()) return respond(request, true);
  return withSession(request, event as never);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
