import { AppShell } from "@/components/shell/app-shell";
import { signOut } from "@/server/auth";
import { requireUser } from "@/server/session";
import { loadCustomMods, loadModpacks } from "@/storage";

/** Every app page: allowlisted session (ADR 0013), shell with project lists. */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const [customMods, modpacks] = await Promise.all([
    loadCustomMods(),
    loadModpacks(),
  ]);

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/sign-in" });
  }

  return (
    <AppShell
      userName={user.name}
      customMods={customMods.map((m) => ({
        id: m.data.modId,
        name: m.data.name,
        sha: m.sha,
      }))}
      modpacks={modpacks.map((p) => ({
        id: p.data.id,
        name: p.data.name,
        sha: p.sha,
        customModIds: p.data.customModIds,
      }))}
      signOutAction={signOutAction}
    >
      {children}
    </AppShell>
  );
}
