/** Reads a POS device token from "Authorization: Bearer …" or "X-Device-Token". */
export function deviceTokenFrom(req: Request): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  const header = req.headers.get("x-device-token");
  if (header) return header.trim();
  return null;
}
