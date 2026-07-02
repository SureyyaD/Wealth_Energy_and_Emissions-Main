// utils/uuid.ts
export function getUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback (not cryptographically secure, but fine for UI IDs)
  return "id-" + Math.random().toString(36).substr(2, 9);
}
