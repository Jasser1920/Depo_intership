import { tick } from "@/lib/automation/daily";
import { automationToken } from "@/lib/automation/token";
import { fail, handle, ok } from "@/lib/http";

export const maxDuration = 300;

// Only the in-process scheduler (instrumentation.ts) knows the token.
export async function POST(req: Request) {
  if (req.headers.get("x-automation-token") !== automationToken()) return fail("Forbidden", 403);
  try {
    return ok({ did: await tick() });
  } catch (e) {
    return handle(e);
  }
}
