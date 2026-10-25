/**
 * English UI strings; the source of truth for message keys (ADR 0012).
 * Only UI strings live here. User-entered content and Minecraft names are
 * never translated. Placeholders use {name} syntax.
 */
export const en = {
  app: {
    name: "Mineforge",
  },
  views: {
    label: "View",
    designer: "Mod Designer",
    modpacks: "Modpack Planner",
  },
  projects: {
    customMod: {
      selectorLabel: "Custom mod",
      none: "No custom mods yet",
      create: "New custom mod",
      createTitle: "New custom mod",
      renameTitle: "Rename custom mod",
      deleteTitle: "Delete custom mod",
      deleteConfirm:
        "Delete “{name}”? All its entries, recipes, icons and tasks are removed. This cannot be undone in the app.",
      deleteAffectedPacks: "It is also removed from these modpacks:",
      idLabel: "Mod ID",
      idHint:
        "Lowercase letters, digits and _; starts with a letter. Cannot be changed later.",
      emptyTitle: "No custom mods yet",
      emptyText: "Create a custom mod to start planning its content.",
    },
    modpack: {
      selectorLabel: "Modpack",
      none: "No modpacks yet",
      create: "New modpack",
      createTitle: "New modpack",
      renameTitle: "Rename modpack",
      deleteTitle: "Delete modpack",
      deleteConfirm:
        "Delete “{name}”? Its recipe changes and tasks are removed. Library mods and custom mods are kept.",
      idLabel: "Pack ID",
      idHint: "Lowercase letters, digits and hyphens. Cannot be changed later.",
      emptyTitle: "No modpacks yet",
      emptyText: "Create a modpack to combine library mods and custom mods.",
    },
    nameLabel: "Name",
    rename: "Rename",
    delete: "Delete",
    idValue: "ID: {id}",
    notFound: "This project does not exist (anymore).",
  },
  actions: {
    cancel: "Cancel",
    create: "Create",
    save: "Save",
    delete: "Delete",
    close: "Close",
    retry: "Try again",
  },
  errors: {
    conflict:
      "This was changed elsewhere. The latest version has been loaded; please try again.",
    idTaken: "This ID is already used.",
    idTakenByLibrary: "This ID is already used by a library mod.",
    invalidId: "This ID is not valid.",
    invalidInput: "Please check the highlighted fields.",
    notFound: "Not found. It may have been deleted elsewhere.",
    unknown: "Something went wrong. Please try again.",
  },
  settings: {
    open: "Settings",
    title: "Settings",
    language: "Language",
    theme: "Theme",
    mode: "Appearance",
    modes: {
      light: "Light",
      dark: "Dark",
      system: "System",
    },
  },
  auth: {
    title: "Sign in to Mineforge",
    text: "This is a private app. Only the allowlisted GitHub account can sign in.",
    signIn: "Sign in with GitHub",
    accessDenied: "This GitHub account is not allowed to use this app.",
    error: "Sign-in failed. Please try again.",
    signOut: "Sign out",
    signOutAs: "Sign out ({name})",
  },
  notFound: {
    title: "Page not found",
    back: "Back to the app",
  },
  locales: {
    en: "English",
    de: "Deutsch",
  },
} as const;
