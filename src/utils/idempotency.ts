/** Generates a fresh idempotency key (UUID v4). One key == one logical operation. */
export function generateIdempotencyKey(): string {
  return crypto.randomUUID();
}

