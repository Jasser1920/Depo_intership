import "server-only";
import crypto from "node:crypto";
import { scoreJobs } from "../ai/scorer";
import { getEnvStatus, getSettings, listJobs, saveJobs, addRun } from "../store";
import type { Job, Provider, SearchRun, Settings, SourceResult } from "../types";
import { classifyKind, detectCountry, isSoftwareRole, localScore, skillsFromProfile, visaHint } from "./classify";
import { adzuna, arbeitnow, ATS_FETCHERS, enrich, jooble, remoteok, type RawJob } from "./sources";

const MAX_DESCRIPTION = 12_000;

async function pool<T, R>(items: T[], size: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (i < items.length) {
        const n = i++;
        out[n] = await fn(items[n]);
      }
    }),
  );
  return out;
}

interface SourceTask {
  name: string;
  run: () => Promise<RawJob[]>;
}

function sourceTasks(s: Settings): { tasks: SourceTask[]; skipped: SourceResult[] } {
  const tasks: SourceTask[] = s.watchlist.map((c) => ({ name: `${c.name} (${c.ats})`, run: () => ATS_FETCHERS[c.ats](c) }));
  const skipped: SourceResult[] = [];
  const env = getEnvStatus();
  const q = s.search;
  if (q.useArbeitnow) tasks.push({ name: "Arbeitnow", run: arbeitnow });
  if (q.useRemoteOk && q.includeRemote) tasks.push({ name: "RemoteOK", run: remoteok });
  if (q.useJooble) {
    if (env.jooble) tasks.push({ name: "Jooble", run: () => jooble(q.keywords, q.countries) });
    else skipped.push({ name: "Jooble", ok: false, fetched: 0, kept: 0, error: "skipped — no JOOBLE_API_KEY" });
  }
  if (q.useAdzuna) {
    if (env.adzuna) tasks.push({ name: "Adzuna", run: () => adzuna(q.keywords, q.countries) });
    else skipped.push({ name: "Adzuna", ok: false, fetched: 0, kept: 0, error: "skipped — no ADZUNA keys" });
  }
  return { tasks, skipped };
}

let running: Promise<SearchRun> | null = null;

export function isSearchRunning() {
  return running !== null;
}

/** Fetch every source, keep software internships in target countries, score them, persist. One run at a time. */
export function runSearch(trigger: SearchRun["trigger"], opts: { provider?: Provider; skipAi?: boolean } = {}): Promise<SearchRun> {
  if (!running) running = doSearch(trigger, opts).finally(() => (running = null));
  return running;
}

async function doSearch(trigger: SearchRun["trigger"], opts: { provider?: Provider; skipAi?: boolean }): Promise<SearchRun> {
  const started = Date.now();
  const now = new Date().toISOString();
  const settings = getSettings();
  const q = settings.search;
  const skills = skillsFromProfile(settings.profile);
  const existing = new Map(listJobs().map((j) => [j.id, j]));
  const { tasks, skipped } = sourceTasks(settings);

  const results: SourceResult[] = [...skipped];
  const kept = new Map<string, Job>();

  await pool(tasks, 5, async (task) => {
    const r: SourceResult = { name: task.name, ok: true, fetched: 0, kept: 0 };
    try {
      const raw = await task.run();
      r.fetched = raw.length;
      for (const job of raw) {
        const kind = classifyKind(job.title, q.includeJunior);
        if (!kind || !isSoftwareRole(job.title)) continue;
        const country = detectCountry(job.location, {
          countryCode: job.countryCode,
          remote: job.remote,
          targets: q.countries,
          includeRemote: q.includeRemote,
        });
        if (!country) continue;
        const id = `${job.source}:${job.externalId}`;
        if (kept.has(id)) continue;
        const prev = existing.get(id);
        const full = prev?.description ? job : await enrich(job).catch(() => job);
        const description = (full.description || prev?.description || "").slice(0, MAX_DESCRIPTION);
        const visa = visaHint(description);
        const { score, matched } = localScore({ title: job.title, text: description, kind, country, targets: q.countries, visa, skills });
        kept.set(id, {
          id,
          source: job.source,
          company: job.company,
          title: job.title,
          location: job.location,
          country,
          remote: job.remote,
          url: full.url,
          description,
          postedAt: job.postedAt,
          firstSeenAt: prev?.firstSeenAt ?? now,
          lastSeenAt: now,
          kind,
          localScore: score,
          matchedSkills: matched,
          visaHint: visa,
          ai: prev?.ai,
          status: prev?.status ?? "new",
          applicationId: prev?.applicationId,
        });
        r.kept++;
      }
    } catch (e) {
      r.ok = false;
      r.error = e instanceof Error ? e.message : String(e);
    }
    results.push(r);
  });

  const newJobs = [...kept.values()].filter((j) => !existing.has(j.id));

  // AI scoring: best local candidates first, only for jobs without a score yet.
  let aiScored = 0;
  let aiError: string | undefined;
  const provider = opts.provider ?? settings.defaultProvider;
  const env = getEnvStatus();
  if (!opts.skipAi && env[provider] && q.aiScoreLimit > 0) {
    const toScore = [...kept.values()]
      .filter((j) => !j.ai && j.status !== "dismissed")
      .sort((a, b) => b.localScore - a.localScore)
      .slice(0, q.aiScoreLimit);
    try {
      const scores = await scoreJobs(provider, settings, toScore);
      for (const [id, s] of scores) {
        const j = kept.get(id);
        if (j) j.ai = { ...s, provider, at: now };
      }
      aiScored = scores.size;
    } catch (e) {
      aiError = `AI scoring failed: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  // Merge: keep jobs we didn't see this time (closed postings) for a while, unless dismissed long ago.
  const cutoff = Date.now() - 45 * 86_400_000;
  const merged: Job[] = [...kept.values()];
  for (const [id, j] of existing) {
    if (kept.has(id)) continue;
    const keep = j.status === "saved" || j.status === "applied" || Date.parse(j.lastSeenAt ?? j.firstSeenAt) > cutoff;
    if (keep) merged.push(j);
  }
  saveJobs(merged);

  const run: SearchRun = {
    id: crypto.randomUUID().slice(0, 8),
    at: now,
    trigger,
    durationMs: Date.now() - started,
    sources: results.sort((a, b) => a.name.localeCompare(b.name)),
    newJobs: newJobs.length,
    aiScored,
    error: aiError,
  };
  addRun(run);
  return run;
}

export { jobScore } from "./classify";
