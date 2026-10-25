import { Box, Tag } from "lucide-react";

/** URL of an extracted texture, served behind auth (ADR 0004), never from public/. */
export const textureUrl = (iconPath: string) => `/api/textures/${iconPath}`;

/**
 * An item icon from `assets/textures/` (pixelated), or a placeholder box.
 * `kind: "tag"` shows a tag symbol instead. Decorative: the caller labels it.
 */
export function ItemIcon({
  icon,
  kind = "item",
  size = 32,
  smooth = false,
}: {
  icon: string | null | undefined;
  kind?: "item" | "tag";
  size?: number;
  /** Logos are not pixel art; scale them smoothly. */
  smooth?: boolean;
}) {
  if (kind === "tag") {
    return (
      <Tag
        aria-hidden
        className="shrink-0 text-secondary"
        style={{ width: size * 0.75, height: size * 0.75, margin: size / 8 }}
      />
    );
  }
  if (!icon) {
    return (
      <Box
        aria-hidden
        className="shrink-0 text-muted"
        style={{ width: size * 0.75, height: size * 0.75, margin: size / 8 }}
      />
    );
  }
  return (
    // A plain <img>: next/image would fetch through /_next/image without the session.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={textureUrl(icon)}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      className={`shrink-0 object-contain ${smooth ? "" : "[image-rendering:pixelated]"}`}
      style={{ width: size, height: size }}
    />
  );
}
