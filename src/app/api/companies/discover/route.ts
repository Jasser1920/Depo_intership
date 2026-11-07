import { discoverCompanies } from "@/lib/ai/discovery";
import { fail, handle, ok } from "@/lib/http";
import { getSettings } from "@/lib/store";
import type { Provider } from "@/lib/types";

export const maxDuration = 300;

export async function POST(req: Request) {
  const { country, focus, count, provider } = (await req.json()) as { country?: string; focus?: string; count?: number; provider?: Provider };
  if (!country?.trim()) return fail("Pick a country.");
  const settings = getSettings();
  try {
    return ok(
      await discoverCompanies(provider ?? settings.defaultProvider, settings, {
        country: country.trim(),
        focus: focus?.trim() ?? "",
        count: Math.min(15, Math.max(3, count ?? 10)),
      }),
    );
  } catch (e) {
    return handle(e);
  }
}
