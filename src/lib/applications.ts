import "server-only";
import { writeApplication, type JobInput } from "./ai/writer";
import { createApplication, getSettings } from "./store";
import type { Application, Provider } from "./types";

export function normalizeJobInput(body: Partial<JobInput>): JobInput {
  return {
    kind: body.kind === "spontaneous" ? "spontaneous" : "posting",
    url: body.url?.trim() ?? "",
    jobText: body.jobText?.trim() ?? "",
    company: body.company?.trim() ?? "",
    contactName: body.contactName?.trim() ?? "",
    contactEmail: body.contactEmail?.trim() ?? "",
    country: body.country?.trim() ?? "",
    notes: body.notes?.trim() ?? "",
  };
}

/** Generate a full application package with the AI and store it as a draft. */
export async function generateApplication(job: JobInput, provider?: Provider, jobId?: string): Promise<Application> {
  const settings = getSettings();
  const p: Provider = provider ?? settings.defaultProvider;
  const { generation: g, issues } = await writeApplication(p, settings, job);
  return createApplication({
    status: "draft",
    provider: p,
    jobId,
    source: { kind: job.kind, url: job.url, jobText: job.jobText, notes: job.notes },
    company: g.company || job.company,
    role: g.role,
    country: g.country || job.country,
    city: g.city,
    contactName: g.contactName || job.contactName,
    toEmail: job.contactEmail || g.contactEmail,
    cc: "",
    match: g.match,
    visa: g.visa,
    companyChallenge: g.companyChallenge,
    subjects: g.subjects,
    subject: g.subjects[0]?.text ?? "",
    greeting: g.greeting,
    letterBody: g.letterBody,
    linkedinMessage: g.linkedinMessage,
    connectionNote: g.connectionNote,
    attachLetterPdf: true,
    issues,
  });
}
