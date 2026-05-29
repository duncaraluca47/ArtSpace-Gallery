import nodemailer from "nodemailer";

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT ?? "0");
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpFrom = process.env.SMTP_FROM ?? smtpUser ?? "no-reply@artspace.local";
const isProduction = process.env.NODE_ENV === "production";

const transporter =
  smtpHost && smtpPort > 0 && smtpUser && smtpPass
    ? nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      })
    : isProduction
      ? null
      : nodemailer.createTransport({ jsonTransport: true });

export async function sendEmail(to: string, subject: string, text: string, html?: string) {
  if (!transporter) {
    throw new Error("SMTP configuration is required in production.");
  }

  await transporter.sendMail({
    from: smtpFrom,
    to,
    subject,
    text,
    html,
  });
}
