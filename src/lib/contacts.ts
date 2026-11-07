import "server-only";
import { getJson } from "./search/sources";

export interface Contact {
  email: string;
  name: string;
  position: string;
  department: string;
  confidence: number; // 0-100
  linkedin: string;
  relevance: number; // how useful this person is for an internship application
  source: "hunter" | "guess";
}

export interface ContactSearch {
  domain: string;
  organization: string;
  pattern: string;
  contacts: Contact[];
  hunterEnabled: boolean;
}

const ROLE_WEIGHTS: [RegExp, number][] = [
  [/\b(engineering manager|head of engineering|vp engineering|director of engineering|cto|chief technology)\b/i, 100],
  [/\b(tech(nical)? lead|team lead|staff engineer|principal engineer|platform lead|backend lead)\b/i, 85],
  [/\b(technical recruiter|tech recruiter|talent acquisition|recruit|university|campus|early careers|intern)\b/i, 80],
  [/\b(people|hr|human resources|talent)\b/i, 60],
  [/\b(engineer|developer|devops|sre)\b/i, 45],
  [/\b(founder|ceo|co-founder)\b/i, 40],
];

function relevance(position: string, department: string): number {
  const text = `${position} ${department}`;
  return ROLE_WEIGHTS.find(([re]) => re.test(text))?.[1] ?? (department === "it" ? 40 : 10);
}

export function cleanDomain(input: string): string {
  return input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/[/?#].*$/, "");
}

interface HunterDomainResp {
  data: {
    domain: string;
    organization?: string;
    pattern?: string;
    emails: { value: string; confidence?: number; first_name?: string; last_name?: string; position?: string; department?: string; linkedin?: string }[];
  };
}

const GENERIC = ["careers", "jobs", "talent", "recruiting", "hr", "internships"];

/** Find people at a company. Uses Hunter.io when HUNTER_API_KEY is set; otherwise suggests common inboxes. */
export async function findContacts(domainInput: string): Promise<ContactSearch> {
  const domain = cleanDomain(domainInput);
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) throw new Error("Enter a valid company domain, e.g. pleo.io");
  const key = process.env.HUNTER_API_KEY;
  const generic: Contact[] = GENERIC.map((g) => ({
    email: `${g}@${domain}`, name: "", position: "Common inbox (unverified guess)", department: "", confidence: 0, linkedin: "", relevance: 20, source: "guess",
  }));
  if (!key) return { domain, organization: "", pattern: "", contacts: generic, hunterEnabled: false };

  const q = new URLSearchParams({ domain, limit: "10", api_key: key });
  const d = await getJson<HunterDomainResp>(`https://api.hunter.io/v2/domain-search?${q}`);
  const contacts: Contact[] = d.data.emails.map((e) => ({
    email: e.value,
    name: [e.first_name, e.last_name].filter(Boolean).join(" "),
    position: e.position ?? "",
    department: e.department ?? "",
    confidence: e.confidence ?? 0,
    linkedin: e.linkedin ?? "",
    relevance: relevance(e.position ?? "", e.department ?? ""),
    source: "hunter",
  }));
  contacts.sort((a, b) => b.relevance - a.relevance || b.confidence - a.confidence);
  return { domain, organization: d.data.organization ?? "", pattern: d.data.pattern ?? "", contacts: [...contacts, ...generic], hunterEnabled: true };
}

interface HunterFinderResp {
  data: { email: string | null; score?: number; position?: string };
}
export async function findPersonEmail(domainInput: string, firstName: string, lastName: string) {
  const key = process.env.HUNTER_API_KEY;
  if (!key) throw new Error("Add HUNTER_API_KEY to .env.local to look up a specific person.");
  const q = new URLSearchParams({ domain: cleanDomain(domainInput), first_name: firstName, last_name: lastName, api_key: key });
  const d = await getJson<HunterFinderResp>(`https://api.hunter.io/v2/email-finder?${q}`);
  return { email: d.data.email ?? "", score: d.data.score ?? 0, position: d.data.position ?? "" };
}

interface HunterVerifyResp {
  data: { status: string; result?: string; score?: number };
}
export async function verifyEmail(email: string) {
  const key = process.env.HUNTER_API_KEY;
  if (!key) throw new Error("Add HUNTER_API_KEY to .env.local to verify emails.");
  const d = await getJson<HunterVerifyResp>(`https://api.hunter.io/v2/email-verifier?${new URLSearchParams({ email, api_key: key })}`);
  // status: valid | invalid | accept_all | webmail | disposable | unknown
  return { status: d.data.status, score: d.data.score ?? 0 };
}
