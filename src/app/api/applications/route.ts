import { generateApplication, normalizeJobInput } from "@/lib/applications";
import type { JobInput } from "@/lib/ai/writer";
import { fail, handle, ok } from "@/lib/http";
import { listApplications } from "@/lib/store";
import type { Provider } from "@/lib/types";

export const maxDuration = 300;

export async function GET() {
  return ok(listApplications());
}

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<JobInput> & { provider?: Provider };
  const job = normalizeJobInput(body);
  if (!job.jobText && !job.company) return fail("Give at least a job description or a company name.");
  try {
    return ok(await generateApplication(job, body.provider), 201);
  } catch (e) {
    return handle(e);
  }
}
