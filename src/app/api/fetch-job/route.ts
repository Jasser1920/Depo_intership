import { fetchJob } from "@/lib/fetchJob";
import { fail, ok } from "@/lib/http";

export async function POST(req: Request) {
  const { url } = (await req.json()) as { url?: string };
  if (!url) return fail("Missing url");
  try {
    return ok(await fetchJob(url));
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Could not fetch the page.", 422);
  }
}
