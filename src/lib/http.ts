import "server-only";
import { NextResponse } from "next/server";
import { AIError } from "./ai/providers";
import { MailError } from "./mail";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Turn known errors into readable JSON; log the rest. */
export function handle(e: unknown) {
  if (e instanceof AIError || e instanceof MailError) return fail(e.message, 502);
  console.error(e);
  return fail(e instanceof Error ? e.message : "Unexpected error", 500);
}
