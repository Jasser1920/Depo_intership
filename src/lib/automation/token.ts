// Shared secret so only the in-process scheduler can call the automation endpoint.
// Deliberately free of "server-only" so instrumentation.ts can import it.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const FILE = path.join(process.cwd(), "data", ".automation-token");

export function automationToken(): string {
  try {
    return fs.readFileSync(FILE, "utf8").trim();
  } catch {
    const token = crypto.randomBytes(24).toString("hex");
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, token, { mode: 0o600 });
    return token;
  }
}
