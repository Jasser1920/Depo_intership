import { fail, handle, ok } from "@/lib/http";
import { composeBody, cvFileName, sendMail } from "@/lib/mail";
import { coverLetterPdf, letterFileName } from "@/lib/pdf";
import { getApplication, getSettings, updateApplication } from "@/lib/store";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Sends exactly what is saved — the review page saves before calling this.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const app = getApplication(id);
  if (!app) return fail("Not found", 404);
  const { confirm } = (await req.json().catch(() => ({}))) as { confirm?: boolean };
  if (!confirm) return fail("Sending requires explicit confirmation.");
  if (!EMAIL.test(app.toEmail)) return fail("Add a valid recipient email first.");
  if (app.cc && !app.cc.split(",").every((c) => EMAIL.test(c.trim()))) return fail("CC contains an invalid email.");
  if (!app.subject.trim() || !app.letterBody.trim()) return fail("Subject and letter can't be empty.");

  const { signature } = getSettings();
  try {
    const extra = app.attachLetterPdf
      ? [{ filename: letterFileName(app, signature), content: Buffer.from(await coverLetterPdf(app, signature)), contentType: "application/pdf" }]
      : [];
    const messageId = await sendMail({
      to: app.toEmail,
      cc: app.cc,
      subject: app.subject,
      text: composeBody(app.greeting, app.letterBody, signature),
      attachCv: true,
      cvName: cvFileName(signature),
      extraAttachments: extra,
    });
    const now = new Date().toISOString();
    return ok(
      updateApplication(
        id,
        {
          status: app.status === "draft" ? "applied" : app.status,
          sentAt: now,
          messageId,
          subjectAngle: app.subjects.find((s) => s.text === app.subject)?.angle ?? "Custom",
        },
        `Sent to ${app.toEmail}`,
      ),
    );
  } catch (e) {
    return handle(e);
  }
}
