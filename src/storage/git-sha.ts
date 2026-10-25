import { createHash } from "node:crypto";

/** Git blob SHA-1 (`git hash-object`), identical to the SHAs GitHub reports. */
export function gitBlobSha(content: Uint8Array): string {
  return createHash("sha1")
    .update(`blob ${content.byteLength}\0`)
    .update(content)
    .digest("hex");
}
