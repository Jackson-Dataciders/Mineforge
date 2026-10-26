/**
 * Pure core of the 16×16 pixel editor (spec 04). Images are RGBA byte
 * arrays. Pixel colors are user data, not UI colors, so the theme-token rule
 * doesn't apply to them.
 */

export const ICON_SIZE = 16;
export const MAX_ICON_BYTES = 16 * 1024;
export const HISTORY_LIMIT = 50;
export const RECENT_COLORS_LIMIT = 12;

export type Rgba = readonly [number, number, number, number];
/** `ICON_SIZE × ICON_SIZE × 4` bytes, row by row. */
export type PixelImage = Uint8ClampedArray;

export const TRANSPARENT: Rgba = [0, 0, 0, 0];

export const emptyImage = (): PixelImage =>
  new Uint8ClampedArray(ICON_SIZE * ICON_SIZE * 4);

const inside = (x: number, y: number) =>
  x >= 0 && y >= 0 && x < ICON_SIZE && y < ICON_SIZE;

export function getPixel(image: PixelImage, x: number, y: number): Rgba {
  const i = (y * ICON_SIZE + x) * 4;
  return [image[i]!, image[i + 1]!, image[i + 2]!, image[i + 3]!];
}

/** All fully transparent pixels count as the same color. */
export const sameColor = (a: Rgba, b: Rgba) =>
  (a[3] === 0 && b[3] === 0) ||
  (a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3]);

/** A copy with one pixel set; the same image if nothing changes. */
export function setPixel(
  image: PixelImage,
  x: number,
  y: number,
  color: Rgba,
): PixelImage {
  if (!inside(x, y) || sameColor(getPixel(image, x, y), color)) return image;
  const next = new Uint8ClampedArray(image);
  next.set(color, (y * ICON_SIZE + x) * 4);
  return next;
}

/**
 * Sets every pixel on the line from (x0, y0) to (x1, y1) (Bresenham), so a
 * fast stroke leaves no gaps between pointer events.
 */
export function drawLine(
  image: PixelImage,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: Rgba,
): PixelImage {
  let result = image;
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let error = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    result = setPixel(result, x, y, color);
    if (x === x1 && y === y1) return result;
    const e2 = 2 * error;
    if (e2 >= dy) {
      error += dy;
      x += sx;
    }
    if (e2 <= dx) {
      error += dx;
      y += sy;
    }
  }
}

/** 4-neighbour flood fill of the area with the start pixel's color. */
export function floodFill(
  image: PixelImage,
  x: number,
  y: number,
  color: Rgba,
): PixelImage {
  if (!inside(x, y)) return image;
  const target = getPixel(image, x, y);
  if (sameColor(target, color)) return image;
  const next = new Uint8ClampedArray(image);
  const stack: [number, number][] = [[x, y]];
  const seen = new Uint8Array(ICON_SIZE * ICON_SIZE);
  while (stack.length > 0) {
    const [cx, cy] = stack.pop()!;
    if (!inside(cx, cy) || seen[cy * ICON_SIZE + cx]) continue;
    seen[cy * ICON_SIZE + cx] = 1;
    if (!sameColor(getPixel(image, cx, cy), target)) continue;
    next.set(color, (cy * ICON_SIZE + cx) * 4);
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
  return next;
}

/** Nearest-neighbour scaling of any RGBA image to 16×16 (PNG import). */
export function scaleToIcon(
  source: Uint8ClampedArray,
  width: number,
  height: number,
): PixelImage {
  const out = emptyImage();
  for (let y = 0; y < ICON_SIZE; y++) {
    for (let x = 0; x < ICON_SIZE; x++) {
      const sx = Math.min(
        width - 1,
        Math.floor(((x + 0.5) * width) / ICON_SIZE),
      );
      const sy = Math.min(
        height - 1,
        Math.floor(((y + 0.5) * height) / ICON_SIZE),
      );
      const si = (sy * width + sx) * 4;
      out.set(source.subarray(si, si + 4), (y * ICON_SIZE + x) * 4);
    }
  }
  return out;
}

// --- colors -----------------------------------------------------------------

const hex2 = (n: number) => n.toString(16).padStart(2, "0");

/** `#rrggbb` (alpha dropped), as `<input type=color>` uses. */
export const rgbHex = (c: Rgba) => `#${hex2(c[0])}${hex2(c[1])}${hex2(c[2])}`;

/** `#rrggbbaa`, for storing recent colors. */
export const rgbaHex = (c: Rgba) => `${rgbHex(c)}${hex2(c[3])}`;

/** Parses `#rgb`, `#rrggbb` or `#rrggbbaa`; `null` if invalid. */
export function parseHexColor(value: string): Rgba | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(value.trim());
  if (!m) return null;
  let digits = m[1]!;
  if (digits.length === 3) digits = [...digits].map((d) => d + d).join("");
  if (digits.length === 6) digits += "ff";
  const n = (i: number) => parseInt(digits.slice(i, i + 2), 16);
  return [n(0), n(2), n(4), n(6)];
}

/** CSS color for drawing a pixel on a canvas. */
export const cssColor = (c: Rgba) =>
  `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${(c[3] / 255).toFixed(3)})`;

/** Most recent first, no duplicates, at most 12. */
export function pushRecentColor(
  recent: readonly string[],
  color: Rgba,
): string[] {
  const hex = rgbaHex(color);
  return [hex, ...recent.filter((c) => c !== hex)].slice(
    0,
    RECENT_COLORS_LIMIT,
  );
}

// --- history ------------------------------------------------------------------

export type History = {
  past: PixelImage[];
  present: PixelImage;
  future: PixelImage[];
};

export const startHistory = (image: PixelImage): History => ({
  past: [],
  present: image,
  future: [],
});

/** Records a new image (no-op if unchanged); clears redo. */
export function commit(history: History, image: PixelImage): History {
  if (image === history.present) return history;
  return {
    past: [...history.past, history.present].slice(-HISTORY_LIMIT),
    present: image,
    future: [],
  };
}

export function undo(history: History): History {
  const previous = history.past.at(-1);
  if (!previous) return history;
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redo(history: History): History {
  const [next, ...rest] = history.future;
  if (!next) return history;
  return {
    past: [...history.past, history.present],
    present: next,
    future: rest,
  };
}

// --- PNG check ------------------------------------------------------------------

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * Whether bytes are a PNG of exactly 16×16 within the size limit: the
 * signature and an IHDR chunk first, as every valid PNG has.
 */
export function isIconPng(bytes: Uint8Array): boolean {
  if (bytes.length < 33 || bytes.length > MAX_ICON_BYTES) return false;
  if (!PNG_SIGNATURE.every((b, i) => bytes[i] === b)) return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunkType = String.fromCharCode(...bytes.subarray(12, 16));
  return (
    view.getUint32(8) === 13 &&
    chunkType === "IHDR" &&
    view.getUint32(16) === ICON_SIZE &&
    view.getUint32(20) === ICON_SIZE
  );
}
