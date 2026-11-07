import "server-only";
import { checkDraft } from "../checks";
import { COUNTRY_NOTES } from "../defaults";
import type { Application, Provider, Settings } from "../types";
import { generateStructured } from "./providers";
import { FollowUpSchema, GenerationSchema, type Generation } from "./schemas";

export interface JobInput {
  kind: "posting" | "spontaneous";
  url: string;
  jobText: string;
  company: string;
  contactName: string;
  contactEmail: string;
  country: string;
  notes: string;
}

const SUBJECT_ANGLES = [
  "Observation & tech fit",
  "Personal project → company bridge",
  "Targeted technical question",
  "Concrete metric hook",
  "Contrast hook",
];

function buildSystem(s: Settings): string {
  const samples = s.samples
    .filter((x) => x.trim())
    .map((x, i) => `<sample index="${i + 1}">\n${x.trim()}\n</sample>`)
    .join("\n");

  return `You write internship application emails for one candidate, in the candidate's own first-person voice. The reader is an engineering manager or technical recruiter in Europe who skims; every sentence must carry technical substance specific to their company.

<candidate_facts>
${s.profile.trim()}
</candidate_facts>
These are the only facts you may use about the candidate. Never invent employers, metrics, technologies, dates or achievements that are not listed. You may choose and rephrase facts, and pick the ones most relevant to the employer.

<writing_rules>
${s.rules.trim()}
</writing_rules>

<style_samples>
${samples}
</style_samples>
The samples show the structure, density and tone the candidate wants (hook → "As a final-year…" + bullets → company bridge → ask). Match that style, but obey the length rules in <writing_rules> even where a sample is longer. Never reuse company-specific content from a sample.

<country_notes>
${COUNTRY_NOTES}
</country_notes>

<output_requirements>
- greeting: "Dear <Full Name>," if a contact name is known, otherwise "Dear <Company> Engineering Team," (or "Recruitment Team").
- letterBody: only the text between the greeting and the sign-off (the app appends the signature). Separate paragraphs with a blank line; bullets start with "• ", one per line. 180–220 words. Sentence 1 states the company's specific engineering challenge.
- The mobility statement must name the position's country and the real availability (from 1 December 2026, 6-month minimum PFE).
- subjects: exactly 5, in this order of angles: ${SUBJECT_ANGLES.map((a, i) => `${i + 1}) ${a}`).join("; ")}. Each 6–10 words.
- linkedinMessage: 50–80 words, Context → Relevance → Value → Ask. connectionNote: under 300 characters.
- match: be honest; a weak fit gets a low score. "missing" lists requirements from the job text that the facts do not cover.
- visa: the candidate is Tunisian (non-EU). "blocker" if the posting requires existing EU/EEA/Swiss work authorization or citizenship; "warning" if it is unclear or the position is in Switzerland without stated support; "ok" if it mentions visa sponsorship, relocation support, or accepts international students.
- contactEmail: only an email address that literally appears in the input; otherwise "".
- For spontaneous applications with little job text, base the hook on the company's publicly known product domain; do not invent internal project names or numbers.
</output_requirements>`;
}

function buildUser(job: JobInput): string {
  return `<application kind="${job.kind}">
<company_hint>${job.company || "(infer from the job text)"}</company_hint>
<country_hint>${job.country || "(infer from the job text)"}</country_hint>
<contact_name_hint>${job.contactName || "(unknown)"}</contact_name_hint>
<contact_email_hint>${job.contactEmail || "(unknown)"}</contact_email_hint>
<url>${job.url || "(none)"}</url>
<candidate_notes>${job.notes || "(none)"}</candidate_notes>
<job_text>
${job.jobText.trim() || "(no job text — spontaneous application)"}
</job_text>
</application>

Write the application package.`;
}

export interface WriterResult {
  generation: Generation;
  issues: string[];
}

/** Generate, check against the rules, and revise once if any rule is broken. */
export async function writeApplication(
  provider: Provider,
  settings: Settings,
  job: JobInput,
  feedback?: string,
): Promise<WriterResult> {
  const system = buildSystem(settings);
  let user = buildUser(job);
  if (feedback?.trim()) user += `\n\nExtra instructions from the candidate for this version:\n${feedback.trim()}`;

  let generation = await generateStructured(provider, { system, user, schema: GenerationSchema });
  let issues = checkDraft(generation);

  if (issues.length) {
    const revisionUser = `${user}

<previous_draft>
${JSON.stringify(generation, null, 2)}
</previous_draft>

The previous draft breaks these rules:
${issues.map((i) => `- ${i}`).join("\n")}

Return the full package again with every problem fixed. Keep everything else that already works.`;
    generation = await generateStructured(provider, { system, user: revisionUser, schema: GenerationSchema });
    issues = checkDraft(generation);
  }

  if (generation.contactEmail && !job.jobText.includes(generation.contactEmail) && generation.contactEmail !== job.contactEmail) {
    generation.contactEmail = ""; // never trust an email the model didn't actually see
  }
  return { generation, issues };
}

export async function writeFollowUp(provider: Provider, settings: Settings, app: Application) {
  const days = app.sentAt ? Math.round((Date.now() - Date.parse(app.sentAt)) / 86_400_000) : settings.followUpDays;
  const system = `You write short, peer-to-peer follow-up emails for an internship candidate. Same voice and banned-word rules as below. 50–80 words. No guilt-tripping, no "just checking in", no apologies. Add one new piece of technical value (a relevant fact or idea tied to the company's product) and a low-friction ask.

<candidate_facts>
${settings.profile.trim()}
</candidate_facts>

<writing_rules>
${settings.rules.trim()}
</writing_rules>`;
  const user = `Original email sent ${days} days ago to ${app.company} (${app.role}).
Subject: ${app.subject}

${app.greeting}

${app.letterBody}

Write the follow-up. subject: "Re: " + the original subject. body: start with the same greeting; no signature.`;
  return generateStructured(provider, { system, user, schema: FollowUpSchema });
}
