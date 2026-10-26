import { z } from "zod";
import { MAX_ICON_BYTES } from "@/domain/pixel-image";

/**
 * Icon in a request body: base64 PNG to set, `null` to remove, absent to
 * keep. The PNG itself is checked by the storage layer.
 */
export const iconBodySchema = z
  .string()
  .max(Math.ceil(MAX_ICON_BYTES / 3) * 4 + 4)
  .regex(/^[A-Za-z0-9+/]*={0,2}$/)
  .nullable()
  .optional();

export function decodeIcon(
  icon: z.infer<typeof iconBodySchema>,
): Uint8Array | null | undefined {
  if (icon === undefined || icon === null) return icon;
  return new Uint8Array(Buffer.from(icon, "base64"));
}
