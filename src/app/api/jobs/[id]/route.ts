import { fail, ok } from "@/lib/http";
import { getJob, updateJob } from "@/lib/store";
import type { JobStatus } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };
const STATUSES: JobStatus[] = ["new", "saved", "dismissed", "applied"];

export async function GET(_req: Request, { params }: Ctx) {
  const job = getJob(decodeURIComponent((await params).id));
  return job ? ok(job) : fail("Not found", 404);
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { status } = (await req.json()) as { status?: JobStatus };
  if (!status || !STATUSES.includes(status)) return fail("Invalid status");
  const job = updateJob(decodeURIComponent((await params).id), { status });
  return job ? ok(job) : fail("Not found", 404);
}
