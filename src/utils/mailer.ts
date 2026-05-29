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
        // sensible network timeouts to fail fast in cloud environments
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 10_000,
      })
    : isProduction
      ? null
      : nodemailer.createTransport({ jsonTransport: true });

if (transporter) {
  // verify transporter connectivity on startup to make errors visible in logs
  transporter.verify()
    .then(() => {
      console.log("SMTP transporter verified");
    })
    .catch((err) => {
      console.error("SMTP transporter verification failed:", err);
    });
}

export async function sendEmail(to: string, subject: string, text: string, html?: string) {
  if (!transporter) {
    throw new Error("SMTP configuration is required in production.");
  }

  try {
    await transporter.sendMail({
      from: smtpFrom,
      to,
      subject,
      text,
      html,
    });
  } catch (err) {
    console.error("Failed to send email", { to, subject, error: err });
    throw err;
  }
}
