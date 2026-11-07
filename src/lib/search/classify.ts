// Pure helpers to classify and score job postings. No network, no AI.
import type { Job, JobKind, VisaFlag } from "../types";

const COUNTRY_PATTERNS: Record<string, RegExp> = {
  Portugal: /\b(portugal|lisbon|lisboa|porto|oporto|braga|coimbra|aveiro|faro|leiria|guimar[aã]es|matosinhos)\b/i,
  Switzerland: /\b(switzerland|schweiz|suisse|svizzera|zurich|z[uü]rich|geneva|gen[eè]ve|lausanne|basel|bern|berne|lugano|zug|st\.? ?gallen|winterthur|lucerne|luzern|neuch[aâ]tel|fribourg)\b/i,
  Denmark: /\b(denmark|danmark|copenhagen|k[øo]benhavn|aarhus|[aå]rhus|odense|aalborg|esbjerg|lyngby|kolding)\b/i,
};

const COUNTRY_CODES: Record<string, string> = { pt: "Portugal", ch: "Switzerland", dk: "Denmark" };

const EUROPE_REMOTE = /\b(europe|european|emea|\beu\b|cet|anywhere|worldwide|global|international)\b/i;
const NON_EUROPE = /\b(usa?|united states|america|canada|apac|asia|india|latam|brazil|australia|us[- ]only|north america|mexico|singapore|japan)\b/i;

export const REMOTE_EUROPE = "Remote (Europe)";

/** Returns a target country name, "Remote (Europe)", or "" when the location is outside the targets. */
export function detectCountry(
  location: string,
  opts: { countryCode?: string; remote?: boolean; targets: string[]; includeRemote: boolean },
): string {
  const code = opts.countryCode?.toLowerCase();
  if (code && COUNTRY_CODES[code] && opts.targets.includes(COUNTRY_CODES[code])) return COUNTRY_CODES[code];
  for (const t of opts.targets) {
    const re = COUNTRY_PATTERNS[t] ?? new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (re.test(location)) return t;
  }
  const isRemote = opts.remote || /\bremote\b/i.test(location);
  if (opts.includeRemote && isRemote) {
    // Keep remote roles that are open Europe-wide or unrestricted ("Remote", "Remote - EMEA", "Worldwide").
    // Drop ones pinned to another region or city ("Remote - US", "Berlin (remote)").
    const rest = location.replace(/\bremote\b|[()\-–,·|/]/gi, " ").trim();
    if (!rest) return REMOTE_EUROPE;
    if (EUROPE_REMOTE.test(rest) && !(NON_EUROPE.test(rest) && /\bonly\b/i.test(rest))) return REMOTE_EUROPE;
  }
  return "";
}

const INTERN_RE =
  /\b(intern|interns|internship|internships|trainee|traineeship|praktikant|praktikantin|praktik|praktikum|est[aá]gio|estagi[aá]rio|stagiaire|stage|thesis|final[- ]year|pfe|working student|werkstudent|student)\b/i;
const JUNIOR_RE = /\b(junior|jr\.?|graduate|new grad|entry[- ]level|early[- ]career)\b/i;
const SENIOR_RE = /\b(senior|sr\.?|staff|principal|lead|head of|director|manager|vp)\b/i;

const SOFTWARE_RE =
  /\b(software|developer|engineer|engineering|backend|back-end|frontend|front-end|full[- ]?stack|devops|dev ops|sre|site reliability|cloud|platform|infrastructure|data|machine learning|ml|ai|security|qa|test automation|programmer|web|mobile|ios|android|systems|kubernetes|java|python|golang|typescript|node)\b/i;
const NOT_SOFTWARE_RE =
  /\b(sales|account executive|account manager|marketing|recruit(er|ing|ment)?|talent|finance|financial|accounting|accountant|legal|lawyer|hr|people partner|customer success|customer support|support specialist|designer|brand|content|communications?|business development|procurement|purchase|payroll|office)\b/i;

export function classifyKind(title: string, includeJunior: boolean): JobKind | null {
  if (INTERN_RE.test(title)) return "internship";
  if (includeJunior && JUNIOR_RE.test(title) && !SENIOR_RE.test(title)) return "junior";
  return null;
}

