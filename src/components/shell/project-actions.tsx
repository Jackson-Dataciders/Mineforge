"use client";

import { createContext, use } from "react";

/** Lets content (e.g. empty states) open the shell's "create project" dialog. */
export const ProjectActionsContext = createContext<{
  openCreate: () => void;
} | null>(null);

export function useProjectActions() {
  const value = use(ProjectActionsContext);
  if (!value)
    throw new Error("useProjectActions must be used inside the app shell");
  return value;
}
