import "server-only";
import { htmlToText } from "../fetchJob";
import type { Ats, WatchCompany } from "../types";

export interface RawJob {
  externalId: string;
  source: string;
  company: string;
  title: string;
  location: string;
  countryCode?: string;
  remote: boolean;
  url: string;
  description: string; // may be empty; filled lazily for some sources
  postedAt: string;
  detailUrl?: string; // SmartRecruiters needs a second request for the description
}

const UA = "Mozilla/5.0 (personal internship assistant; contact via GitHub Jasser1920)";

/** Join location parts, dropping empties and repeats ("Zurich · Zurich, Switzerland" → "Zurich, Switzerland"). */
export function joinLocations(parts: (string | undefined | null)[]): string {
  const clean = parts.map((p) => p?.trim()).filter((p): p is string => Boolean(p));
  const out: string[] = [];
  for (const p of clean) {
    const lower = p.toLowerCase();
    if (out.some((o) => o.toLowerCase().includes(lower))) continue;
    for (let i = out.length - 1; i >= 0; i--) if (lower.includes(out[i].toLowerCase())) out.splice(i, 1);
    out.push(p);
  }
  return out.join(" · ");
}

export async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "User-Agent": UA, Accept: "application/json", ...init?.headers },
    signal: AbortSignal.timeout(25_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

const iso = (v: string | number | undefined | null) => {
  if (v === undefined || v === null || v === "") return "";
  const d = typeof v === "number" ? new Date(v < 1e12 ? v * 1000 : v) : new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
};

// ---------- ATS boards ----------

interface GreenhouseResp {
  jobs: { id: number; title: string; absolute_url: string; location?: { name?: string }; updated_at?: string; first_published?: string; content?: string; company_name?: string; offices?: { location?: string; name?: string }[] }[];
}
async function greenhouse(c: WatchCompany): Promise<RawJob[]> {
  const d = await getJson<GreenhouseResp>(`https://boards-api.greenhouse.io/v1/boards/${c.token}/jobs?content=true`);
  return d.jobs.map((j) => {
    const location = joinLocations([j.location?.name, ...(j.offices ?? []).map((o) => o.location || o.name)]);
    return {
      externalId: String(j.id),
      source: "greenhouse",
      company: c.name,
      title: j.title.trim(),
      location,
      remote: /remote/i.test(location),
      url: j.absolute_url,
      // Greenhouse double-encodes the HTML (&lt;p&gt;); htmlToText decodes entities, so run it twice.
      description: htmlToText(htmlToText(j.content ?? "")),
      postedAt: iso(j.first_published || j.updated_at),
    };
  });
}

interface LeverPosting {
  id: string; text: string; hostedUrl: string; createdAt?: number; country?: string; workplaceType?: string;
  categories?: { location?: string; allLocations?: string[]; commitment?: string };
  descriptionPlain?: string; additionalPlain?: string; lists?: { text: string; content: string }[];
}
async function lever(c: WatchCompany): Promise<RawJob[]> {
  const d = await getJson<LeverPosting[]>(`https://api.lever.co/v0/postings/${c.token}?mode=json`);
  return d.map((j) => {
    const location = joinLocations([j.categories?.location, ...(j.categories?.allLocations ?? [])]);
    const lists = (j.lists ?? []).map((l) => `${l.text}\n${htmlToText(l.content)}`).join("\n\n");
    return {
      externalId: j.id,
      source: "lever",
      company: c.name,
      title: j.text.trim(),
      location,
      countryCode: j.country,
      remote: j.workplaceType === "remote" || /remote/i.test(location),
      url: j.hostedUrl,
      description: [j.descriptionPlain, lists, j.additionalPlain].filter(Boolean).join("\n\n"),
      postedAt: iso(j.createdAt),
    };
  });
}

interface AshbyResp {
  jobs: {
    id: string; title: string; location?: string; jobUrl: string; publishedAt?: string; isRemote?: boolean | null; workplaceType?: string | null; isListed?: boolean;
    secondaryLocations?: { location?: string }[]; address?: { postalAddress?: { addressCountry?: string; addressLocality?: string } } | null;
    descriptionPlain?: string;
  }[];
}
async function ashby(c: WatchCompany): Promise<RawJob[]> {
  const d = await getJson<AshbyResp>(`https://api.ashbyhq.com/posting-api/job-board/${c.token}`);
  return d.jobs
    .filter((j) => j.isListed !== false)
    .map((j) => {
      const location = joinLocations([
        j.location,
        j.address?.postalAddress?.addressLocality,
        j.address?.postalAddress?.addressCountry,
        ...(j.secondaryLocations ?? []).map((s) => s.location),
      ]);
      return {
        externalId: j.id,
        source: "ashby",
        company: c.name,
        title: j.title.trim(),
        location,
        remote: Boolean(j.isRemote) || j.workplaceType === "Remote" || /remote/i.test(location),
        url: j.jobUrl,
        description: j.descriptionPlain ?? "",
        postedAt: iso(j.publishedAt),
      };
    });
}

interface SrList {
  totalFound: number;
  content: { id: string; name: string; releasedDate?: string; ref: string; location?: { city?: string; region?: string; country?: string; remote?: boolean; fullLocation?: string } }[];
}
async function smartrecruiters(c: WatchCompany): Promise<RawJob[]> {
  const out: RawJob[] = [];
  for (let offset = 0; offset < 500; offset += 100) {
    const d = await getJson<SrList>(`https://api.smartrecruiters.com/v1/companies/${c.token}/postings?limit=100&offset=${offset}`);
    for (const j of d.content) {
      const loc = j.location ?? {};
      out.push({
        externalId: j.id,
        source: "smartrecruiters",
        company: c.name,
        title: j.name.trim(),
        location: loc.fullLocation || [loc.city, loc.region, loc.country?.toUpperCase()].filter(Boolean).join(", "),
        countryCode: loc.country,
        remote: Boolean(loc.remote),
        url: `https://jobs.smartrecruiters.com/${c.token}/${j.id}`,
        description: "",
        postedAt: iso(j.releasedDate),
        detailUrl: j.ref,
      });
    }
    if (offset + 100 >= d.totalFound) break;
  }
  return out;
}

interface SrDetail {
  postingUrl?: string;
  jobAd?: { sections?: Record<string, { title?: string; text?: string }> };
}
/** Fill description (and canonical URL) for postings that need a detail request. */
export async function enrich(job: RawJob): Promise<RawJob> {
  if (!job.detailUrl || job.description) return job;
  const d = await getJson<SrDetail>(job.detailUrl);
  const sections = Object.values(d.jobAd?.sections ?? {})
    .map((s) => (s.text ? `${s.title ?? ""}\n${htmlToText(s.text)}` : ""))
    .filter(Boolean)
    .join("\n\n");
  return { ...job, description: sections, url: d.postingUrl || job.url };
}

export const ATS_FETCHERS: Record<Ats, (c: WatchCompany) => Promise<RawJob[]>> = { greenhouse, lever, ashby, smartrecruiters };

/** Check that a board exists and return its open-role count (used by discovery + the watchlist editor). */
export async function verifyBoard(ats: Ats, token: string): Promise<number> {
  try {
    return (await ATS_FETCHERS[ats]({ name: token, ats, token, country: "" })).length;
  } catch {
    return -1;
  }
}

// ---------- aggregators ----------

interface ArbeitnowResp {
  data: { slug: string; company_name: string; title: string; description: string; remote: boolean; url: string; location: string; created_at: number; tags?: string[] }[];
}
export async function arbeitnow(): Promise<RawJob[]> {
  const out: RawJob[] = [];
  for (let page = 1; page <= 3; page++) {
    const d = await getJson<ArbeitnowResp>(`https://www.arbeitnow.com/api/job-board-api?page=${page}`);
    for (const j of d.data)
      out.push({
        externalId: j.slug,
        source: "arbeitnow",
        company: j.company_name,
        title: j.title.trim(),
        location: j.location || (j.remote ? "Remote" : ""),
        remote: j.remote,
        url: j.url,
        description: htmlToText(j.description),
        postedAt: iso(j.created_at),
      });
    if (d.data.length < 100) break;
  }
  return out;
}

type RemoteOkItem = { id?: string; slug?: string; company?: string; position?: string; location?: string; description?: string; url?: string; date?: string; tags?: string[] };
export async function remoteok(): Promise<RawJob[]> {
  const d = await getJson<RemoteOkItem[]>("https://remoteok.com/api");
  return d
    .filter((j) => j.id && j.position)
    .map((j) => ({
      externalId: String(j.id),
      source: "remoteok",
      company: j.company ?? "",
      title: (j.position ?? "").trim(),
      location: j.location || "Remote",
      remote: true,
      url: j.url ?? `https://remoteok.com/remote-jobs/${j.slug}`,
      description: htmlToText(j.description ?? ""),
      postedAt: iso(j.date),
    }));
}

interface JoobleResp {
  jobs?: { id: number | string; title: string; location: string; snippet: string; link: string; company: string; updated: string }[];
}
/** Jooble (needs JOOBLE_API_KEY). One request per target country. */
export async function jooble(keywords: string, countries: string[]): Promise<RawJob[]> {
  const key = process.env.JOOBLE_API_KEY;
  if (!key) return [];
  const out: RawJob[] = [];
  for (const location of countries) {
    const d = await getJson<JoobleResp>(`https://jooble.org/api/${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keywords, location, page: "1" }),
    });
    for (const j of d.jobs ?? [])
      out.push({
        externalId: String(j.id),
        source: "jooble",
        company: j.company,
        title: htmlToText(j.title),
        location: j.location ? `${j.location}, ${location}` : location,
        remote: /remote/i.test(j.location),
        url: j.link,
        description: htmlToText(j.snippet),
        postedAt: iso(j.updated),
      });
  }
  return out;
}

interface AdzunaResp {
  results?: { id: string; title: string; description: string; redirect_url: string; created: string; company?: { display_name?: string }; location?: { display_name?: string } }[];
}
/** Adzuna (needs ADZUNA_APP_ID + ADZUNA_APP_KEY). Of the target countries only Switzerland is covered. */
export async function adzuna(keywords: string, countries: string[]): Promise<RawJob[]> {
  const id = process.env.ADZUNA_APP_ID;
  const key = process.env.ADZUNA_APP_KEY;
  if (!id || !key || !countries.includes("Switzerland")) return [];
  const q = new URLSearchParams({ app_id: id, app_key: key, results_per_page: "50", what: keywords, "content-type": "application/json" });
  const d = await getJson<AdzunaResp>(`https://api.adzuna.com/v1/api/jobs/ch/search/1?${q}`);
  return (d.results ?? []).map((j) => ({
    externalId: String(j.id),
    source: "adzuna",
    company: j.company?.display_name ?? "",
    title: htmlToText(j.title),
    location: `${j.location?.display_name ?? ""}, Switzerland`,
    countryCode: "ch",
    remote: false,
    url: j.redirect_url,
    description: htmlToText(j.description),
    postedAt: iso(j.created),
  }));
}
