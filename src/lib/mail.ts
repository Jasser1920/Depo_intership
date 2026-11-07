import "server-only";
import fs from "node:fs";
import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer";
import { CV_FILE } from "./store";

export class MailError extends Error {}

function transporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");
  if (!user || !pass) throw new MailError("Set GMAIL_USER and GMAIL_APP_PASSWORD in .env.local first.");
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });
}

export function cvFileName(signature: string): string {
  const name = (signature.split("\n")[1] ?? "CV").trim().replace(/\s+/g, "_");
  return `${name}_CV.pdf`;
}

export async function verifySmtp(): Promise<void> {
  try {
    await transporter().verify();
  } catch (e) {
    if (e instanceof MailError) throw e;
    throw new MailError(`Gmail rejected the connection: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export interface OutgoingMail {
  to: string;
  cc?: string;
  subject: string;
  text: string;
  attachCv: boolean;
  cvName: string;
  extraAttachments?: Mail.Attachment[];
  inReplyTo?: string;
}

export async function sendMail(m: OutgoingMail): Promise<string> {
  const attachments: Mail.Attachment[] = [];
  if (m.attachCv) {
    if (!fs.existsSync(CV_FILE)) throw new MailError("No CV uploaded — add it in Settings first.");
    attachments.push({ filename: m.cvName, path: CV_FILE, contentType: "application/pdf" });
  }
  attachments.push(...(m.extraAttachments ?? []));

  const senderName = process.env.SENDER_NAME || "";
  try {
    const info = await transporter().sendMail({
      from: senderName ? `"${senderName}" <${process.env.GMAIL_USER}>` : process.env.GMAIL_USER,
      to: m.to,
      cc: m.cc || undefined,
      subject: m.subject,
      text: m.text,
      attachments,
      inReplyTo: m.inReplyTo,
      references: m.inReplyTo,
    });
    return info.messageId;
  } catch (e) {
    if (e instanceof MailError) throw e;
    throw new MailError(`Sending failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export function composeBody(greeting: string, body: string, signature: string): string {
  return [greeting, body, signature].map((p) => p.trim()).filter(Boolean).join("\n\n") + "\n";
}
