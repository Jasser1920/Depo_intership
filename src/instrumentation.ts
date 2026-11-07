// Runs once when the Next.js server starts. Schedules the daily routine
// (search → inbox sync → digest) while the app is running.
// It calls the app's own endpoint instead of importing server modules directly.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.DISABLE_SCHEDULER === "1") return;
  const g = globalThis as typeof globalThis & { __internshipScheduler?: boolean };
  if (g.__internshipScheduler) return;
  g.__internshipScheduler = true;

  const { automationToken } = await import("./lib/automation/token");
  const port = process.env.PORT || "3000";
  const tick = async () => {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/automation/tick`, {
        method: "POST",
        headers: { "x-automation-token": automationToken() },
      });
      const body = (await res.json().catch(() => ({}))) as { did?: string; error?: string };
      if (body.did && body.did !== "nothing due") console.log(`[scheduler] ${body.did}`);
      if (body.error) console.error(`[scheduler] ${body.error}`);
    } catch {
      /* server not ready yet */
    }
  };
  setTimeout(tick, 45_000);
  setInterval(tick, 10 * 60_000);
}
