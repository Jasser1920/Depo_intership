// Pure functions — used on the server (auto-revision) and in the browser (live checks).

export const BANNED_PHRASES = [
  "passionate",
  "passion for",
  "motivated",
  "eager to learn",
  "eager",
  "dynamic",
  "hardworking",
  "hard-working",
  "hungry to learn",
  "fast learner",
  "quick learner",
  "i am writing to",
  "i'm writing to",
  "no professional experience",
  "learn from your senior",
  "candidature",
  "application for",
  "thrilled",
  "excited",
  "dream job",
];

export const LETTER_MIN = 180;
export const LETTER_MAX = 220;
export const LETTER_HARD_MAX = 250;

export function countWords(text: string): number {
  return text
    .replace(/[•*\-–—]\s/g, " ")
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

export function findBanned(text: string): string[] {
  const lower = text.toLowerCase();
  return BANNED_PHRASES.filter((p) => {
    const re = new RegExp(`(^|[^\\p{L}])${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}]|$)`, "u");
    return re.test(lower);
  }).filter((p, _i, all) => !all.some((o) => o !== p && o.includes(p) && lower.includes(o)));
}

export interface CheckInput {
  letterBody: string;
  subjects?: { text: string }[];
  subject?: string;
  linkedinMessage?: string;
  connectionNote?: string;
}

export function checkDraft(d: CheckInput): string[] {
  const issues: string[] = [];
  const words = countWords(d.letterBody);
  if (words > LETTER_HARD_MAX)
    issues.push(`Letter is ${words} words — hard limit is ${LETTER_HARD_MAX} (target ${LETTER_MIN}–${LETTER_MAX}).`);
  else if (words > LETTER_MAX || words < LETTER_MIN)
    issues.push(`Letter is ${words} words — target is ${LETTER_MIN}–${LETTER_MAX}.`);

  const banned = findBanned(d.letterBody);
  if (banned.length) issues.push(`Letter uses banned phrases: ${banned.join(", ")}.`);

  const firstSentence = d.letterBody.trim().split(/(?<=[.!?])\s/)[0] ?? "";
  if (/^(i am|i'm|my name)/i.test(firstSentence.trim()))
    issues.push("Letter opens with a passive intro — sentence 1 must lead with the company's engineering challenge.");

  const subjects = d.subjects ?? (d.subject ? [{ text: d.subject }] : []);
  subjects.forEach((s, i) => {
    const label = subjects.length > 1 ? `Subject ${i + 1}` : "Subject";
    const n = countWords(s.text);
    if (n < 6 || n > 10) issues.push(`${label} is ${n} words — must be 6–10.`);
    const b = findBanned(s.text);
    if (b.length) issues.push(`${label} uses banned phrases: ${b.join(", ")}.`);
  });

  if (d.linkedinMessage !== undefined && d.linkedinMessage.trim()) {
    const n = countWords(d.linkedinMessage);
    if (n < 50 || n > 80) issues.push(`LinkedIn message is ${n} words — must be 50–80.`);
  }
  if (d.connectionNote !== undefined && d.connectionNote.length >= 300)
    issues.push(`Connection note is ${d.connectionNote.length} characters — must be under 300.`);

  return issues;
}
