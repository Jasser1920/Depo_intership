"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ErrorBox, ScoreBadge, VisaBadge } from "@/components/ui";
import { api, daysSince, flag } from "@/lib/client";
import { STATUSES, STATUS_LABELS, type Application, type Settings, type Status } from "@/lib/types";

export default function Tracker() {
  const [apps, setApps] = useState<Application[] | null>(null);
  const [followUpDays, setFollowUpDays] = useState(7);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    api<Application[]>("/api/applications").then(setApps).catch((e) => setError(e.message));
    api<{ settings: Settings }>("/api/settings")
      .then((d) => setFollowUpDays(d.settings.followUpDays))
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return (apps ?? []).filter((a) => !q || `${a.company} ${a.role} ${a.country}`.toLowerCase().includes(q));
  }, [apps, query]);

  async function move(app: Application, status: Status) {
    try {
      const updated = await api<Application>(`/api/applications/${app.id}`, { method: "PATCH", json: { status } });
      setApps((prev) => prev?.map((a) => (a.id === app.id ? updated : a)) ?? null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const needFollowUp = (a: Application) =>
    a.status === "applied" && daysSince(a.followUps.at(-1)?.sentAt ?? a.sentAt) >= followUpDays;

  const stats = {
    total: apps?.length ?? 0,
    sent: apps?.filter((a) => a.sentAt).length ?? 0,
    replies: apps?.filter((a) => ["replied", "interview", "offer"].includes(a.status)).length ?? 0,
    followUps: apps?.filter(needFollowUp).length ?? 0,
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">Applications</h1>
        <input className="field ml-auto max-w-xs" placeholder="Search company, role, country…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <Link href="/new" className="btn btn-primary">+ New application</Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Total", stats.total],
          ["Sent", stats.sent],
          ["Positive replies", stats.replies],
          ["Follow-ups due", stats.followUps],
        ].map(([label, n]) => (
          <div key={label} className="card">
            <div className="text-2xl font-semibold">{n}</div>
            <div className="text-xs text-muted">{label}</div>
          </div>
        ))}
      </div>

      <ErrorBox message={error} />

      {apps && apps.length === 0 && (
        <div className="card text-center text-sm text-muted">
          No applications yet. <Link href="/new" className="text-brand underline">Write your first one</Link> — and check{" "}
          <Link href="/settings" className="text-brand underline">Settings</Link> to add API keys, Gmail and your CV.
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        {STATUSES.map((status) => {
          const col = filtered.filter((a) => a.status === status);
          return (
            <section key={status} className="min-w-0">
              <h2 className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-muted">
                {STATUS_LABELS[status]} <span>{col.length}</span>
              </h2>
              <div className="space-y-2">
                {col.map((a) => (
                  <div key={a.id} className="card space-y-2 p-3">
                    <Link href={`/applications/${a.id}`} className="block">
                      <div className="truncate font-medium">{flag(a.country)} {a.company}</div>
                      <div className="truncate text-xs text-muted">{a.role}</div>
                    </Link>
                    <div className="flex flex-wrap gap-1">
                      <ScoreBadge score={a.match.score} />
                      {a.visa.flag !== "ok" && <VisaBadge flag={a.visa.flag} />}
                      {needFollowUp(a) && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">Follow up</span>}
                    </div>
                    <select className="field py-1 text-xs" value={a.status} onChange={(e) => move(a, e.target.value as Status)} aria-label="Status">
                      {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
