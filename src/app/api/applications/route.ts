import { writeApplication, type JobInput } from "@/lib/ai/writer";
import { fail, handle, ok } from "@/lib/http";
import { createApplication, getSettings, listApplications } from "@/lib/store";
import type { Provider } from "@/lib/types";

export const maxDuration = 300;

export async function GET() {
  return ok(listApplications());
}

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<JobInput> & { provider?: Provider };
  const job: JobInput = {
    kind: body.kind === "spontaneous" ? "spontaneous" : "posting",
    url: body.url?.trim() ?? "",
    jobText: body.jobText?.trim() ?? "",
    company: body.company?.trim() ?? "",
    contactName: body.contactName?.trim() ?? "",
    contactEmail: body.contactEmail?.trim() ?? "",
    country: body.country?.trim() ?? "",
    notes: body.notes?.trim() ?? "",
  };
  if (!job.jobText && !job.company) return fail("Give at least a job description or a company name.");

  const settings = getSettings();
  const provider: Provider = body.provider ?? settings.defaultProvider;
  try {
    const { generation: g, issues } = await writeApplication(provider, settings, job);
    const app = createApplication({
      status: "draft",
      provider,
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
    return ok(app, 201);
  } catch (e) {
    return handle(e);
  }
}
