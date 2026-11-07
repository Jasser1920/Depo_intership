import { handle, ok } from "@/lib/http";
import { verifySmtp } from "@/lib/mail";

export async function POST() {
  try {
    await verifySmtp();
    return ok({ ok: true });
  } catch (e) {
    return handle(e);
  }
}
