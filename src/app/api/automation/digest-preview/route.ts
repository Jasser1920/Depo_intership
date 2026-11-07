import { collectDigest, renderDigest } from "@/lib/automation/digest";
import { listRuns } from "@/lib/store";

// Renders the digest for the latest search so you can see what the email looks like.
export async function GET() {
  const run = listRuns()[0];
  if (!run) return new Response("Run a search first.", { status: 404 });
  const { subject, html } = renderDigest(collectDigest(run));
  return new Response(`<!doctype html><meta charset="utf-8"><title>${subject}</title><body style="padding:24px">${html}</body>`, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
