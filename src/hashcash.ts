import { createHash } from "crypto"

const LIMIT = 5

function calcHash(body: string): number {
  return createHash("sha256").update(body).digest().readUInt16BE(0)
}

export function verify(body: string): boolean {
  return calcHash(body) < LIMIT
}
