import { writeFollowUp } from "@/lib/ai/writer";
import { fail, handle, ok } from "@/lib/http";
import { composeBody, cvFileName, sendMail } from "@/lib/mail";
import { getApplication, getSettings, updateApplication } from "@/lib/store";
import type { Provider } from "@/lib/types";

export const maxDuration = 300;

type Body =
  | { action: "draft"; provider?: Provider }
  | { action: "send"; subject: string; body: string; confirm: boolean };

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const app = getApplication(id);
  if (!app) return fail("Not found", 404);
  const settings = getSettings();
  const input = (await req.json()) as Body;

  try {
    if (input.action === "draft") {
      return ok(await writeFollowUp(input.provider ?? app.provider, settings, app));
    }
    if (!input.confirm) return fail("Sending requires explicit confirmation.");
    if (!app.sentAt) return fail("The original email hasn't been sent from this app.");
    if (!input.subject?.trim() || !input.body?.trim()) return fail("Subject and body can't be empty.");
    await sendMail({
      to: app.toEmail,
      cc: app.cc,
      subject: input.subject,
      text: composeBody("", input.body, settings.signature),
      attachCv: false,
      cvName: cvFileName(settings.signature),
      inReplyTo: app.messageId,
    });
    const now = new Date().toISOString();
    return ok(
      updateApplication(
        id,
        { followUps: [...app.followUps, { sentAt: now, subject: input.subject, body: input.body }] },
        "Follow-up sent",
      ),
    );
  } catch (e) {
    return handle(e);
  }
}
