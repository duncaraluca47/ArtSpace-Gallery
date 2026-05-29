import { lookup } from "dns/promises";
import nodemailer from "nodemailer";

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT ?? "0");
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpFrom = process.env.SMTP_FROM ?? smtpUser ?? "no-reply@artspace.local";
const isProduction = process.env.NODE_ENV === "production";

let transporterPromise: Promise<nodemailer.Transporter> | null = null;

async function resolveIpv4Host(host: string) {
  try {
    const result = await lookup(host, { family: 4 });
    return result.address;
  } catch {
    return host;
  }
}

async function getTransporter() {
  if (transporterPromise) {
    return transporterPromise;
  }

  transporterPromise = (async () => {
    if (!smtpHost || smtpPort <= 0 || !smtpUser || !smtpPass) {
      if (isProduction) {
        throw new Error("SMTP configuration is required in production.");
      }

      return nodemailer.createTransport({ jsonTransport: true });
    }

    const resolvedHost = await resolveIpv4Host(smtpHost);
    const transporter = nodemailer.createTransport({
      host: resolvedHost,
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
      tls: {
        servername: smtpHost,
      },
    });

    try {
      await transporter.verify();
      console.log(`SMTP transporter verified using ${resolvedHost}`);
    } catch (err) {
      console.error("SMTP transporter verification failed:", err);
      throw err;
    }

    return transporter;
  })();

  return transporterPromise;
}

export async function sendEmail(to: string, subject: string, text: string, html?: string) {
  try {
    const transporter = await getTransporter();

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
