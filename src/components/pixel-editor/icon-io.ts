"use client";

import { ICON_SIZE, scaleToIcon, type PixelImage } from "@/domain/pixel-image";

/** Decodes any image file or URL into a 16×16 pixel image (nearest-neighbour). */
export async function decodeIcon(source: Blob): Promise<PixelImage> {
  const bitmap = await createImageBitmap(source);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No 2D context");
    context.drawImage(bitmap, 0, 0);
    const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height);
    return scaleToIcon(data, bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}

/** Loads a stored icon (served by `/api/icons`). */
export async function loadIcon(url: string): Promise<PixelImage> {
  const response = await fetch(url, { cache: "no-cache" });
  if (!response.ok) throw new Error(`Icon request failed (${response.status})`);
  return decodeIcon(await response.blob());
}

/** Encodes a pixel image as a 16×16 PNG, base64 without the data URL prefix. */
export function encodeIconPng(image: PixelImage): string {
  const canvas = document.createElement("canvas");
  canvas.width = ICON_SIZE;
  canvas.height = ICON_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No 2D context");
  context.putImageData(
    new ImageData(new Uint8ClampedArray(image), ICON_SIZE, ICON_SIZE),
    0,
    0,
  );
  const url = canvas.toDataURL("image/png");
  return url.slice(url.indexOf(",") + 1);
}

/** Data URL for previewing an unsaved icon. */
export const iconDataUrl = (image: PixelImage) =>
  `data:image/png;base64,${encodeIconPng(image)}`;
