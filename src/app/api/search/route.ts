import { handle, ok } from "@/lib/http";
import { isSearchRunning, runSearch } from "@/lib/search/engine";
import { listRuns } from "@/lib/store";
import type { Provider } from "@/lib/types";

export const maxDuration = 300;

export async function GET() {
  return ok({ running: isSearchRunning(), runs: listRuns() });
}

export async function POST(req: Request) {
  const { provider, skipAi } = (await req.json().catch(() => ({}))) as { provider?: Provider; skipAi?: boolean };
  try {
    return ok(await runSearch("manual", { provider, skipAi }));
  } catch (e) {
    return handle(e);
  }
}
