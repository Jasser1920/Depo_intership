import { fail, ok } from "@/lib/http";
import { syncInbox } from "@/lib/inbox";

export const maxDuration = 300;

export async function POST() {
  try {
    return ok(await syncInbox());
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Inbox sync failed", 502);
  }
}
