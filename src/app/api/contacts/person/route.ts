import { findPersonEmail } from "@/lib/contacts";
import { fail, ok } from "@/lib/http";

export async function POST(req: Request) {
  const { domain, firstName, lastName } = (await req.json()) as { domain?: string; firstName?: string; lastName?: string };
  if (!domain || !firstName || !lastName) return fail("Domain, first name and last name are required.");
  try {
    return ok(await findPersonEmail(domain, firstName, lastName));
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Lookup failed", 502);
  }
}
