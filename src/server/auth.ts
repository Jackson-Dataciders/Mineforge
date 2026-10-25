import NextAuth, { type DefaultSession } from "next-auth";
import GitHub from "next-auth/providers/github";
import { isAllowedGithubId } from "./access";
import { allowedGithubUserId } from "./env";

declare module "next-auth" {
  interface Session {
    user: { githubId: string; name: string } & Omit<
      DefaultSession["user"],
      "email"
    >;
  }
}
declare module "@auth/core/jwt" {
  interface JWT {
    githubId?: string;
  }
}

/**
 * Auth.js with GitHub as the only provider, allowlisted to one numeric GitHub
 * user ID (ADR 0004). AUTH_SECRET, AUTH_GITHUB_ID and AUTH_GITHUB_SECRET are
 * read from the environment by Auth.js.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [GitHub],
  session: { strategy: "jwt" },
  pages: { signIn: "/sign-in", error: "/sign-in" },
  callbacks: {
    signIn({ account }) {
      return (
        account?.provider === "github" &&
        isAllowedGithubId(account.providerAccountId, allowedGithubUserId())
      );
    },
    jwt({ token, account, profile }) {
      if (account?.provider === "github") {
        token.githubId = account.providerAccountId;
        token.name =
          (profile?.name as string | undefined) ??
          (profile?.login as string) ??
          "";
      }
      return token;
    },
    session({ session, token }) {
      // Expose only what the UI needs: GitHub ID and display name.
      return {
        expires: session.expires,
        user: { githubId: token.githubId ?? "", name: token.name ?? "" },
      } as typeof session;
    },
  },
});
