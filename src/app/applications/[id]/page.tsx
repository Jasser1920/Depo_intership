"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ErrorBox, Issues, ScoreBadge, VisaBadge } from "@/components/ui";
import { checkDraft, countWords, LETTER_MAX, LETTER_MIN } from "@/lib/checks";
import { api, daysSince, flag } from "@/lib/client";
import { STATUSES, STATUS_LABELS, type Application, type EnvStatus, type Provider, type Settings } from "@/lib/types";

type Draft = Pick<
  Application,
  "toEmail" | "cc" | "subject" | "greeting" | "letterBody" | "linkedinMessage" | "connectionNote" | "attachLetterPdf" | "company" | "role" | "country" | "contactName"
>;

function toDraft(a: Application): Draft {
  const { toEmail, cc, subject, greeting, letterBody, linkedinMessage, connectionNote, attachLetterPdf, company, role, country, contactName } = a;
  return { toEmail, cc, subject, greeting, letterBody, linkedinMessage, connectionNote, attachLetterPdf, company, role, country, contactName };
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn px-2 py-1 text-xs"
      onClick={() => navigator.clipboard.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); })}
    >
      {done ? "Copied" : "Copy"}
    </button>
  );
}

export default function Review() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [app, setApp] = useState<Application | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [env, setEnv] = useState<EnvStatus | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [regenProvider, setRegenProvider] = useState<Provider>("claude");
  const [feedback, setFeedback] = useState("");
  const [followUp, setFollowUp] = useState<{ subject: string; body: string } | null>(null);
  const [confirmFollowUp, setConfirmFollowUp] = useState(false);

  useEffect(() => {
    api<Application>(`/api/applications/${id}`)
      .then((a) => { setApp(a); setDraft(toDraft(a)); setRegenProvider(a.provider); })
      .catch((e) => setError(e.message));
    api<{ settings: Settings; env: EnvStatus }>("/api/settings").then((d) => { setSettings(d.settings); setEnv(d.env); });
  }, [id]);

  const dirty = useMemo(() => app && draft && JSON.stringify(toDraft(app)) !== JSON.stringify(draft), [app, draft]);
  const liveIssues = useMemo(() => (draft ? checkDraft({ ...draft }) : []), [draft]);

  if (error && !app) return <ErrorBox message={error} />;
  if (!app || !draft) return <p className="text-sm text-muted">Loading…</p>;

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft({ ...draft, [k]: v });
  const words = countWords(draft.letterBody);

  async function run<T>(label: string, fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(label); setError(""); setNotice("");
    try { return await fn(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(""); }
  }

  async function save(): Promise<Application | undefined> {
    return run("save", async () => {
      const updated = await api<Application>(`/api/applications/${id}`, { method: "PATCH", json: draft });
      setApp(updated); setDraft(toDraft(updated));
      return updated;
    });
  }

  async function regenerate() {
    if (dirty && !window.confirm("Regenerating replaces your unsaved edits. Continue?")) return;
    await run("regen", async () => {
      const updated = await api<Application>(`/api/applications/${id}/regenerate`, { method: "POST", json: { provider: regenProvider, feedback } });
      setApp(updated); setDraft(toDraft(updated)); setFeedback("");
      setNotice("New version generated.");
    });
  }

  async function send() {
    const saved = dirty ? await save() : app;
    if (!saved) return;
    await run("send", async () => {
      const updated = await api<Application>(`/api/applications/${id}/send`, { method: "POST", json: { confirm: true } });
      setApp(updated); setDraft(toDraft(updated)); setConfirming(false);
      setNotice(`Sent to ${updated.toEmail}. It's in your Gmail "Sent" folder.`);
    });
  }

  async function setStatus(status: Application["status"]) {
    await run("status", async () => {
      const updated = await api<Application>(`/api/applications/${id}`, { method: "PATCH", json: { status } });
      setApp(updated);
    });
  }

  async function draftFollowUp() {
    await run("fu", async () => setFollowUp(await api(`/api/applications/${id}/followup`, { method: "POST", json: { action: "draft", provider: regenProvider } })));
  }

  async function sendFollowUp() {
    if (!followUp) return;
    await run("fu-send", async () => {
      const updated = await api<Application>(`/api/applications/${id}/followup`, { method: "POST", json: { action: "send", ...followUp, confirm: true } });
      setApp(updated); setFollowUp(null); setConfirmFollowUp(false);
      setNotice("Follow-up sent in the same Gmail thread.");
    });
  }

  async function remove() {
    if (!window.confirm(`Delete the application to ${app!.company}?`)) return;
    await run("delete", async () => { await api(`/api/applications/${id}`, { method: "DELETE" }); router.push("/"); });
  }

  const canSend = env?.gmail && env?.cvUploaded && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.toEmail);
  const sendBlocker = !env?.gmail ? "Set up Gmail in .env.local (see Settings)." : !env?.cvUploaded ? "Upload your CV in Settings." : !canSend ? "Add a valid recipient email." : "";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/" className="text-sm text-muted hover:text-ink">← Tracker</Link>
        <h1 className="text-xl font-semibold">{flag(app.country)} {app.company} <span className="font-normal text-muted">· {app.role}</span></h1>
        <select className="field ml-auto w-auto" value={app.status} onChange={(e) => setStatus(e.target.value as Application["status"])} aria-label="Status">
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
      </div>

      {notice && <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{notice}</div>}
      <ErrorBox message={error} />

      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        {/* Left: analysis */}
        <aside className="space-y-4">
          <div className="card space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Match</span>
              <ScoreBadge score={app.match.score} />
              <VisaBadge flag={app.visa.flag} />
            </div>
            <p className="text-sm text-muted">{app.match.summary}</p>
            {app.match.matched.length > 0 && (
              <div>
                <div className="label">You cover</div>
                <div className="flex flex-wrap gap-1">{app.match.matched.map((m) => <span key={m} className="rounded bg-green-50 px-1.5 py-0.5 text-xs text-green-800">✓ {m}</span>)}</div>
              </div>
            )}
            {app.match.missing.length > 0 && (
              <div>
                <div className="label">Missing</div>
                <div className="flex flex-wrap gap-1">{app.match.missing.map((m) => <span key={m} className="rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-800">✗ {m}</span>)}</div>
              </div>
            )}
            <div>
              <div className="label">Visa</div>
              <p className="text-sm">{app.visa.note}</p>
            </div>
            <div>
              <div className="label">Hook used</div>
              <p className="text-sm">{app.companyChallenge}</p>
            </div>
          </div>

          <div className="card space-y-3">
            <div className="text-sm font-semibold">Regenerate</div>
            <select className="field" value={regenProvider} onChange={(e) => setRegenProvider(e.target.value as Provider)}>
              <option value="claude">Claude</option>
              <option value="gemini">Gemini</option>
            </select>
            <textarea className="field min-h-20" placeholder="Optional: what to change (e.g. more Kubernetes, shorter hook)" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
            <button className="btn w-full" onClick={regenerate} disabled={busy !== ""}>{busy === "regen" ? "Writing…" : "Regenerate letter & subjects"}</button>
          </div>

          <details className="card text-sm">
            <summary className="cursor-pointer font-semibold">Job source</summary>
            {app.source.url && <a href={app.source.url} target="_blank" rel="noreferrer" className="mt-2 block truncate text-brand underline">{app.source.url}</a>}
            <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap text-xs text-muted">{app.source.jobText || "(none)"}</pre>
          </details>

          <details className="card text-sm">
            <summary className="cursor-pointer font-semibold">History</summary>
            <ul className="mt-2 space-y-1 text-xs text-muted">
              {app.history.map((h) => <li key={h.at + h.event}>{new Date(h.at).toLocaleString()} — {h.event}</li>)}
            </ul>
          </details>
          <button className="btn btn-danger w-full" onClick={remove} disabled={busy !== ""}>Delete application</button>
        </aside>

        {/* Right: the email */}
        <section className="space-y-4">
          <div className="card space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="to">To *</label>
                <input id="to" type="email" className="field" placeholder="careers@company.com" value={draft.toEmail} onChange={(e) => set("toEmail", e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="cc">CC</label>
                <input id="cc" className="field" value={draft.cc} onChange={(e) => set("cc", e.target.value)} />
              </div>
            </div>

            <div>
              <div className="label">Subject — pick an angle or edit</div>
              <div className="space-y-1">
                {app.subjects.map((s) => (
                  <label key={s.angle + s.text} className={`flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm ${draft.subject === s.text ? "border-brand bg-blue-50" : "border-line"}`}>
                    <input type="radio" name="subject" className="mt-1" checked={draft.subject === s.text} onChange={() => set("subject", s.text)} />
                    <span><span className="text-xs text-muted">{s.angle}</span><br />{s.text}</span>
                  </label>
                ))}
              </div>
              <input className="field mt-2" value={draft.subject} onChange={(e) => set("subject", e.target.value)} aria-label="Subject" />
            </div>

            <div>
              <label className="label" htmlFor="greeting">Greeting</label>
              <input id="greeting" className="field" value={draft.greeting} onChange={(e) => set("greeting", e.target.value)} />
            </div>

            <div>
              <div className="flex items-end justify-between">
                <label className="label" htmlFor="body">Letter (email body + PDF)</label>
                <span className={`mb-1 text-xs font-medium ${words < LETTER_MIN || words > LETTER_MAX ? "text-amber-700" : "text-green-700"}`}>
                  {words} words · target {LETTER_MIN}–{LETTER_MAX}
                </span>
              </div>
              <textarea id="body" className="field min-h-96 leading-relaxed" value={draft.letterBody} onChange={(e) => set("letterBody", e.target.value)} />
              <pre className="mt-2 whitespace-pre-wrap rounded-md bg-slate-50 px-3 py-2 text-xs text-muted">{settings?.signature}</pre>
            </div>

            <Issues issues={liveIssues} />

            <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4 text-sm">
              <span className="text-muted">Attachments:</span>
              <span className="rounded bg-slate-100 px-2 py-1">📎 CV.pdf {env && !env.cvUploaded && <span className="text-red-700">(not uploaded)</span>}</span>
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={draft.attachLetterPdf} onChange={(e) => set("attachLetterPdf", e.target.checked)} />
                📎 Cover letter PDF
              </label>
              <a className="text-brand underline" href={`/api/applications/${id}/pdf`} target="_blank" rel="noreferrer" onClick={(e) => { if (dirty) { e.preventDefault(); setError("Save first to preview the latest PDF."); } }}>
                Preview PDF
              </a>
            </div>

            <div className="flex flex-wrap gap-2">
              <button className="btn" onClick={save} disabled={!dirty || busy !== ""}>{busy === "save" ? "Saving…" : dirty ? "Save draft" : "Saved"}</button>
              <button className="btn btn-primary ml-auto" onClick={() => setConfirming(true)} disabled={!canSend || busy !== ""} title={sendBlocker}>
                {app.sentAt ? "Send again via Gmail" : "Send via Gmail"}
              </button>
            </div>
            {sendBlocker && <p className="text-right text-xs text-muted">{sendBlocker}</p>}
            {app.sentAt && <p className="text-right text-xs text-muted">Sent {new Date(app.sentAt).toLocaleString()} ({daysSince(app.sentAt)} days ago)</p>}

            {confirming && (
              <div className="space-y-3 rounded-md border border-brand bg-blue-50 p-4 text-sm">
                <div className="font-semibold">Send this email now?</div>
                <div><span className="text-muted">To:</span> {draft.toEmail}{draft.cc && <> · <span className="text-muted">CC:</span> {draft.cc}</>}</div>
                <div><span className="text-muted">Subject:</span> {draft.subject}</div>
                <div><span className="text-muted">Attachments:</span> CV{draft.attachLetterPdf ? " + cover letter PDF" : ""}</div>
                {liveIssues.length > 0 && <div className="text-amber-800">⚠ {liveIssues.length} rule warning(s) still open.</div>}
                <div className="flex gap-2">
                  <button className="btn btn-primary" onClick={send} disabled={busy !== ""}>{busy === "send" ? "Sending…" : "Yes, send"}</button>
                  <button className="btn" onClick={() => setConfirming(false)}>Cancel</button>
                </div>
              </div>
            )}
          </div>

          {app.sentAt && (
            <div className="card space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Follow-up {app.followUps.length > 0 && <span className="font-normal text-muted">({app.followUps.length} sent)</span>}</div>
                <button className="btn" onClick={draftFollowUp} disabled={busy !== ""}>{busy === "fu" ? "Writing…" : "Draft follow-up"}</button>
              </div>
              {followUp && (
                <>
                  <input className="field" value={followUp.subject} onChange={(e) => setFollowUp({ ...followUp, subject: e.target.value })} aria-label="Follow-up subject" />
                  <textarea className="field min-h-40" value={followUp.body} onChange={(e) => setFollowUp({ ...followUp, body: e.target.value })} aria-label="Follow-up body" />
                  <p className="text-xs text-muted">{countWords(followUp.body)} words · sent as a reply in the same thread, with your signature, no attachments.</p>
                  {!confirmFollowUp ? (
                    <button className="btn btn-primary" onClick={() => setConfirmFollowUp(true)}>Send follow-up…</button>
                  ) : (
                    <div className="flex gap-2">
                      <button className="btn btn-primary" onClick={sendFollowUp} disabled={busy !== ""}>{busy === "fu-send" ? "Sending…" : `Yes, send to ${app.toEmail}`}</button>
                      <button className="btn" onClick={() => setConfirmFollowUp(false)}>Cancel</button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div className="card space-y-4">
            <div className="text-sm font-semibold">LinkedIn</div>
            <div>
              <div className="flex items-center justify-between">
                <label className="label" htmlFor="li">Direct message · {countWords(draft.linkedinMessage)} words (50–80)</label>
                <CopyButton text={draft.linkedinMessage} />
              </div>
              <textarea id="li" className="field min-h-28" value={draft.linkedinMessage} onChange={(e) => set("linkedinMessage", e.target.value)} />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="label" htmlFor="cn">Connection note · {draft.connectionNote.length}/300 chars</label>
                <CopyButton text={draft.connectionNote} />
              </div>
              <textarea id="cn" className="field min-h-20" value={draft.connectionNote} onChange={(e) => set("connectionNote", e.target.value)} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
