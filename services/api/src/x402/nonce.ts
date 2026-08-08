/** In-process nonce replay guard (solo / single-node). */
const used = new Set<string>();

export function claimNonce(nonce: string): boolean {
  const key = nonce.toLowerCase();
  if (!key || used.has(key)) return false;
  used.add(key);
  // Bound memory for long-running processes
  if (used.size > 50_000) {
    const first = used.values().next().value;
    if (first) used.delete(first);
  }
  return true;
}

export function resetNoncesForTests() {
  used.clear();
}
