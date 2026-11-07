import { fail, ok } from "@/lib/http";
import { verifyBoard } from "@/lib/search/sources";
import { ATS_TYPES, type Ats } from "@/lib/types";

export async function POST(req: Request) {
  const { ats, token } = (await req.json()) as { ats?: Ats; token?: string };
  if (!ats || !ATS_TYPES.includes(ats) || !token?.trim()) return fail("Give an ATS and a board token.");
  const openRoles = await verifyBoard(ats, token.trim());
  return ok({ exists: openRoles > 0, openRoles: Math.max(0, openRoles) });
}
