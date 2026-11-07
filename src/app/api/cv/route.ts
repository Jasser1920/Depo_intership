import fs from "node:fs";
import { fail, ok } from "@/lib/http";
import { CV_FILE, DATA_DIR } from "@/lib/store";

export async function GET() {
  if (!fs.existsSync(CV_FILE)) return fail("No CV uploaded", 404);
  return new Response(fs.readFileSync(CV_FILE), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="cv.pdf"' },
  });
}

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return fail("No file received.");
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.subarray(0, 4).toString() !== "%PDF") return fail("The CV must be a PDF.");
  if (bytes.length > 5 * 1024 * 1024) return fail("Keep the CV under 5 MB — recruiters' inboxes reject big files.");
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CV_FILE, bytes);
  return ok({ uploaded: true, size: bytes.length });
}
