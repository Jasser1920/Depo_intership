import { fail } from "@/lib/http";
import { coverLetterPdf, letterFileName } from "@/lib/pdf";
import { getApplication, getSettings } from "@/lib/store";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const app = getApplication((await params).id);
  if (!app) return fail("Not found", 404);
  const { signature } = getSettings();
  const pdf = await coverLetterPdf(app, signature);
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${letterFileName(app, signature)}"`,
    },
  });
}
