import { describe, expect, it } from "vitest";
import { decideAccess, isAllowedGithubId, safeCallbackUrl } from "./access";
import { isDevFakeMode } from "./dev-fake";

describe("allowlist", () => {
  it("allows only the configured numeric ID", () => {
    expect(isAllowedGithubId("123", "123")).toBe(true);
    expect(isAllowedGithubId("124", "123")).toBe(false);
    expect(isAllowedGithubId("123", undefined)).toBe(false);
    expect(isAllowedGithubId(undefined, "123")).toBe(false);
    expect(isAllowedGithubId("octocat", "octocat")).toBe(false);
    expect(isAllowedGithubId("", "")).toBe(false);
  });
});

describe("decideAccess", () => {
  it("allows public paths and signed-in requests", () => {
    expect(decideAccess("/sign-in", "", false).action).toBe("allow");
    expect(
      decideAccess("/api/auth/callback/github", "?code=x", false).action,
    ).toBe("allow");
    expect(decideAccess("/designer", "", true).action).toBe("allow");
  });

  it("returns 401 for APIs and redirects pages", () => {
    expect(decideAccess("/api/custom-mods", "", false).action).toBe(
      "unauthorized",
    );
    expect(decideAccess("/api/textures/textures/x.png", "", false).action).toBe(
      "unauthorized",
    );
    expect(decideAccess("/designer/abc", "?x=1", false)).toEqual({
      action: "redirect",
      to: "/sign-in?callbackUrl=%2Fdesigner%2Fabc%3Fx%3D1",
    });
    expect(decideAccess("/sign-in-other", "", false).action).toBe("redirect");
    expect(decideAccess("/api/authx", "", false).action).toBe("unauthorized");
  });

  it("only accepts relative callback URLs", () => {
    expect(safeCallbackUrl("/designer")).toBe("/designer");
    expect(safeCallbackUrl("//evil.example")).toBe("/");
    expect(safeCallbackUrl("/\\evil.example")).toBe("/");
    expect(safeCallbackUrl("https://evil.example")).toBe("/");
    expect(safeCallbackUrl(undefined)).toBe("/");
  });
});

describe("isDevFakeMode", () => {
  it("is only active in development, opted in, and not on Vercel", () => {
    expect(
      isDevFakeMode({ MINEFORGE_DEV_FAKE: "1", NODE_ENV: "development" }),
    ).toBe(true);
    expect(
      isDevFakeMode({ MINEFORGE_DEV_FAKE: "1", NODE_ENV: "production" }),
    ).toBe(false);
    expect(
      isDevFakeMode({
        MINEFORGE_DEV_FAKE: "1",
        NODE_ENV: "development",
        VERCEL: "1",
      }),
    ).toBe(false);
    expect(isDevFakeMode({ NODE_ENV: "development" })).toBe(false);
    expect(
      isDevFakeMode({ MINEFORGE_DEV_FAKE: "true", NODE_ENV: "development" }),
    ).toBe(false);
  });
});
