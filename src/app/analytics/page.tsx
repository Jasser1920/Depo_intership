"use client";

import { useEffect, useMemo, useState } from "react";
import { ErrorBox } from "@/components/ui";
import { api } from "@/lib/client";
import type { Application } from "@/lib/types";

const POSITIVE = new Set(["replied", "interview", "offer"]);

function gotReply(a: Application): boolean {
  return POSITIVE.has(a.status) || (a.replies ?? []).some((r) => r.kind === "reply");
}

interface Group {
  label: string;
  sent: number;
  replied: number;
}

function groupBy(apps: Application[], key: (a: Application) => string): Group[] {
  const m = new Map<string, Group>();
  for (const a of apps) {
    const k = key(a) || "Unknown";
    const g = m.get(k) ?? { label: k, sent: 0, replied: 0 };
    g.sent++;
    if (gotReply(a)) g.replied++;
    m.set(k, g);
  }
  return [...m.values()].sort((a, b) => b.sent - a.sent);
}

function Stat({ value, label, hint }: { value: string | number; label: string; hint?: string }) {
  return (
    <div className="card" title={hint}>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}

/** One series → one hue. Rate bars share a 0–100% scale so groups compare honestly. */
function RateBars({ title, groups }: { title: string; groups: Group[] }) {
  if (!groups.length) return null;
  return (
    <section className="card space-y-3">
      <h2 className="text-sm font-semibold">Response rate by {title}</h2>
      <div className="space-y-2">
        {groups.map((g) => {
          const rate = g.sent ? g.replied / g.sent : 0;
          return (
            <div key={g.label} className="grid grid-cols-[minmax(0,10rem)_1fr_5.5rem] items-center gap-3 text-sm" title={`${g.label}: ${g.replied} replies from ${g.sent} sent (${Math.round(rate * 100)}%)`}>
              <span className="truncate">{g.label}</span>
              <div className="h-3 rounded-r bg-slate-100">
                <div className="h-3 rounded-r-[4px] bg-brand" style={{ width: `${Math.max(rate * 100, rate > 0 ? 2 : 0)}%` }} />
              </div>
              <span className="text-right tabular-nums text-muted">{Math.round(rate * 100)}% · {g.replied}/{g.sent}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // Monday
  return x;
}

function WeeklyBars({ apps }: { apps: Application[] }) {
  const weeks = useMemo(() => {
    const now = startOfWeek(new Date());
    const list = Array.from({ length: 10 }, (_, i) => {
      const start = new Date(now);
      start.setDate(start.getDate() - (9 - i) * 7);
      return { start, count: 0 };
    });
    for (const a of apps) {
      const t = startOfWeek(new Date(a.sentAt!)).getTime();
      const w = list.find((x) => x.start.getTime() === t);
      if (w) w.count++;
    }
    return list;
  }, [apps]);
  const max = Math.max(1, ...weeks.map((w) => w.count));

  return (
    <section className="card space-y-3">
      <h2 className="text-sm font-semibold">Emails sent per week</h2>
      <div className="flex h-40 items-end gap-2 border-b border-line">
        {weeks.map((w) => {
          const label = w.start.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
          return (
            <div key={label} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`Week of ${label}: ${w.count} sent`}>
              {w.count > 0 && <span className="text-xs tabular-nums text-muted">{w.count}</span>}
              <div className="w-full max-w-10 rounded-t-[4px] bg-brand" style={{ height: `${(w.count / max) * 100}%`, minHeight: w.count ? 2 : 0 }} />
            </div>
          );
        })}
      </div>
      <div className="flex gap-2">
        {weeks.map((w) => (
          <span key={w.start.toISOString()} className="flex-1 text-center text-[10px] text-muted">
            {w.start.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
          </span>
        ))}
      </div>
    </section>
  );
}

export default function Analytics() {
  const [apps, setApps] = useState<Application[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Application[]>("/api/applications").then(setApps).catch((e) => setError(e.message));
  }, []);

  const sent = useMemo(() => (apps ?? []).filter((a) => a.sentAt), [apps]);
  if (error) return <ErrorBox message={error} />;
  if (!apps) return <p className="text-sm text-muted">Loading…</p>;

  const replied = sent.filter(gotReply);
  const interviews = apps.filter((a) => a.status === "interview" || a.status === "offer").length;
  const offers = apps.filter((a) => a.status === "offer").length;
  const bounced = sent.filter((a) => a.bounced).length;
  const replyDays = sent
    .map((a) => {
      const first = (a.replies ?? []).filter((r) => r.kind === "reply").map((r) => Date.parse(r.at)).sort()[0];
      return first ? (first - Date.parse(a.sentAt!)) / 86_400_000 : null;
    })
    .filter((d): d is number => d !== null);
  const avgDays = replyDays.length ? (replyDays.reduce((s, d) => s + d, 0) / replyDays.length).toFixed(1) : "—";
  const rate = sent.length ? `${Math.round((replied.length / sent.length) * 100)}%` : "—";

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Analytics</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <Stat value={apps.length} label="Applications" />
        <Stat value={sent.length} label="Sent" />
        <Stat value={replied.length} label="Got a reply" />
        <Stat value={rate} label="Response rate" hint="Replies (including rejections with a reply) ÷ sent" />
        <Stat value={interviews} label="Interviews" />
        <Stat value={offers} label="Offers" />
        <Stat value={avgDays} label="Avg days to reply" />
      </div>

      {bounced > 0 && <ErrorBox message={`${bounced} email${bounced > 1 ? "s" : ""} bounced — check those addresses in the tracker.`} />}

      {sent.length === 0 ? (
        <div className="card text-center text-sm text-muted">Send a few applications and the charts will appear here.</div>
      ) : (
        <>
          <WeeklyBars apps={sent} />
          <div className="grid gap-5 lg:grid-cols-2">
            <RateBars title="country" groups={groupBy(sent, (a) => a.country)} />
            <RateBars title="application type" groups={groupBy(sent, (a) => (a.source.kind === "spontaneous" ? "Spontaneous" : "Job posting"))} />
            <RateBars title="subject angle" groups={groupBy(sent, (a) => a.subjectAngle ?? "")} />
            <RateBars title="AI writer" groups={groupBy(sent, (a) => (a.provider === "claude" ? "Claude" : "Gemini"))} />
          </div>
          <p className="text-xs text-muted">Small samples swing a lot — treat a group&apos;s rate as a hint until it has around 15–20 emails.</p>

          <details className="card text-sm">
            <summary className="cursor-pointer font-semibold">Table view</summary>
            <table className="mt-3 w-full text-xs">
              <thead className="text-left text-muted">
                <tr><th className="py-1">Company</th><th>Country</th><th>Type</th><th>Angle</th><th>Sent</th><th>Status</th><th>Replies</th></tr>
              </thead>
              <tbody>
                {sent.map((a) => (
                  <tr key={a.id} className="border-t border-line">
                    <td className="py-1">{a.company}</td><td>{a.country}</td><td>{a.source.kind}</td><td>{a.subjectAngle ?? "—"}</td>
                    <td>{new Date(a.sentAt!).toLocaleDateString("en-GB")}</td><td>{a.status}</td><td>{(a.replies ?? []).length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </div>
  );
}
