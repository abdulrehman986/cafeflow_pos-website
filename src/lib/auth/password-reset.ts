import { db } from "@/lib/db";
import { generateOpaqueToken, sha256 } from "./password";

export const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;

export async function createPasswordResetToken(profileId: string) {
  const token = generateOpaqueToken(32);
  await db.passwordResetToken.create({
    data: {
      profileId,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
    },
  });
  return token;
}
