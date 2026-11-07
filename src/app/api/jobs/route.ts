import { ok } from "@/lib/http";
import { jobScore } from "@/lib/search/classify";
import { listJobs } from "@/lib/store";

// Descriptions are large; the list view gets a short excerpt and the detail call gets the full text.
export async function GET() {
  const jobs = listJobs()
    .map((j) => ({ ...j, description: j.description.slice(0, 600) }))
    .sort((a, b) => jobScore(b) - jobScore(a) || b.firstSeenAt.localeCompare(a.firstSeenAt));
  return ok(jobs);
}