export function isSoftwareRole(title: string): boolean {
  return SOFTWARE_RE.test(title) && !NOT_SOFTWARE_RE.test(title);
}

const VISA_BLOCKER =
  /((eu|eea|swiss|danish|portuguese|european) (citizen|citizenship|passport|nationals?))|right to work in (the )?(eu|eea|denmark|switzerland|portugal)|(valid|existing|current) (eu |swiss |danish )?(work|residence) permit|must (already )?(have|hold|possess) (a )?(valid )?(eu |swiss )?(work|residence) permit|(already )?eligible to work in (the )?(eu|eea|denmark|switzerland|portugal)|no (visa )?sponsorship|(unable|not able|cannot|can't|can not) (to )?(provide )?(visa )?sponsor|without (the need for )?(visa |work permit |immigration )?sponsorship(?! for an? export)/i;
const VISA_OK =
  /(visa sponsorship (is )?(available|provided|offered)|we (will |can )?sponsor|sponsor (your |a )?(visa|work permit)|relocation (support|package|assistance|bonus)|help (you )?(with|to) relocat|international (students|applicants|candidates) (are )?welcome)/i;

export function visaHint(text: string): VisaFlag | "" {
  if (VISA_BLOCKER.test(text)) return "blocker";
  if (VISA_OK.test(text)) return "ok";
  return "";
}

/** Pull skill keywords from the SKILLS section of the profile text. */
export function skillsFromProfile(profile: string): string[] {
  const section = profile.split(/\n\s*SKILLS\s*\n/i)[1]?.split(/\n\s*(EXPERIENCE|PROJECTS)\s*\n/i)[0] ?? "";
  const seen = new Set<string>();
  for (const line of section.split("\n")) {
    const items = line.replace(/^[-•*]\s*/, "").split(":").slice(1).join(":") || line;
    // Keep compound skills like "CI/CD" intact; split the rest on commas, slashes and parentheses.
    for (const raw of items.replace(/CI\/CD/gi, "CI_CD").split(/[,/()]| and /).map((x) => x.replace("CI_CD", "CI/CD"))) {
      const k = raw.trim().replace(/\.$/, "");
      if (k.length >= 1 && k.length <= 24 && !/^(rbac|automated|e2e testing)$/i.test(k)) seen.add(k);
    }
  }
  return [...seen].filter((k) => /[a-z0-9#+]/i.test(k));
}

function skillRegex(skill: string): RegExp {
  const esc = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\.js$/i, "(\\.?js)?");
  // Short names ("Go", "C#", "SQL") are matched case-sensitively so "go" or "sql-like" prose doesn't count.
  return new RegExp(`(^|[^A-Za-z0-9])${esc}($|[^A-Za-z0-9#+])`, skill.length <= 3 ? "" : "i");
}

const TITLE_BONUS: [RegExp, number][] = [
  [/\b(backend|back-end|platform|infrastructure|devops|sre|cloud|distributed|full[- ]?stack)\b/i, 25],
  [/\b(software|developer|engineer)\b/i, 15],
  [/\b(data|machine learning|ml|ai|security)\b/i, 6],
];

export function localScore(input: {
  title: string;
  text: string;
  kind: JobKind;
  country: string;
  targets: string[];
  visa: VisaFlag | "";
  skills: string[];
}): { score: number; matched: string[] } {
  const matched = input.skills.filter((s) => skillRegex(s).test(input.text) || skillRegex(s).test(input.title));
  let score = Math.round(40 * Math.min(1, matched.length / 8));
  score += TITLE_BONUS.find(([re]) => re.test(input.title))?.[1] ?? 0;
  score += input.kind === "internship" ? 15 : 5;
  score += input.targets.includes(input.country) ? 10 : 4;
  if (input.visa === "blocker") score -= 30;
  if (input.visa === "ok") score += 10;
  return { score: Math.max(0, Math.min(100, score)), matched: matched.slice(0, 12) };
}

/** Best available score: the AI score when present, otherwise the local keyword score. */
export function jobScore(j: Pick<Job, "ai" | "localScore">): number {
  return j.ai?.score ?? j.localScore;
}
