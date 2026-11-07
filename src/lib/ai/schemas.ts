import { z } from "zod";

export const GenerationSchema = z.object({
  company: z.string().describe("Company name"),
  role: z.string().describe("Role title, or a fitting internship title for spontaneous applications"),
  country: z.string().describe("Country of the position"),
  city: z.string().describe("City, or empty string if unknown"),
  contactName: z.string().describe("Recruiter / hiring manager full name if known, else empty string"),
  contactEmail: z.string().describe("Only an email address that literally appears in the input, else empty string"),
  match: z.object({
    score: z.number().describe("Honest 0-100 fit between the candidate facts and the job"),
    matched: z.array(z.string()).describe("Job requirements the candidate clearly covers"),
    missing: z.array(z.string()).describe("Job requirements the candidate facts do not cover"),
    summary: z.string().describe("One or two sentences explaining the score"),
  }),
  visa: z.object({
    flag: z.enum(["ok", "warning", "blocker"]),
    note: z.string().describe("Short explanation for a non-EU (Tunisian) intern"),
  }),
  companyChallenge: z.string().describe("The core engineering challenge used as the hook, one sentence"),
  subjects: z
    .array(z.object({ angle: z.string(), text: z.string() }))
    .describe("Exactly 5 subject lines, one per angle, in the required order"),
  greeting: z.string().describe('e.g. "Dear Tania Fernandes," or "Dear Pleo Engineering Team,"'),
  letterBody: z
    .string()
    .describe("Letter body between greeting and sign-off. Paragraphs separated by blank lines, bullets start with '• '. No greeting, no sign-off, no signature."),
  linkedinMessage: z.string().describe("50-80 words, C-R-V-A"),
  connectionNote: z.string().describe("Under 300 characters"),
});
export type Generation = z.infer<typeof GenerationSchema>;

export const FollowUpSchema = z.object({
  subject: z.string(),
  body: z.string().describe("Follow-up email body starting with the greeting; no signature"),
});
export type FollowUpDraft = z.infer<typeof FollowUpSchema>;
