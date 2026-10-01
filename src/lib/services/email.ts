import nodemailer from "nodemailer";

const smtpHost = process.env.SMTP_HOST ?? "smtp.gmail.com";
const smtpPort = Number(process.env.SMTP_PORT ?? "465");
const smtpSecure =
  (process.env.SMTP_SECURE ?? (smtpPort === 465 ? "true" : "false")) === "true";

function getTransport() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) {
    throw new Error(
      "SMTP_USER and SMTP_PASS must be configured to send email.",
    );
  }

  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: { user, pass },
  });
}

function getAppUrl() {
  const appUrl = process.env.APP_URL;
  if (!appUrl)
    throw new Error("APP_URL must be configured to send password reset links.");
  return appUrl.replace(/\/$/, "");
}

export async function sendPasswordResetEmail({
  recipient,
  recipientName,
  token,
}: {
  recipient: string;
  recipientName: string;
  token: string;
}) {
  const from = process.env.MAIL_FROM ?? process.env.SMTP_USER;
  if (!from)
    throw new Error("MAIL_FROM or SMTP_USER must be configured to send email.");

  const resetUrl = `${getAppUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  const transport = getTransport();

  await transport.sendMail({
    from,
    to: recipient,
    subject: "Reset your CafeFlow password",
    text: [
      `Hello ${recipientName},`,
      "",
      "We received a request to reset your CafeFlow password.",
      `Open this link to choose a new password: ${resetUrl}`,
      "",
      "This link expires in 30 minutes and can only be used once.",
      "If you did not request this, you can safely ignore this email.",
    ].join("\n"),
    html: `<p>Hello ${escapeHtml(recipientName)},</p>
      <p>We received a request to reset your CafeFlow password.</p>
      <p><a href="${resetUrl}">Choose a new password</a></p>
      <p>This link expires in 30 minutes and can only be used once.</p>
      <p>If you did not request this, you can safely ignore this email.</p>`,
  });
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character] ?? character,
  );
}
