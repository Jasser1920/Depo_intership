import { writeApplication } from "@/lib/ai/writer";
import { fail, handle, ok } from "@/lib/http";
import { getApplication, getSettings, updateApplication } from "@/lib/store";
import type { Provider } from "@/lib/types";

export const maxDuration = 300;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const app = getApplication(id);
  if (!app) return fail("Not found", 404);
  const { provider, feedback } = (await req.json()) as { provider?: Provider; feedback?: string };
  const settings = getSettings();
  const p: Provider = provider ?? app.provider;
  try {
    const { generation: g, issues } = await writeApplication(
      p,
      settings,
      {
        kind: app.source.kind,
        url: app.source.url,
        jobText: app.source.jobText,
        notes: app.source.notes,
        company: app.company,
        contactName: app.contactName,
        contactEmail: app.toEmail,
        country: app.country,
      },
      feedback,
    );
    return ok(
      updateApplication(
        id,
        {
          provider: p,
          role: g.role || app.role,
          city: g.city || app.city,
          match: g.match,
          visa: g.visa,
          companyChallenge: g.companyChallenge,
          subjects: g.subjects,
          subject: g.subjects[0]?.text ?? app.subject,
          greeting: g.greeting,
          letterBody: g.letterBody,
          linkedinMessage: g.linkedinMessage,
          connectionNote: g.connectionNote,
          issues,
        },
        `Regenerated with ${p}${feedback ? " (with feedback)" : ""}`,
      ),
    );
  } catch (e) {
    return handle(e);
  }
}
