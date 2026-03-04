import nodemailer from 'nodemailer';

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  from: string;
}

export function isMailConfigured(smtp: SmtpConfig): boolean {
  return smtp.host.trim().length > 0 && smtp.from.trim().length > 0;
}

function createTransport(smtp: SmtpConfig) {
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: process.env['DASHDASH_SMTP_USER']
      ? {
          user: process.env['DASHDASH_SMTP_USER'],
          pass: process.env['DASHDASH_SMTP_PASS'] ?? '',
        }
      : undefined,
  });
}

export async function sendPasswordResetEmail(smtp: SmtpConfig, to: string, resetUrl: string): Promise<void> {
  const transport = createTransport(smtp);
  await transport.sendMail({
    from: smtp.from,
    to,
    subject: 'Password reset — dashdash',
    text: `Click the link below to reset your password. It expires in 1 hour.\n\n${resetUrl}\n\nIf you did not request this, ignore this email.`,
    html: `<p>Click the link below to reset your password. It expires in 1 hour.</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you did not request this, ignore this email.</p>`,
  });
}
