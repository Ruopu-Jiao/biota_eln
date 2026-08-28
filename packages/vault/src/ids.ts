const CROCKFORD_BASE32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const BIOTA_ID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const MAX_ULID_TIMESTAMP = 2 ** 48 - 1;

export interface BiotaIdOptions {
  timestamp?: number;
  /**
   * Testable random source. It must return a number in [0, 1). Production
   * callers should omit it so Web Crypto is used when available.
   */
  random?: () => number;
}

function encodeTimestamp(timestamp: number) {
  let remaining = timestamp;
  let encoded = "";

  for (let index = 0; index < 10; index += 1) {
    encoded = CROCKFORD_BASE32[remaining % 32] + encoded;
    remaining = Math.floor(remaining / 32);
  }

  return encoded;
}

function randomValues(random?: () => number) {
  const values = new Uint8Array(16);

  if (!random && globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    for (let index = 0; index < values.length; index += 1) {
      values[index] = bytes[index] & 31;
    }
    return values;
  }

  const source = random ?? Math.random;
  for (let index = 0; index < values.length; index += 1) {
    const value = source();
    if (!Number.isFinite(value) || value < 0 || value >= 1) {
      throw new RangeError(
        "The Biota ID random source must return a number in [0, 1)."
      );
    }
    values[index] = Math.floor(value * 32);
  }

  return values;
}

/** Creates a sortable, dependency-free ULID suitable for stable vault identity. */
export function createBiotaId(options: BiotaIdOptions = {}) {
  const timestamp = options.timestamp ?? Date.now();

  if (
    !Number.isSafeInteger(timestamp) ||
    timestamp < 0 ||
    timestamp > MAX_ULID_TIMESTAMP
  ) {
    throw new RangeError(
      "A Biota ID timestamp must be an integer in the ULID 48-bit range."
    );
  }

  const randomPart = Array.from(randomValues(options.random), (value) => {
    return CROCKFORD_BASE32[value];
  }).join("");

  return `${encodeTimestamp(timestamp)}${randomPart}`;
}

export function isBiotaId(value: unknown): value is string {
  return typeof value === "string" && BIOTA_ID_PATTERN.test(value);
}
