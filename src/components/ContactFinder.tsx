"use client";

import { useState } from "react";
import { api } from "@/lib/client";

interface Contact {
  email: string;
  name: string;
  position: string;
  confidence: number;
  linkedin: string;
  source: "hunter" | "guess";
}

interface Result {
  domain: string;
  organization: string;
  pattern: string;
  contacts: Contact[];
  hunterEnabled: boolean;
}

/** Find a person to email at a company (Hunter.io when configured, common inboxes otherwise). */
export function ContactFinder({ defaultDomain, onPick }: { defaultDomain: string; onPick: (email: string, name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [domain, setDomain] = useState(defaultDomain);
  const [result, setResult] = useState<Result | null>(null);
  const [verify, setVerify] = useState<Record<string, string>>({});
  const [person, setPerson] = useState({ firstName: "", lastName: "" });
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label); setError("");
    try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(""); }
  }

  if (!open)
    return (
      <button type="button" className="text-xs text-brand underline" onClick={() => setOpen(true)}>
        🔍 Find a contact at this company
      </button>
    );

  return (
    <div className="space-y-3 rounded-md border border-line bg-slate-50 p-3 text-sm">
      <div className="flex gap-2">
        <input className="field" placeholder="company.com" value={domain} onChange={(e) => setDomain(e.target.value)} aria-label="Company domain" />
        <button type="button" className="btn" disabled={!domain || busy !== ""} onClick={() => run("search", async () => setResult(await api<Result>("/api/contacts", { method: "POST", json: { domain } })))}>
          {busy === "search" ? "Searching…" : "Search"}
        </button>
        <button type="button" className="btn" onClick={() => setOpen(false)}>Close</button>
      </div>
      {error && <p className="text-red-700">{error}</p>}
      {result && (
        <>
          {!result.hunterEnabled && (
            <p className="text-xs text-amber-800">Add a free HUNTER_API_KEY to .env.local to find real people (engineering managers, recruiters). For now, here are common inboxes — unverified guesses.</p>
          )}
          {result.pattern && <p className="text-xs text-muted">Email pattern at {result.organization || result.domain}: <code>{result.pattern}@{result.domain}</code></p>}
          <ul className="divide-y divide-line rounded-md border border-line bg-white">
            {result.contacts.map((c) => (
              <li key={c.email} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{c.name || c.email}</div>
                  <div className="text-xs text-muted">
                    {c.name && <>{c.email} · </>}{c.position || "—"}{c.source === "hunter" && ` · ${c.confidence}% confidence`}
                    {c.linkedin && <> · <a className="underline" href={c.linkedin} target="_blank" rel="noreferrer">LinkedIn</a></>}
                  </div>
                </div>
                {verify[c.email] && <span className={`text-xs ${verify[c.email] === "valid" ? "text-green-700" : "text-amber-700"}`}>{verify[c.email]}</span>}
                {result.hunterEnabled && (
                  <button type="button" className="btn px-2 py-1 text-xs" disabled={busy !== ""} onClick={() => run(c.email, async () => {
                    const r = await api<{ status: string }>("/api/contacts/verify", { method: "POST", json: { email: c.email } });
                    setVerify((v) => ({ ...v, [c.email]: r.status }));
                  })}>{busy === c.email ? "…" : "Verify"}</button>
                )}
                <button type="button" className="btn btn-primary px-2 py-1 text-xs" onClick={() => onPick(c.email, c.name)}>Use</button>
              </li>
            ))}
          </ul>
          {result.hunterEnabled && (
            <div className="flex flex-wrap gap-2">
              <input className="field w-36" placeholder="First name" value={person.firstName} onChange={(e) => setPerson({ ...person, firstName: e.target.value })} />
              <input className="field w-36" placeholder="Last name" value={person.lastName} onChange={(e) => setPerson({ ...person, lastName: e.target.value })} />
              <button type="button" className="btn" disabled={!person.firstName || !person.lastName || busy !== ""} onClick={() => run("person", async () => {
                const r = await api<{ email: string; score: number; position: string }>("/api/contacts/person", { method: "POST", json: { domain, ...person } });
                if (!r.email) throw new Error("Hunter couldn't find that person's email.");
                setResult({ ...result, contacts: [{ email: r.email, name: `${person.firstName} ${person.lastName}`, position: r.position, confidence: r.score, linkedin: "", source: "hunter" }, ...result.contacts] });
              })}>{busy === "person" ? "Looking up…" : "Find a specific person"}</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
