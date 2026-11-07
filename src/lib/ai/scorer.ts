import "server-only";
import { z } from "zod";
import type { Job, Provider, Settings, VisaFlag } from "../types";
import { generateStructured } from "./providers";

const ScoreSchema = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      score: z.number().describe("0-100 fit for this candidate"),
      visa: z.enum(["ok", "warning", "blocker"]),
      reason: z.string().describe("One sentence: why this score"),
    }),
  ),
});

export interface JobScore {
  score: number;
  visa: VisaFlag;
  reason: string;
}

const BATCH = 8;

/** Score jobs in batches. Returns a map of job id → score; jobs the model skipped are left out. */
export async function scoreJobs(provider: Provider, settings: Settings, jobs: Job[]): Promise<Map<string, JobScore>> {
  const system = `You screen job postings for one internship candidate and score how worth applying each one is.

<candidate_facts>
${settings.profile.trim()}
</candidate_facts>

Scoring guide (0-100):
- 80+: software internship (or PFE/thesis role) in the candidate's core area (backend, distributed systems, cloud/DevOps, full-stack), in a target country or remote-Europe, start/length compatible with a 6-month PFE from 1 December 2026, and no hard work-permit barrier.
- 50-79: relevant but with a gap (different stack, unclear duration, language requirement like German/Danish, or visa unclear).
- below 50: not software, needs on-site in a non-target country, requires a local language the candidate doesn't speak (candidate speaks English C1, French B2), wrong duration (e.g. summer-only 2 months), or requires existing EU/Swiss work authorization.
visa: "blocker" if the posting requires EU/EEA/Swiss citizenship or existing work authorization or says no sponsorship; "ok" if it offers sponsorship/relocation or welcomes international students; otherwise "warning". The candidate is Tunisian (non-EU).
Return one result per job, using the exact job id given.`;

  const out = new Map<string, JobScore>();
  for (let i = 0; i < jobs.length; i += BATCH) {
    const batch = jobs.slice(i, i + BATCH);
    const user = batch
      .map(
        (j) => `<job id="${j.id}">
<title>${j.title}</title>
<company>${j.company}</company>
<location>${j.location} (${j.country})</location>
<description>
${j.description.slice(0, 3000)}
</description>
</job>`,
      )
      .join("\n\n");
    const res = await generateStructured(provider, { system, user: `${user}\n\nScore these ${batch.length} jobs.`, schema: ScoreSchema });
    for (const r of res.results) {
      if (batch.some((j) => j.id === r.id))
        out.set(r.id, { score: Math.max(0, Math.min(100, Math.round(r.score))), visa: r.visa, reason: r.reason });
    }
  }
  return out;
}
