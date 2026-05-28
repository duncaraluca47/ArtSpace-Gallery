import nodemailer from "nodemailer";

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT ?? "0");
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;

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
    : nodemailer.createTransport({ jsonTransport: true });

export async function sendEmail(to: string, subject: string, text: string, html?: string) {
  await transporter.sendMail({
    from: smtpUser ?? "no-reply@artspace.local",
    to,
    subject,
    text,
    html,
  });
}
