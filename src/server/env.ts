import { z } from "zod";

/** The allowlisted numeric GitHub user ID, or `null` if unset or malformed. */
export function allowedGithubUserId(): string | null {
  const value = process.env.ALLOWED_GITHUB_USER_ID?.trim();
  return value && /^\d+$/.test(value) ? value : null;
}

const githubEnvSchema = z.object({
  GITHUB_APP_ID: z.string().min(1),
  // Vercel and .env files often store the PEM with literal "\n".
  GITHUB_APP_PRIVATE_KEY: z
    .string()
    .min(1)
    .transform((key) => key.replace(/\\n/g, "\n")),
  GITHUB_APP_INSTALLATION_ID: z.coerce.number().int().positive(),
  GITHUB_REPO_OWNER: z.string().min(1),
  GITHUB_REPO_NAME: z.string().min(1),
  GITHUB_DATA_BRANCH: z.string().min(1).default("main"),
});
export type GitHubEnv = z.infer<typeof githubEnvSchema>;

/** GitHub App and repo settings. Parsed on use, so builds don't need them. */
export function githubEnv(): GitHubEnv {
  const parsed = githubEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Missing or invalid GitHub env vars: ${missing}`);
  }
  return parsed.data;
}
