import { DEFAULT_SETTINGS } from "@/lib/defaults";
import { fail, ok } from "@/lib/http";
import { getEnvStatus, getSettings, saveSettings } from "@/lib/store";
import type { Settings } from "@/lib/types";

export async function GET() {
  return ok({ settings: getSettings(), env: getEnvStatus(), defaults: DEFAULT_SETTINGS });
}

export async function PUT(req: Request) {
  const body = (await req.json()) as Partial<Settings>;
  const patch: Partial<Settings> = {};
  if (body.defaultProvider === "claude" || body.defaultProvider === "gemini") patch.defaultProvider = body.defaultProvider;
  if (typeof body.followUpDays === "number" && body.followUpDays > 0) patch.followUpDays = Math.round(body.followUpDays);
  for (const k of ["profile", "rules", "signature"] as const) if (typeof body[k] === "string") patch[k] = body[k];
  if (Array.isArray(body.samples)) patch.samples = body.samples.filter((s) => typeof s === "string");
  if (patch.signature !== undefined && patch.signature.split("\n").filter(Boolean).length < 2)
    return fail("Signature needs at least a sign-off line and your name.");
  return ok({ settings: saveSettings(patch), env: getEnvStatus() });
}
