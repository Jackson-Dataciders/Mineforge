/** WCAG 2.x contrast helpers. */

export type Rgb = [number, number, number];

export function parseHex(hex: string): Rgb {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) throw new Error(`Not a #RRGGBB color: ${hex}`);
  const value = match[1]!;
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255) as Rgb;
}

const linear = (c: number) =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;

export function luminance([r, g, b]: Rgb): number {
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}

/** `fg` at `alpha` composited over an opaque `bg`. */
export function composite(fg: Rgb, bg: Rgb, alpha: number): Rgb {
  return fg.map((c, i) => c * alpha + bg[i]! * (1 - alpha)) as Rgb;
}
