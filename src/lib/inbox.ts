import "server-only";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { listApplications, saveSettings, updateApplication } from "./store";
import type { Application, Reply } from "./types";

const FREE_MAIL = /^(gmail|googlemail|outlook|hotmail|live|yahoo|icloud|me|proton|protonmail|gmx|aol)\./i;
const BOUNCE_FROM = /(mailer-daemon|postmaster|mail delivery)/i;

export interface InboxResult {
  checked: number;
  replies: { appId: string; company: string; from: string; kind: Reply["kind"] }[];
}

const norm = (id?: string) => (id ?? "").trim().replace(/^<|>$/g, "").toLowerCase();

function cleanSnippet(text: string): string {
  const lines: string[] = [];
  for (const line of text.split("\n")) {
    if (/^>/.test(line.trim())) continue;
    if (/^on .+wrote:$/i.test(line.trim()) || /^-{2,}\s*original message/i.test(line.trim())) break;
    lines.push(line);
  }
  return lines.join(" ").replace(/\s+/g, " ").trim().slice(0, 400);
}

/** Look for replies and bounces to emails sent from the app; update application statuses. */
export async function syncInbox(): Promise<InboxResult> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");
  if (!user || !pass) throw new Error("Set GMAIL_USER and GMAIL_APP_PASSWORD to sync the inbox.");

  const apps = listApplications().filter((a) => a.sentAt);
  const result: InboxResult = { checked: 0, replies: [] };
  if (!apps.length) {
    saveSettings({ lastInboxSync: new Date().toISOString() });
    return result;
  }

  // Index outgoing Message-IDs and recipient domains → application
  const byMessageId = new Map<string, Application>();
  const byDomain = new Map<string, Application[]>();
  for (const a of apps) {
    if (a.messageId) byMessageId.set(norm(a.messageId), a);
    for (const f of a.followUps) if (f.messageId) byMessageId.set(norm(f.messageId), a);
    const domain = a.toEmail.split("@")[1]?.toLowerCase();
    if (domain && !FREE_MAIL.test(domain)) byDomain.set(domain, [...(byDomain.get(domain) ?? []), a]);
  }
  const known = new Set(apps.flatMap((a) => (a.replies ?? []).map((r) => r.id)));
  const since = new Date(Math.min(...apps.map((a) => Date.parse(a.sentAt!))) - 86_400_000);

  const client = new ImapFlow({ host: "imap.gmail.com", port: 993, secure: true, auth: { user, pass }, logger: false });
  await client.connect();
  const lock = await client.getMailboxLock("INBOX");
  try {
    const uids = ((await client.search({ since }, { uid: true })) || []).slice(-800);
    result.checked = uids.length;
    if (!uids.length) return result;

    const candidates: { uid: number; app: Application; kind: Reply["kind"]; msgId: string; from: string; subject: string; date: Date }[] = [];
    for await (const msg of client.fetch(uids, { uid: true, envelope: true, headers: ["references"] }, { uid: true })) {
      const env = msg.envelope;
      if (!env) continue;
      const fromAddr = env.from?.[0]?.address?.toLowerCase() ?? "";
      const msgId = norm(env.messageId) || `uid-${msg.uid}`;
      if (!fromAddr || fromAddr === user.toLowerCase() || known.has(msgId)) continue;
      const date = env.date ? new Date(env.date) : new Date();
      const refs = `${env.inReplyTo ?? ""} ${msg.headers?.toString() ?? ""}`.toLowerCase();
      const fromName = env.from?.[0]?.name ?? "";

      let app = [...byMessageId.entries()].find(([id]) => refs.includes(id))?.[1];
      let kind: Reply["kind"] = "reply";
      if (BOUNCE_FROM.test(fromAddr) || BOUNCE_FROM.test(fromName)) kind = "bounce";
      if (!app && kind === "reply") {
        const domain = fromAddr.split("@")[1] ?? "";
        const sameDomain = byDomain.get(domain) ?? [...byDomain.entries()].find(([d]) => domain.endsWith(`.${d}`))?.[1];
        app = sameDomain?.find((a) => date.getTime() > Date.parse(a.sentAt!));
      }
      if (app || kind === "bounce") candidates.push({ uid: msg.uid, app: app!, kind, msgId, from: fromName ? `${fromName} <${fromAddr}>` : fromAddr, subject: env.subject ?? "", date });
    }

    for (const c of candidates) {
      const full = await client.fetchOne(String(c.uid), { source: true }, { uid: true });
      if (!full || !full.source) continue;
      const parsed = await simpleParser(full.source);
      let app = c.app;
      if (c.kind === "bounce" && !app) {
        const raw = full.source.toString("utf8").toLowerCase();
        app = [...byMessageId.entries()].find(([id]) => raw.includes(id))?.[1] as Application;
        if (!app) continue; // a bounce for something this app didn't send
      }
      const reply: Reply = { id: c.msgId, at: c.date.toISOString(), from: c.from, subject: c.subject, snippet: cleanSnippet(parsed.text ?? ""), kind: c.kind };
      const fresh = listApplications().find((a) => a.id === app.id)!;
      const patch: Partial<Application> = { replies: [...(fresh.replies ?? []), reply] };
      if (c.kind === "bounce") patch.bounced = true;
      else if (fresh.status === "applied") patch.status = "replied";
      updateApplication(app.id, patch, c.kind === "bounce" ? `Bounced: ${c.subject}` : `Reply from ${c.from}`);
      known.add(c.msgId);
      result.replies.push({ appId: app.id, company: app.company, from: c.from, kind: c.kind });
    }
  } finally {
    lock.release();
    await client.logout().catch(() => {});
  }
  saveSettings({ lastInboxSync: new Date().toISOString() });
  return result;
}
