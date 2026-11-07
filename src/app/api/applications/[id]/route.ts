import { checkDraft } from "@/lib/checks";
import { fail, ok } from "@/lib/http";
import { deleteApplication, getApplication, updateApplication } from "@/lib/store";
import { STATUSES, type Application } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

const EDITABLE = [
  "status", "company", "role", "country", "city", "contactName", "toEmail", "cc",
  "subject", "greeting", "letterBody", "linkedinMessage", "connectionNote", "attachLetterPdf",
] as const;

export async function GET(_req: Request, { params }: Ctx) {
  const app = getApplication((await params).id);
  return app ? ok(app) : fail("Not found", 404);
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const current = getApplication(id);
  if (!current) return fail("Not found", 404);
  const body = (await req.json()) as Partial<Application>;
  const patch: Partial<Application> = {};
  for (const k of EDITABLE) if (k in body) (patch as Record<string, unknown>)[k] = body[k];
  if (patch.status && !STATUSES.includes(patch.status)) return fail("Invalid status");

  const merged = { ...current, ...patch };
  patch.issues = checkDraft({ ...merged, subjects: undefined });
  const event = patch.status && patch.status !== current.status ? `Status → ${patch.status}` : undefined;
  return ok(updateApplication(id, patch, event));
}

export async function DELETE(_req: Request, { params }: Ctx) {
  return deleteApplication((await params).id) ? ok({ deleted: true }) : fail("Not found", 404);
}
