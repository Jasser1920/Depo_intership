import "server-only";

const ENTITIES: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'", "&nbsp;": " ",
};

function decode(s: string): string {
  return s
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (m) => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

export function htmlToText(html: string): string {
  return decode(
    html
      .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6]|tr|section)>/gi, "\n")
      .replace(/<li[^>]*>/gi, "• ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*/g, "\n\n")
    .trim();
}

interface JobPostingLd {
  "@type"?: string | string[];
  title?: string;
  description?: string;
  hiringOrganization?: { name?: string };
  jobLocation?: { address?: { addressCountry?: string | { name?: string }; addressLocality?: string } } | unknown[];
}

function findJobPosting(node: unknown): JobPostingLd | undefined {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const n of node) {
      const f = findJobPosting(n);
      if (f) return f;
    }
    return;
  }
  const obj = node as Record<string, unknown>;
  const t = obj["@type"];
  if (t === "JobPosting" || (Array.isArray(t) && t.includes("JobPosting"))) return obj as JobPostingLd;
  if (obj["@graph"]) return findJobPosting(obj["@graph"]);
}

export interface FetchedJob {
  text: string;
  company: string;
  title: string;
}

/** Fetch a public job page and turn it into plain text (prefers schema.org JobPosting data). */
export async function fetchJob(url: string): Promise<FetchedJob> {
  const u = new URL(url);
  if (!/^https?:$/.test(u.protocol)) throw new Error("Only http(s) links are supported.");
  const res = await fetch(u, {
    headers: { "User-Agent": "Mozilla/5.0 (personal internship assistant)", Accept: "text/html,application/json" },
    signal: AbortSignal.timeout(15_000),
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`The page answered ${res.status}. Paste the job description instead.`);
  const html = await res.text();

  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const job = findJobPosting(JSON.parse(m[1]));
      if (job?.description) {
        const text = [job.title, job.hiringOrganization?.name, htmlToText(decode(job.description))].filter(Boolean).join("\n\n");
        return { text: text.slice(0, 20_000), company: job.hiringOrganization?.name ?? "", title: job.title ?? "" };
      }
    } catch {
      /* ignore malformed JSON-LD */
    }
  }

  const title = decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim();
  const body = html.match(/<body[\s\S]*<\/body>/i)?.[0] ?? html;
  const text = htmlToText(body);
  if (text.length < 200) throw new Error("Could not read the job text (the page probably needs JavaScript). Paste it instead.");
  return { text: `${title}\n\n${text}`.slice(0, 20_000), company: "", title };
}
