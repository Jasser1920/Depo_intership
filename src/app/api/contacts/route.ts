import { findContacts } from "@/lib/contacts";
import { fail, ok } from "@/lib/http";

export async function POST(req: Request) {
  const { domain } = (await req.json()) as { domain?: string };
  if (!domain) return fail("Enter the company domain.");
  try {
    return ok(await findContacts(domain));
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Contact search failed", 502);
  }
}
