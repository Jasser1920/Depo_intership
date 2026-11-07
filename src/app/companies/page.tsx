"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ErrorBox } from "@/components/ui";
import { api, flag } from "@/lib/client";
import { ATS_TYPES, type Ats, type EnvStatus, type Job, type Provider, type SearchRun, type Settings, type WatchCompany } from "@/lib/types";

interface Discovered {
  name: string;
  country: string;
  city: string;
  domain: string;
  why: string;
  board: { ats: Ats; token: string; openRoles: number } | null;
}

const BOARD_URL: Record<Ats, (t: string) => string> = {
  greenhouse: (t) => `https://boards.greenhouse.io/${t}`,
  lever: (t) => `https://jobs.lever.co/${t}`,
  ashby: (t) => `https://jobs.ashbyhq.com/${t}`,
  smartrecruiters: (t) => `https://jobs.smartrecruiters.com/${t}`,
};

function spontaneousHref(c: { name: string; country: string; domain?: string }) {
  const q = new URLSearchParams({ kind: "spontaneous", company: c.name, country: c.country, ...(c.domain ? { domain: c.domain } : {}) });
  return `/new?${q}`;
}

export default function Companies() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [env, setEnv] = useState<EnvStatus | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [run, setRun] = useState<SearchRun | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");

  const [form, setForm] = useState<WatchCompany>({ name: "", ats: "greenhouse", token: "", country: "Portugal", domain: "" });
  const [disc, setDisc] = useState({ country: "Denmark", focus: "", count: 10, provider: "claude" as Provider });
  const [found, setFound] = useState<Discovered[] | null>(null);

  useEffect(() => {
    api<{ settings: Settings; env: EnvStatus }>("/api/settings").then((d) => {
      setSettings(d.settings); setEnv(d.env); setDisc((x) => ({ ...x, provider: d.settings.defaultProvider }));
    }).catch((e) => setError(e.message));
    api<Job[]>("/api/jobs").then(setJobs).catch(() => {});
    api<{ runs: SearchRun[] }>("/api/search").then((d) => setRun(d.runs[0] ?? null)).catch(() => {});
  }, []);

  const internCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const j of jobs) m.set(j.company.toLowerCase(), (m.get(j.company.toLowerCase()) ?? 0) + 1);
    return m;
  }, [jobs]);

  if (!settings) return error ? <ErrorBox message={error} /> : <p className="text-sm text-muted">Loading…</p>;

  async function run_(label: string, fn: () => Promise<void>) {
    setBusy(label); setError(""); setNotice("");
    try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(""); }
  }

  const saveWatchlist = (watchlist: WatchCompany[], message: string) =>
    run_("save", async () => {
      const d = await api<{ settings: Settings }>("/api/settings", { method: "PUT", json: { watchlist } });
      setSettings(d.settings); setNotice(message);
    });

  const addCompany = (c: WatchCompany) => {
    if (settings.watchlist.some((w) => w.ats === c.ats && w.token.toLowerCase() === c.token.toLowerCase())) {
      setError(`${c.name} is already on the watchlist.`);
      return Promise.resolve();
    }
    return saveWatchlist([...settings.watchlist, c], `Added ${c.name}. It will be included in the next search.`);
  };

  const verifyAndAdd = () =>
    run_("verify", async () => {
      const r = await api<{ exists: boolean; openRoles: number }>("/api/companies/verify", { method: "POST", json: { ats: form.ats, token: form.token } });
      if (!r.exists) throw new Error(`No ${form.ats} board found for "${form.token}" (or it has no open roles). Check the token in the careers page URL.`);
      setBusy("");
      await addCompany({ ...form, name: form.name || form.token });
      setForm({ ...form, name: "", token: "", domain: "" });
    });

  const discover = () =>
    run_("discover", async () => {
      setFound(await api<Discovered[]>("/api/companies/discover", { method: "POST", json: disc }));
    });

  const runFor = (c: WatchCompany) => run?.sources.find((s) => s.name === `${c.name} (${c.ats})`);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">Companies</h1>
        <span className="text-sm text-muted">{settings.watchlist.length} boards watched — searched on every run</span>
      </div>
      {notice && <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{notice}</div>}
      <ErrorBox message={error} />

      {/* Discovery */}
      <section className="card space-y-3">
        <div>
          <div className="font-semibold">✨ Discover companies with AI</div>
          <p className="text-sm text-muted">The AI suggests companies that fit your profile; the app then checks each one against the real job boards. Verified boards can be watched; the rest are good targets for spontaneous applications.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select className="field w-auto" value={disc.country} onChange={(e) => setDisc({ ...disc, country: e.target.value })} aria-label="Country">
            {["Denmark", "Portugal", "Switzerland", ...settings.search.countries.filter((c) => !["Denmark", "Portugal", "Switzerland"].includes(c))].map((c) => <option key={c}>{c}</option>)}
          </select>
          <input className="field min-w-56 flex-1" placeholder="Focus (optional): fintech, Kubernetes, real-time, health tech…" value={disc.focus} onChange={(e) => setDisc({ ...disc, focus: e.target.value })} />
          <select className="field w-auto" value={disc.provider} onChange={(e) => setDisc({ ...disc, provider: e.target.value as Provider })} aria-label="AI provider">
            <option value="claude">Claude{env && !env.claude ? " (no key)" : ""}</option>
            <option value="gemini">Gemini{env && !env.gemini ? " (no key)" : ""}</option>
          </select>
          <button className="btn btn-primary" onClick={discover} disabled={busy !== "" || (env !== null && !env[disc.provider])}>
            {busy === "discover" ? "Suggesting & verifying… (~30s)" : "Discover"}
          </button>
        </div>
        {found && (
          <div className="divide-y divide-line rounded-md border border-line">
            {found.length === 0 && <p className="p-3 text-sm text-muted">No suggestions.</p>}
            {found.map((c) => {
              const watched = c.board && settings.watchlist.some((w) => w.ats === c.board!.ats && w.token.toLowerCase() === c.board!.token.toLowerCase());
              return (
                <div key={c.name} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{flag(c.country)} {c.name} <span className="font-normal text-muted">· {c.city} · {c.domain}</span></div>
                    <div className="text-muted">{c.why}</div>
                  </div>
                  {c.board ? (
                    <>
                      <a className="text-xs text-brand underline" href={BOARD_URL[c.board.ats](c.board.token)} target="_blank" rel="noreferrer">{c.board.ats} · {c.board.openRoles} roles</a>
                      <button className="btn px-2 py-1 text-xs" disabled={!!watched || busy !== ""} onClick={() => addCompany({ name: c.name, ats: c.board!.ats, token: c.board!.token, country: c.country, domain: c.domain })}>
                        {watched ? "Watching" : "+ Watch"}
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-muted">No public board found</span>
                  )}
                  <Link className="btn px-2 py-1 text-xs" href={spontaneousHref(c)}>Spontaneous application</Link>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Add manually */}
      <section className="card space-y-3">
        <div className="font-semibold">Add a company board</div>
        <p className="text-sm text-muted">Find the token in the company&apos;s careers URL, e.g. jobs.ashbyhq.com/<b>pleo</b> or boards.greenhouse.io/<b>trustpilot</b>.</p>
        <div className="grid gap-2 sm:grid-cols-6">
          <input className="field sm:col-span-2" placeholder="Company name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select className="field" value={form.ats} onChange={(e) => setForm({ ...form, ats: e.target.value as Ats })} aria-label="ATS">
            {ATS_TYPES.map((a) => <option key={a}>{a}</option>)}
          </select>
          <input className="field" placeholder="Board token" value={form.token} onChange={(e) => setForm({ ...form, token: e.target.value })} />
          <input className="field" placeholder="Country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
          <input className="field" placeholder="domain.com" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} />
        </div>
        <button className="btn" onClick={verifyAndAdd} disabled={!form.token || busy !== ""}>{busy === "verify" ? "Checking board…" : "Verify & add"}</button>
      </section>

      {/* Watchlist */}
      <section className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
            <tr><th className="p-3">Company</th><th>Board</th><th>Last search</th><th>Internships found</th><th className="p-3 text-right">Actions</th></tr>
          </thead>
          <tbody>
            {settings.watchlist.map((c, i) => {
              const r = runFor(c);
              const n = internCount.get(c.name.toLowerCase()) ?? 0;
              return (
                <tr key={`${c.ats}:${c.token}`} className="border-b border-line last:border-0">
                  <td className="p-3">
                    <div className="font-medium">{flag(c.country)} {c.name}</div>
                    <div className="text-xs text-muted">{c.country || "Global"}{c.domain ? ` · ${c.domain}` : ""}</div>
                  </td>
                  <td><a className="text-brand underline" href={BOARD_URL[c.ats](c.token)} target="_blank" rel="noreferrer">{c.ats}/{c.token}</a></td>
                  <td className={r && !r.ok ? "text-amber-700" : "text-muted"}>{r ? (r.ok ? `${r.fetched} open roles` : r.error) : "—"}</td>
                  <td>{n > 0 ? <Link href="/jobs" className="font-medium text-green-700 underline">{n}</Link> : <span className="text-muted">0</span>}</td>
                  <td className="space-x-2 p-3 text-right whitespace-nowrap">
                    {n === 0 && <Link className="btn px-2 py-1 text-xs" href={spontaneousHref(c)}>Spontaneous</Link>}
                    <button className="btn btn-danger px-2 py-1 text-xs" disabled={busy !== ""} onClick={() => saveWatchlist(settings.watchlist.filter((_, j) => j !== i), `Removed ${c.name}.`)}>Remove</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
