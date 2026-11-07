import { generateApplication } from "@/lib/applications";
import { fail, handle, ok } from "@/lib/http";
import { REMOTE_EUROPE } from "@/lib/search/classify";
import { getApplication, getJob, updateJob } from "@/lib/store";
import type { Provider } from "@/lib/types";

export const maxDuration = 300;

/** Turn a found job into a draft application (AI-written), then link the two. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = decodeURIComponent((await params).id);
  const job = getJob(id);
  if (!job) return fail("Not found", 404);
  if (job.applicationId && getApplication(job.applicationId)) return ok(getApplication(job.applicationId));

  const { provider, notes } = (await req.json().catch(() => ({}))) as { provider?: Provider; notes?: string };
  try {
    const app = await generateApplication(
      {
        kind: "posting",
        url: job.url,
        jobText: `${job.title}\n${job.company} — ${job.location}\n\n${job.description}`,
        company: job.company,
        contactName: "",
        contactEmail: "",
        country: job.country === REMOTE_EUROPE ? "" : job.country,
        notes: notes ?? "",
      },
      provider,
      job.id,
    );
    updateJob(id, { status: "applied", applicationId: app.id });
    return ok(app, 201);
  } catch (e) {
    return handle(e);
  }
}
