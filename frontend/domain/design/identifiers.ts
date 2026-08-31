let fallbackSequence = 0;

const normalizePrefix = (prefix: string) => {
  const normalized = prefix
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "id";
};

/**
 * Creates readable, deterministic IDs for fixtures, examples, and evaluations.
 * Length-prefixing makes segment boundaries unambiguous.
 */
export const createTestId = (...parts: string[]) =>
  `test:${parts.map((part) => `${part.length}:${part}`).join("|")}`;

/**
 * Creates a collision-resistant production ID without depending on a framework
 * or database. Browsers and current Node runtimes use crypto.randomUUID().
 */
export const createProductionId = (prefix = "id") => {
  const normalizedPrefix = normalizePrefix(prefix);
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `${normalizedPrefix}_${uuid}`;

  fallbackSequence += 1;
  const randomPart = Math.random().toString(36).slice(2, 12);
  return `${normalizedPrefix}_${Date.now().toString(36)}_${fallbackSequence.toString(36)}_${randomPart}`;
};

export const hasRequiredId = (id: string) => id.trim().length > 0;
