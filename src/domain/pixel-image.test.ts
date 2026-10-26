import { describe, expect, it } from "vitest";
import {
  commit,
  emptyImage,
  floodFill,
  getPixel,
  HISTORY_LIMIT,
  isIconPng,
  parseHexColor,
  pushRecentColor,
  redo,
  rgbaHex,
  rgbHex,
  scaleToIcon,
  setPixel,
  startHistory,
  undo,
  type Rgba,
} from "./pixel-image";

const RED: Rgba = [255, 0, 0, 255];
const BLUE: Rgba = [0, 0, 255, 255];

describe("pixels", () => {
  it("sets pixels immutably", () => {
    const empty = emptyImage();
    const red = setPixel(empty, 3, 4, RED);
    expect(getPixel(red, 3, 4)).toEqual(RED);
    expect(getPixel(empty, 3, 4)).toEqual([0, 0, 0, 0]);
    expect(setPixel(red, 3, 4, RED)).toBe(red);
    expect(setPixel(red, 16, 0, RED)).toBe(red);
  });

  it("flood-fills a 4-connected area only", () => {
    let image = emptyImage();
    // A vertical red wall at x = 5 splits the image.
    for (let y = 0; y < 16; y++) image = setPixel(image, 5, y, RED);
    const filled = floodFill(image, 0, 0, BLUE);
    expect(getPixel(filled, 4, 15)).toEqual(BLUE);
    expect(getPixel(filled, 5, 0)).toEqual(RED);
    expect(getPixel(filled, 6, 0)).toEqual([0, 0, 0, 0]);
    expect(floodFill(filled, 0, 0, BLUE)).toBe(filled);
  });

  it("scales any image to 16×16 with nearest neighbour", () => {
    const source = new Uint8ClampedArray(32 * 32 * 4);
    source.set(RED, (31 * 32 + 31) * 4); // bottom-right pixel
    const scaled = scaleToIcon(source, 32, 32);
    expect(getPixel(scaled, 15, 15)).toEqual(RED);
    expect(getPixel(scaled, 0, 0)).toEqual([0, 0, 0, 0]);
  });
});

describe("colors", () => {
  it("converts between RGBA and hex", () => {
    expect(rgbHex([255, 16, 0, 128])).toBe("#ff1000");
    expect(rgbaHex([255, 16, 0, 128])).toBe("#ff100080");
    expect(parseHexColor("#f00")).toEqual(RED);
    expect(parseHexColor("#ff100080")).toEqual([255, 16, 0, 128]);
    expect(parseHexColor("red")).toBeNull();
  });

  it("keeps the 12 most recent colors without duplicates", () => {
    let recent: string[] = [];
    for (let i = 0; i < 14; i++)
      recent = pushRecentColor(recent, [i, 0, 0, 255]);
    recent = pushRecentColor(recent, [5, 0, 0, 255]);
    expect(recent).toHaveLength(12);
    expect(recent[0]).toBe("#050000ff");
    expect(recent.filter((c) => c === "#050000ff")).toHaveLength(1);
  });
});

describe("history", () => {
  it("undoes and redoes, and a new edit clears redo", () => {
    const a = emptyImage();
    const b = setPixel(a, 0, 0, RED);
    const c = setPixel(b, 1, 0, RED);
    let h = commit(commit(startHistory(a), b), c);
    h = undo(h);
    expect(h.present).toBe(b);
    h = redo(h);
    expect(h.present).toBe(c);
    h = commit(undo(h), setPixel(b, 2, 0, BLUE));
    expect(h.future).toEqual([]);
    expect(undo(startHistory(a)).present).toBe(a);
  });

  it("keeps at most 50 steps", () => {
    let h = startHistory(emptyImage());
    for (let i = 0; i < 60; i++)
      h = commit(h, setPixel(h.present, i % 16, Math.floor(i / 16), RED));
    expect(h.past).toHaveLength(HISTORY_LIMIT);
  });
});

describe("isIconPng", () => {
  function png(width: number, height: number, length = 64): Uint8Array {
    const bytes = new Uint8Array(length);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const view = new DataView(bytes.buffer);
    view.setUint32(8, 13);
    bytes.set([73, 72, 68, 82], 12); // "IHDR"
    view.setUint32(16, width);
    view.setUint32(20, height);
    return bytes;
  }

  it("accepts only 16×16 PNGs up to 16 KB", () => {
    expect(isIconPng(png(16, 16))).toBe(true);
    expect(isIconPng(png(32, 32))).toBe(false);
    expect(isIconPng(png(16, 16, 20_000))).toBe(false);
    const notPng = png(16, 16);
    notPng[1] = 0;
    expect(isIconPng(notPng)).toBe(false);
  });
});
