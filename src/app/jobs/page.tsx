"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ErrorBox, ScoreBadge, VisaBadge } from "@/components/ui";
import { api, flag } from "@/lib/client";
import { jobScore } from "@/lib/search/classify";
import type { EnvStatus, Job, JobStatus, Provider, SearchRun, Settings } from "@/lib/types";

const TABS: { key: JobStatus; label: string }[] = [
  { key: "new", label: "New" },
  { key: "saved", label: "Saved" },
  { key: "applied", label: "Applied" },
  { key: "dismissed", label: "Dismissed" },
];

function ago(iso: string): string {
  if (!iso) return "";
  const d = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
}

function JobCard({ job, onStatus, onApply, busy }: { job: Job; onStatus: (s: JobStatus) => void; onApply: () => void; busy: boolean }) {
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState<string | null>(null);
  const visa = job.ai?.visa ?? (job.visaHint || null);

  async function toggle() {
    setOpen(!open);
    if (!full) setFull((await api<Job>(`/api/jobs/${encodeURIComponent(job.id)}`)).description);
  }

  return (
    <div className="card space-y-2">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <a href={job.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">{job.title}</a>
          <div className="text-sm text-muted">
            {flag(job.country)} {job.company} · {job.location || job.country} · <span className="capitalize">{job.source}</span>
            {job.postedAt && <> · posted {ago(job.postedAt)}</>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span title={job.ai ? `AI score (${job.ai.provider})` : "Keyword score — AI score not computed yet"}>
            <ScoreBadge score={jobScore(job)} />
          </span>
          {!job.ai && <span className="text-[10px] uppercase text-muted">kw</span>}
          {visa && <VisaBadge flag={visa} />}
          {job.kind === "junior" && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">Junior</span>}
        </div>
      </div>

      {job.ai?.reason && <p className="text-sm">{job.ai.reason}</p>}
      {job.matchedSkills.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {job.matchedSkills.map((s) => <span key={s} className="rounded bg-green-50 px-1.5 py-0.5 text-xs text-green-800">{s}</span>)}
        </div>
      )}

      {open && <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-xs text-muted">{full ?? "Loading…"}</pre>}

      <div className="flex flex-wrap gap-2 pt-1">
        <button className="btn px-2 py-1 text-xs" onClick={toggle}>{open ? "Hide description" : "Description"}</button>
        {job.status !== "saved" && job.status !== "applied" && <button className="btn px-2 py-1 text-xs" onClick={() => onStatus("saved")}>☆ Save</button>}
        {job.status !== "dismissed" && job.status !== "applied" && <button className="btn px-2 py-1 text-xs" onClick={() => onStatus("dismissed")}>Dismiss</button>}
        {job.status === "dismissed" && <button className="btn px-2 py-1 text-xs" onClick={() => onStatus("new")}>Restore</button>}
        <div className="ml-auto" />
        {job.applicationId ? (
          <Link href={`/applications/${job.applicationId}`} className="btn btn-primary px-2 py-1 text-xs">Open application →</Link>
        ) : (
          <button className="btn btn-primary px-2 py-1 text-xs" onClick={onApply} disabled={busy}>{busy ? "Writing letter…" : "✍ Write application"}</button>
        )}
      </div>
    </div>
  );
}

export default function Opportunities() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [runs, setRuns] = useState<SearchRun[]>([]);
  const [env, setEnv] = useState<EnvStatus | null>(null);
  const [provider, setProvider] = useState<Provider>("claude");
  const [tab, setTab] = useState<JobStatus>("new");
  const [country, setCountry] = useState("all");
  const [minScore, setMinScore] = useState(0);
  const [hideBlockers, setHideBlockers] = useState(true);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = () =>
    Promise.all([api<Job[]>("/api/jobs").then(setJobs), api<{ runs: SearchRun[] }>("/api/search").then((d) => setRuns(d.runs))]).catch((e) =>
      setError(e.message),
    );

  useEffect(() => {
    load();
    api<{ settings: Settings; env: EnvStatus }>("/api/settings").then((d) => { setEnv(d.env); setProvider(d.settings.defaultProvider); });
  }, []);

  async function search(skipAi: boolean) {
    setBusy("search"); setError("");
    try {
      const run = await api<SearchRun>("/api/search", { method: "POST", json: { provider, skipAi } });
      if (run.error) setError(run.error);
      await load();
      setTab("new");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function setStatus(job: Job, status: JobStatus) {
    try {
      const updated = await api<Job>(`/api/jobs/${encodeURIComponent(job.id)}`, { method: "PATCH", json: { status } });
      setJobs((prev) => prev?.map((j) => (j.id === job.id ? { ...updated, description: j.description } : j)) ?? null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function apply(job: Job) {
    setBusy(job.id); setError("");
    try {
      const app = await api<{ id: string }>(`/api/jobs/${encodeURIComponent(job.id)}/apply`, { method: "POST", json: { provider } });
      router.push(`/applications/${app.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy("");
    }
  }

  const countries = useMemo(() => [...new Set((jobs ?? []).map((j) => j.country))].sort(), [jobs]);
  const lastRun = runs[0];
  const visible = (jobs ?? []).filter((j) => {
    if (j.status !== tab) return false;
    if (country !== "all" && j.country !== country) return false;
    if (jobScore(j) < minScore) return false;
    if (hideBlockers && tab === "new" && (j.ai?.visa ?? j.visaHint) === "blocker") return false;
    const q = query.toLowerCase();
    return !q || `${j.title} ${j.company} ${j.location}`.toLowerCase().includes(q);
  });
  const count = (s: JobStatus) => (jobs ?? []).filter((j) => j.status === s).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">Opportunities</h1>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select className="field w-auto" value={provider} onChange={(e) => setProvider(e.target.value as Provider)} aria-label="AI provider">
            <option value="claude">Claude{env && !env.claude ? " (no key)" : ""}</option>
            <option value="gemini">Gemini{env && !env.gemini ? " (no key)" : ""}</option>
          </select>
          <button className="btn" onClick={() => search(true)} disabled={busy !== ""} title="Fetch and filter only, no AI cost">Quick search</button>
          <button className="btn btn-primary" onClick={() => search(false)} disabled={busy !== "" || (env !== null && !env[provider])}>
            {busy === "search" ? "Searching all sources…" : "Search + AI score"}
          </button>
        </div>
      </div>

      {lastRun && (
        <details className="card text-sm">
          <summary className="cursor-pointer">
            Last search {new Date(lastRun.at).toLocaleString()} ({lastRun.trigger}) — <b>{lastRun.newJobs}</b> new, {lastRun.aiScored} AI-scored,{" "}
            {lastRun.sources.filter((s) => s.ok).length}/{lastRun.sources.filter((s) => !s.error?.startsWith("skipped")).length} sources OK
            {lastRun.sources.some((s) => s.error?.startsWith("skipped")) && ` (${lastRun.sources.filter((s) => s.error?.startsWith("skipped")).length} skipped — no API key)`}
            , {(lastRun.durationMs / 1000).toFixed(1)}s
          </summary>
          <table className="mt-3 w-full text-xs">
            <thead className="text-left text-muted"><tr><th className="py-1">Source</th><th>Fetched</th><th>Kept</th><th>Status</th></tr></thead>
            <tbody>
              {lastRun.sources.map((s) => (
                <tr key={s.name} className="border-t border-line">
                  <td className="py-1">{s.name}</td><td>{s.fetched}</td><td>{s.kept}</td>
                  <td className={s.ok ? "text-green-700" : "text-amber-700"}>{s.ok ? "OK" : s.error}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      <ErrorBox message={error} />

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button key={t.key} className={`btn ${tab === t.key ? "btn-primary" : ""}`} onClick={() => setTab(t.key)}>
            {t.label} <span className="opacity-70">{count(t.key)}</span>
          </button>
        ))}
        <input className="field ml-auto max-w-56" placeholder="Filter…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="field w-auto" value={country} onChange={(e) => setCountry(e.target.value)} aria-label="Country">
          <option value="all">All locations</option>
          {countries.map((c) => <option key={c}>{c}</option>)}
        </select>
        <label className="flex items-center gap-1 text-sm">
          Min score
          <input type="number" min={0} max={100} step={10} className="field w-20" value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} />
        </label>
        {tab === "new" && (
          <label className="flex items-center gap-1 text-sm">
            <input type="checkbox" checked={hideBlockers} onChange={(e) => setHideBlockers(e.target.checked)} /> Hide EU-permit-only
          </label>
        )}
      </div>

      {jobs && jobs.length === 0 && (
        <div className="card text-center text-sm text-muted">
          No opportunities yet. Click <b>Quick search</b> to scan {""}
          <Link href="/companies" className="text-brand underline">your company watchlist</Link> and the job boards.
        </div>
      )}
      {jobs && jobs.length > 0 && visible.length === 0 && <p className="text-sm text-muted">Nothing here with the current filters.</p>}

      <div className="space-y-3">
        {visible.map((j) => (
          <JobCard key={j.id} job={j} busy={busy === j.id} onStatus={(s) => setStatus(j, s)} onApply={() => apply(j)} />
        ))}
      </div>
    </div>
  );
}
