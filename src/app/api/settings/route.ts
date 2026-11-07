import { DEFAULT_SETTINGS } from "@/lib/defaults";
import { fail, ok } from "@/lib/http";
import { getEnvStatus, getSettings, saveSettings } from "@/lib/store";
import { ATS_TYPES, type SearchSettings, type Settings, type WatchCompany } from "@/lib/types";

export async function GET() {
  return ok({ settings: getSettings(), env: getEnvStatus(), defaults: DEFAULT_SETTINGS });
}

function cleanWatchlist(list: unknown): WatchCompany[] | null {
  if (!Array.isArray(list)) return null;
  const out: WatchCompany[] = [];
  for (const c of list as Partial<WatchCompany>[]) {
    if (!c?.name?.trim() || !c.token?.trim() || !ATS_TYPES.includes(c.ats as WatchCompany["ats"])) return null;
    out.push({
      name: c.name.trim(),
      ats: c.ats as WatchCompany["ats"],
      token: c.token.trim(),
      country: c.country?.trim() ?? "",
      domain: c.domain?.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "") || undefined,
    });
  }
  return out;
}

function cleanSearch(s: Partial<SearchSettings>, current: SearchSettings): SearchSettings {
  const num = (v: unknown, min: number, max: number, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback;
  const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
  return {
    countries: Array.isArray(s.countries) ? s.countries.filter((c) => typeof c === "string" && c.trim()).map((c) => c.trim()) : current.countries,
    includeRemote: bool(s.includeRemote, current.includeRemote),
    includeJunior: bool(s.includeJunior, current.includeJunior),
    useArbeitnow: bool(s.useArbeitnow, current.useArbeitnow),
    useRemoteOk: bool(s.useRemoteOk, current.useRemoteOk),
    useJooble: bool(s.useJooble, current.useJooble),
    useAdzuna: bool(s.useAdzuna, current.useAdzuna),
    keywords: typeof s.keywords === "string" ? s.keywords : current.keywords,
    aiScoreLimit: num(s.aiScoreLimit, 0, 100, current.aiScoreLimit),
    autoDaily: bool(s.autoDaily, current.autoDaily),
    dailyHour: num(s.dailyHour, 0, 23, current.dailyHour),
    digestEmail: bool(s.digestEmail, current.digestEmail),
    digestMinScore: num(s.digestMinScore, 0, 100, current.digestMinScore),
    autoInboxSync: bool(s.autoInboxSync, current.autoInboxSync),
  };
}

export async function PUT(req: Request) {
  const body = (await req.json()) as Partial<Settings>;
  const current = getSettings();
  const patch: Partial<Settings> = {};
  if (body.defaultProvider === "claude" || body.defaultProvider === "gemini") patch.defaultProvider = body.defaultProvider;
  if (typeof body.followUpDays === "number" && body.followUpDays > 0) patch.followUpDays = Math.round(body.followUpDays);
  for (const k of ["profile", "rules", "signature"] as const) if (typeof body[k] === "string") patch[k] = body[k];
  if (Array.isArray(body.samples)) patch.samples = body.samples.filter((s) => typeof s === "string");
  if (patch.signature !== undefined && patch.signature.split("\n").filter(Boolean).length < 2)
    return fail("Signature needs at least a sign-off line and your name.");
  if (body.watchlist !== undefined) {
    const w = cleanWatchlist(body.watchlist);
    if (!w) return fail("Each watchlist company needs a name, an ATS and a board token.");
    patch.watchlist = w;
  }
  if (body.search) patch.search = cleanSearch(body.search, current.search);
  return ok({ settings: saveSettings(patch), env: getEnvStatus() });
}
