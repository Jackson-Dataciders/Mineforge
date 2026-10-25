import type { Messages } from "../types";

/** German UI strings. Must have exactly the keys of `en` (type-checked). */
export const de: Messages = {
  app: {
    name: "Mineforge",
  },
  views: {
    label: "Ansicht",
    designer: "Mod-Designer",
    modpacks: "Modpack-Planer",
  },
  projects: {
    customMod: {
      selectorLabel: "Eigene Mod",
      none: "Noch keine eigenen Mods",
      create: "Neue eigene Mod",
      createTitle: "Neue eigene Mod",
      renameTitle: "Eigene Mod umbenennen",
      deleteTitle: "Eigene Mod löschen",
      deleteConfirm:
        "„{name}“ löschen? Alle Einträge, Rezepte, Icons und Aufgaben werden entfernt. Das lässt sich in der App nicht rückgängig machen.",
      deleteAffectedPacks: "Sie wird außerdem aus diesen Modpacks entfernt:",
      idLabel: "Mod-ID",
      idHint:
        "Kleinbuchstaben, Ziffern und _; beginnt mit einem Buchstaben. Kann später nicht geändert werden.",
      emptyTitle: "Noch keine eigenen Mods",
      emptyText: "Lege eine eigene Mod an, um ihre Inhalte zu planen.",
    },
    modpack: {
      selectorLabel: "Modpack",
      none: "Noch keine Modpacks",
      create: "Neues Modpack",
      createTitle: "Neues Modpack",
      renameTitle: "Modpack umbenennen",
      deleteTitle: "Modpack löschen",
      deleteConfirm:
        "„{name}“ löschen? Rezeptänderungen und Aufgaben werden entfernt. Bibliotheks-Mods und eigene Mods bleiben erhalten.",
      idLabel: "Pack-ID",
      idHint:
        "Kleinbuchstaben, Ziffern und Bindestriche. Kann später nicht geändert werden.",
      emptyTitle: "Noch keine Modpacks",
      emptyText:
        "Lege ein Modpack an, um Bibliotheks-Mods und eigene Mods zu kombinieren.",
    },
    nameLabel: "Name",
    rename: "Umbenennen",
    delete: "Löschen",
    idValue: "ID: {id}",
    notFound: "Dieses Projekt existiert nicht (mehr).",
  },
  actions: {
    cancel: "Abbrechen",
    create: "Anlegen",
    save: "Speichern",
    delete: "Löschen",
    close: "Schließen",
    retry: "Erneut versuchen",
  },
  errors: {
    conflict:
      "Das wurde an anderer Stelle geändert. Der aktuelle Stand wurde geladen; bitte versuche es erneut.",
    idTaken: "Diese ID wird bereits verwendet.",
    idTakenByLibrary:
      "Diese ID wird bereits von einer Bibliotheks-Mod verwendet.",
    invalidId: "Diese ID ist ungültig.",
    invalidInput: "Bitte prüfe die markierten Felder.",
    notFound:
      "Nicht gefunden. Möglicherweise wurde es an anderer Stelle gelöscht.",
    unknown: "Etwas ist schiefgelaufen. Bitte versuche es erneut.",
  },
  settings: {
    open: "Einstellungen",
    title: "Einstellungen",
    language: "Sprache",
    theme: "Farbschema",
    mode: "Darstellung",
    modes: {
      light: "Hell",
      dark: "Dunkel",
      system: "System",
    },
  },
  auth: {
    title: "Bei Mineforge anmelden",
    text: "Dies ist eine private App. Nur das freigegebene GitHub-Konto kann sich anmelden.",
    signIn: "Mit GitHub anmelden",
    accessDenied: "Dieses GitHub-Konto darf diese App nicht verwenden.",
    error: "Anmeldung fehlgeschlagen. Bitte versuche es erneut.",
    signOut: "Abmelden",
    signOutAs: "Abmelden ({name})",
  },
  notFound: {
    title: "Seite nicht gefunden",
    back: "Zurück zur App",
  },
  locales: {
    en: "English",
    de: "Deutsch",
  },
};
