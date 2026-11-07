import { verifyEmail } from "@/lib/contacts";
import { fail, ok } from "@/lib/http";

export async function POST(req: Request) {
  const { email } = (await req.json()) as { email?: string };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail("Enter a valid email.");
  try {
    return ok(await verifyEmail(email));
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Verification failed", 502);
  }
}
