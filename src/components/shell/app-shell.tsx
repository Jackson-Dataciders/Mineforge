"use client";

import { Library, LogOut, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { IconButton } from "@/components/ui/button";
import { ToastProvider } from "@/components/ui/toast";
import { useT } from "@/i18n/client";
import { ProjectActionsContext } from "./project-actions";
import { ProjectBar } from "./project-bar";
import {
  CreateProjectDialog,
  DeleteProjectDialog,
  RenameProjectDialog,
} from "./project-dialogs";
import { SettingsDialog } from "./settings-dialog";
import {
  viewFromPath,
  type ModpackSummary,
  type ProjectSummary,
} from "./types";
import { ViewSwitcher } from "./view-switcher";

type OpenDialog = "create" | "rename" | "delete" | "settings" | null;

/**
 * Top bar (view switcher, project selector, settings, sign out) around the
 * page content. One row on desktop; two rows on phones.
 */
export function AppShell({
  userName,
  customMods,
  modpacks,
  signOutAction,
  children,
}: {
  userName: string;
  customMods: ProjectSummary[];
  modpacks: ModpackSummary[];
  signOutAction: () => Promise<void>;
  children: ReactNode;
}) {
  const t = useT();
  const pathname = usePathname();
  const { view, selectedId } = viewFromPath(pathname);
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const projects = view === "designer" ? customMods : modpacks;
  const selected = projects.find((p) => p.id === selectedId);
  const close = () => setDialog(null);
  const actions = useMemo(
    () => ({ openCreate: () => setDialog("create") }),
    [],
  );

  return (
    <ToastProvider>
      <ProjectActionsContext value={actions}>
        <header className="sticky top-0 z-10 border-b border-border bg-surface">
          <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
            <span className="hidden text-base font-semibold md:inline">
              {t("app.name")}
            </span>
            <ViewSwitcher active={view} />
            <div className="order-last flex basis-full sm:order-none sm:flex-1 sm:basis-auto">
              <ProjectBar
                view={view}
                projects={projects}
                selectedId={selectedId}
                onCreate={() => setDialog("create")}
                onRename={() => setDialog("rename")}
                onDelete={() => setDialog("delete")}
              />
            </div>
            <div className="ml-auto flex items-center">
              {view === "modpacks" && (
                <Link
                  href="/library"
                  aria-current={pathname === "/library" ? "page" : undefined}
                  className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted transition hover:text-text aria-[current=page]:bg-accent/13 aria-[current=page]:text-text"
                >
                  <Library className="size-5" aria-hidden />
                  {t("library.link")}
                </Link>
              )}
              <IconButton
                label={t("settings.open")}
                onClick={() => setDialog("settings")}
              >
                <Settings className="size-5" aria-hidden />
              </IconButton>
              <form action={signOutAction}>
                <IconButton
                  type="submit"
                  label={t("auth.signOutAs", { name: userName })}
                >
                  <LogOut className="size-5" aria-hidden />
                </IconButton>
              </form>
            </div>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-screen-2xl flex-1 flex-col px-3 py-4">
          {children}
        </main>

        <CreateProjectDialog
          key={view}
          view={view}
          open={dialog === "create"}
          onClose={close}
        />
        {selected && dialog === "rename" && (
          <RenameProjectDialog
            view={view}
            project={selected}
            open
            onClose={close}
          />
        )}
        {selected && dialog === "delete" && (
          <DeleteProjectDialog
            view={view}
            project={selected}
            modpacks={modpacks}
            open
            onClose={close}
          />
        )}
        {dialog === "settings" && <SettingsDialog open onClose={close} />}
      </ProjectActionsContext>
    </ToastProvider>
  );
}
