import { runDaily } from "@/lib/automation/daily";
import { handle, ok } from "@/lib/http";

export const maxDuration = 300;

export async function POST() {
  try {
    return ok(await runDaily("manual"));
  } catch (e) {
    return handle(e);
  }
}
