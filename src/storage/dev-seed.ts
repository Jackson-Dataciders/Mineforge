import { MemoryBackend } from "./memory-backend";
import { encodeJson } from "@/lib/stable-json";

// A 16×16 sample PNG so the texture route has something to serve.
const SAMPLE_PNG = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAPElEQVR4nGPQiHL7TwlmABFuq6bBccWdEyh8fGIYBpCiGUSjGECqZhQDyNGM4QJywmE0EEcDkbqBSAkGAJMqcAdBT/wZAAAAAElFTkSuQmCC",
  ),
  (c) => c.charCodeAt(0),
);

const globalStore = globalThis as { __mineforgeDevStorage?: MemoryBackend };

/**
 * The in-memory backend for dev fake mode (ADR 0014), kept on `globalThis` so
 * it survives hot reloads. Data is lost when the dev server stops.
 */
export function devMemoryBackend(): MemoryBackend {
  globalStore.__mineforgeDevStorage ??= new MemoryBackend({
    "data/custom-mods/example_mod/mod.json": encodeJson({
      modId: "example_mod",
      name: "Example Mod",
      phase: "planning",
      dependencies: [],
    }),
    "data/modpacks/starter-pack/pack.json": encodeJson({
      id: "starter-pack",
      name: "Starter Pack",
      libraryModIds: [],
      customModIds: ["example_mod"],
    }),
    "assets/textures/minecraft/item/sample.png": SAMPLE_PNG,
  });
  return globalStore.__mineforgeDevStorage;
}
