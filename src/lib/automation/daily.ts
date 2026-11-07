import "server-only";
import { syncInbox, type InboxResult } from "../inbox";
import { runSearch } from "../search/engine";
import { getEnvStatus, getSettings, saveSettings, updateRun } from "../store";
import type { SearchRun } from "../types";
import { collectDigest, hasContent, sendDigest } from "./digest";

export function localDate(d = new Date()): string {
  return d.toLocaleDateString("en-CA"); // YYYY-MM-DD in the server's local time zone
}

export interface DailyResult {
  run: SearchRun;
  inbox?: InboxResult;
  inboxError?: string;
  digestSent: boolean;
  digestError?: string;
}

let dailyRunning: Promise<DailyResult> | null = null;

/** Search → inbox sync → digest email. Safe to call repeatedly; concurrent calls share one run. */
export function runDaily(trigger: SearchRun["trigger"]): Promise<DailyResult> {
  if (!dailyRunning) dailyRunning = doDaily(trigger).finally(() => (dailyRunning = null));
  return dailyRunning;
}

async function doDaily(trigger: SearchRun["trigger"]): Promise<DailyResult> {
  const settings = getSettings();
  const env = getEnvStatus();
  saveSettings({ lastDailyRun: localDate() }); // mark first so a crash doesn't cause a retry loop

  const run = await runSearch(trigger);
  const result: DailyResult = { run, digestSent: false };

  if (settings.search.autoInboxSync && env.gmail) {
    try {
      result.inbox = await syncInbox();
    } catch (e) {
      result.inboxError = e instanceof Error ? e.message : String(e);
    }
  }

  if (settings.search.digestEmail && env.gmail) {
    const digest = collectDigest(run, result.inbox);
    if (hasContent(digest)) {
      try {
        await sendDigest(digest);
        result.digestSent = true;
      } catch (e) {
        result.digestError = e instanceof Error ? e.message : String(e);
      }
    }
  }
  updateRun(run.id, { digestSent: result.digestSent, repliesFound: result.inbox?.replies.length ?? 0 });
  return result;
}

/** Called every few minutes by the scheduler: decides what is due. */
export async function tick(): Promise<string> {
  const s = getSettings();
  const env = getEnvStatus();
  const now = new Date();
  if (s.search.autoDaily && now.getHours() >= s.search.dailyHour && s.lastDailyRun !== localDate(now)) {
    await runDaily("daily");
    return "daily run";
  }
  const lastSync = s.lastInboxSync ? Date.parse(s.lastInboxSync) : 0;
  if (s.search.autoInboxSync && env.gmail && Date.now() - lastSync > 3 * 3_600_000) {
    await syncInbox();
    return "inbox sync";
  }
  return "nothing due";
}
