import { NextRequest } from "next/server";
import { fail, handler, ok } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { sendContactEmail } from "@/lib/services/email";
import { contactSchema } from "@/lib/validators";

export const POST = handler(async (req: NextRequest) => {
  const rl = rateLimit(`contact:${clientIp(req)}`, 3, 600);
  if (!rl.allowed) {
    return fail(
      "RATE_LIMITED",
      `Too many requests. Try again in ${rl.retryAfterSeconds}s.`,
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return fail(
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "Enter valid contact details.",
    );
  }

  await sendContactEmail(parsed.data);

  return ok({ message: "Your message has been sent." });
});
