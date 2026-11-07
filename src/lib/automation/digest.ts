import "server-only";
import nodemailer from "nodemailer";
import type { InboxResult } from "../inbox";
import { jobScore } from "../search/classify";
import { getSettings, listApplications, listJobs } from "../store";
import type { Application, Job, SearchRun } from "../types";

const APP_URL = () => (process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, "");

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export interface DigestContent {
  jobs: Job[];
  followUps: Application[];
  inbox?: InboxResult;
  failedSources: string[];
}

export function collectDigest(run: SearchRun, inbox?: InboxResult): DigestContent {
  const s = getSettings();
  const since = Date.parse(run.at) - 26 * 3_600_000;
  const jobs = listJobs()
    .filter((j) => j.status === "new" && Date.parse(j.firstSeenAt) >= since)
    .filter((j) => jobScore(j) >= s.search.digestMinScore && (j.ai?.visa ?? j.visaHint) !== "blocker")
    .sort((a, b) => jobScore(b) - jobScore(a))
    .slice(0, 25);
  const followUps = listApplications().filter((a) => {
    if (a.status !== "applied" || !a.sentAt) return false;
    const last = a.followUps.at(-1)?.sentAt ?? a.sentAt;
    return Date.now() - Date.parse(last) >= s.followUpDays * 86_400_000;
  });
  const failedSources = run.sources.filter((x) => !x.ok && !x.error?.startsWith("skipped")).map((x) => `${x.name}: ${x.error}`);
  return { jobs, followUps, inbox, failedSources };
}

export function renderDigest(d: DigestContent): { subject: string; html: string; text: string } {
  const url = APP_URL();
  const date = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const replies = d.inbox?.replies ?? [];
  const parts = [
    d.jobs.length && `${d.jobs.length} new match${d.jobs.length > 1 ? "es" : ""}`,
    replies.length && `${replies.length} repl${replies.length > 1 ? "ies" : "y"}`,
    d.followUps.length && `${d.followUps.length} follow-up${d.followUps.length > 1 ? "s" : ""} due`,
  ].filter(Boolean);
  const subject = `Internship digest — ${parts.join(", ") || "nothing new"} (${date})`;

  const row = (j: Job) => `<tr>
<td style="padding:8px;border-bottom:1px solid #e2e8f0"><a href="${esc(j.url)}" style="color:#1d4ed8;font-weight:600">${esc(j.title)}</a><br>
<span style="color:#64748b">${esc(j.company)} · ${esc(j.location || j.country)}</span>${j.ai?.reason ? `<br><span style="font-size:13px">${esc(j.ai.reason)}</span>` : ""}</td>
<td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700">${jobScore(j)}%${j.ai ? "" : "<br><span style='font-size:11px;color:#64748b'>keyword</span>"}</td></tr>`;

  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:680px;color:#0f172a">
<h2 style="margin:0 0 4px">🎯 Internship digest</h2><p style="color:#64748b;margin:0 0 16px">${esc(date)}</p>
${replies.length ? `<h3>📬 Replies</h3><ul>${replies.map((r) => `<li><b>${esc(r.company)}</b> — ${r.kind === "bounce" ? "⚠ bounced" : esc(r.from)} · <a href="${url}/applications/${r.appId}">open</a></li>`).join("")}</ul>` : ""}
${d.jobs.length ? `<h3>✨ New matches</h3><table style="width:100%;border-collapse:collapse">${d.jobs.map(row).join("")}</table><p><a href="${url}/jobs" style="color:#1d4ed8">Review all in the app →</a></p>` : "<p>No new matches above your score threshold today.</p>"}
${d.followUps.length ? `<h3>⏰ Follow-ups due</h3><ul>${d.followUps.map((a) => `<li><a href="${url}/applications/${a.id}">${esc(a.company)} — ${esc(a.role)}</a> (sent ${new Date(a.sentAt!).toLocaleDateString("en-GB")})</li>`).join("")}</ul>` : ""}
${d.failedSources.length ? `<p style="color:#b45309;font-size:13px">Sources with errors: ${esc(d.failedSources.join("; "))}</p>` : ""}
</div>`;

  const text = [
    subject,
    "",
    ...replies.map((r) => `REPLY  ${r.company} — ${r.kind === "bounce" ? "bounced" : r.from}  ${url}/applications/${r.appId}`),
    ...d.jobs.map((j) => `${String(jobScore(j)).padStart(3)}%  ${j.title} — ${j.company} (${j.location || j.country})\n      ${j.url}`),
    ...d.followUps.map((a) => `FOLLOW UP  ${a.company} — ${url}/applications/${a.id}`),
  ].join("\n");
  return { subject, html, text };
}

export function hasContent(d: DigestContent) {
  return d.jobs.length > 0 || d.followUps.length > 0 || (d.inbox?.replies.length ?? 0) > 0;
}

/** Email the digest to yourself. */
export async function sendDigest(d: DigestContent): Promise<void> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");
  if (!user || !pass) throw new Error("Gmail is not configured.");
  const { subject, html, text } = renderDigest(d);
  const t = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user, pass } });
  await t.sendMail({ from: `"Internship Hunter" <${user}>`, to: user, subject, html, text });
}
