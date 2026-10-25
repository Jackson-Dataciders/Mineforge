import { describe, expect, it } from "vitest";
import { catalogs, createTranslator, resolveLocale } from "./locale";

function leaves(node: unknown, prefix = ""): [string, unknown][] {
  if (typeof node !== "object" || node === null) return [[prefix, node]];
  return Object.entries(node).flatMap(([k, v]) =>
    leaves(v, prefix ? `${prefix}.${k}` : k),
  );
}

describe("i18n", () => {
  it("has the same non-empty keys in every catalog", () => {
    const en = leaves(catalogs.en);
    const de = leaves(catalogs.de);
    expect(de.map(([k]) => k)).toEqual(en.map(([k]) => k));
    for (const [key, value] of [...en, ...de]) {
      expect(typeof value, key).toBe("string");
      expect((value as string).trim(), key).not.toBe("");
    }
  });

  it("keeps placeholders identical across catalogs", () => {
    const de = new Map(leaves(catalogs.de));
    for (const [key, value] of leaves(catalogs.en)) {
      const names = (s: unknown) =>
        [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      expect(names(de.get(key)), key).toEqual(names(value));
    }
  });

  it("translates with placeholders", () => {
    const t = createTranslator(catalogs.de);
    expect(t("views.designer")).toBe("Mod-Designer");
    expect(t("auth.signOutAs", { name: "Jackson" })).toBe("Abmelden (Jackson)");
  });

  it("resolves the locale from cookie, then Accept-Language", () => {
    expect(resolveLocale("de", "en-US")).toBe("de");
    expect(resolveLocale(undefined, "de-DE,de;q=0.9,en;q=0.8")).toBe("de");
    expect(resolveLocale(undefined, "fr-FR,en;q=0.5,de;q=0.4")).toBe("en");
    expect(resolveLocale("xx", null)).toBe("en");
  });
});
