import "server-only";
import { z } from "zod";
import { verifyBoard } from "../search/sources";
import { ATS_TYPES, type Ats, type Provider, type Settings } from "../types";
import { generateStructured } from "./providers";

const DiscoverySchema = z.object({
  companies: z.array(
    z.object({
      name: z.string(),
      country: z.string(),
      city: z.string(),
      domain: z.string().describe("Company website domain, e.g. pleo.io"),
      why: z.string().describe("One sentence: why this company fits the candidate's backend/cloud profile"),
      atsGuesses: z
        .array(z.object({ ats: z.enum(ATS_TYPES), token: z.string() }))
        .describe("Best guesses for the company's careers board on Greenhouse, Lever, Ashby or SmartRecruiters"),
    }),
  ),
});

export interface DiscoveredCompany {
  name: string;
  country: string;
  city: string;
  domain: string;
  why: string;
  board: { ats: Ats; token: string; openRoles: number } | null;
}

function slugVariants(name: string, domain: string): string[] {
  const base = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const d = domain.toLowerCase().replace(/^www\./, "").split(".")[0];
  return [...new Set([base.replace(/[^a-z0-9]/g, ""), base.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), d].filter(Boolean))];
}

/** Ask the AI for companies, then keep only boards that really exist (each guess is checked live). */
export async function discoverCompanies(
  provider: Provider,
  settings: Settings,
  opts: { country: string; focus: string; count: number },
): Promise<DiscoveredCompany[]> {
  const exclude = settings.watchlist.map((c) => c.name).join(", ");
  const system = `You help a software engineering student find companies to target for a 6-month final-year internship (PFE) from 1 December 2026.

<candidate_facts>
${settings.profile.trim()}
</candidate_facts>

Suggest real, currently operating tech companies with engineering teams in the requested country whose stack or product fits the candidate (backend, distributed systems, cloud/DevOps, full-stack, real-time systems). Prefer product companies and scale-ups that hire interns and work in English. Only name companies you are confident exist; never invent companies. For each, guess the careers-board token on Greenhouse (boards.greenhouse.io/<token>), Lever (jobs.lever.co/<token>), Ashby (jobs.ashbyhq.com/<token>) or SmartRecruiters (jobs.smartrecruiters.com/<token>) — the app verifies these, so a wrong guess is harmless.`;
  const user = `Country: ${opts.country}
${opts.focus ? `Focus: ${opts.focus}\n` : ""}Already on the watchlist (do not repeat): ${exclude || "(none)"}
Suggest ${opts.count} companies.`;

  const { companies } = await generateStructured(provider, { system, user, schema: DiscoverySchema });

  return Promise.all(
    companies.slice(0, opts.count).map(async (c) => {
      const guesses: { ats: Ats; token: string }[] = [...c.atsGuesses];
      for (const slug of slugVariants(c.name, c.domain)) for (const ats of ATS_TYPES) guesses.push({ ats, token: slug });
      const unique = guesses.filter((g, i) => g.token && guesses.findIndex((o) => o.ats === g.ats && o.token.toLowerCase() === g.token.toLowerCase()) === i);
      let board: DiscoveredCompany["board"] = null;
      for (const g of unique) {
        const n = await verifyBoard(g.ats, g.token);
        if (n > 0) {
          board = { ats: g.ats, token: g.token, openRoles: n };
          break;
        }
      }
      return { name: c.name, country: c.country, city: c.city, domain: c.domain.replace(/^https?:\/\//, "").replace(/\/.*$/, ""), why: c.why, board };
    }),
  );
}
