import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Application } from "./types";

// Standard PDF fonts only support WinAnsi characters; map the common others.
const REPLACEMENTS: Record<string, string> = {
  "→": "->", "←": "<-", "≤": "<=", "≥": ">=", "≈": "~", "×": "x", "−": "-",
  " ": " ", " ": " ", " ": " ", "​": "",
};
const WIN_ANSI_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");

export function sanitize(text: string): string {
  return [...text]
    .map((c) => REPLACEMENTS[c] ?? c)
    .join("")
    .split("")
    .map((c) => (c.charCodeAt(0) <= 0xff || WIN_ANSI_EXTRA.has(c) ? c : "?"))
    .join("");
}

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 62;
const SIZE = 10.5;
const LEADING = 15;

interface Ctx {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  font: PDFFont;
  bold: PDFFont;
}

function newPageIfNeeded(ctx: Ctx, needed = LEADING) {
  if (ctx.y - needed < MARGIN) {
    ctx.page = ctx.doc.addPage(A4);
    ctx.y = A4[1] - MARGIN;
  }
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width) line = candidate;
    else {
      if (line) lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawParagraph(ctx: Ctx, text: string, opts: { indent?: number; bullet?: boolean; font?: PDFFont; size?: number; color?: number } = {}) {
  const font = opts.font ?? ctx.font;
  const size = opts.size ?? SIZE;
  const indent = opts.indent ?? 0;
  const width = A4[0] - MARGIN * 2 - indent;
  const lines = wrap(sanitize(text), font, size, width);
  const color = rgb(opts.color ?? 0.1, opts.color ?? 0.1, opts.color ?? 0.1);
  lines.forEach((l, i) => {
    newPageIfNeeded(ctx);
    if (opts.bullet && i === 0) ctx.page.drawText("•", { x: MARGIN + indent - 10, y: ctx.y, size, font, color });
    ctx.page.drawText(l, { x: MARGIN + indent, y: ctx.y, size, font, color });
    ctx.y -= size === SIZE ? LEADING : size * 1.4;
  });
}

export async function coverLetterPdf(app: Application, signature: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Cover Letter — ${app.company}`);
  const sigLines = signature.split("\n").map((l) => l.trim()).filter(Boolean);
  const name = sigLines[1] ?? "Jasser Nahali";
  doc.setAuthor(name);

  const ctx: Ctx = {
    doc,
    page: doc.addPage(A4),
    y: A4[1] - MARGIN,
    font: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };

  // Header: name + headline + contact lines from the signature
  ctx.page.drawText(sanitize(name), { x: MARGIN, y: ctx.y, size: 20, font: ctx.bold, color: rgb(0.08, 0.1, 0.16) });
  ctx.y -= 18;
  for (const l of sigLines.slice(2)) drawParagraph(ctx, l, { size: 9, color: 0.35 });
  ctx.y -= 6;
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y },
    end: { x: A4[0] - MARGIN, y: ctx.y },
    thickness: 0.6,
    color: rgb(0.75, 0.77, 0.8),
  });
  ctx.y -= 24;

  const date = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  drawParagraph(ctx, date, { color: 0.35 });
  ctx.y -= 4;
  drawParagraph(ctx, [app.company, [app.city, app.country].filter(Boolean).join(", ")].filter(Boolean).join(" — "), { font: ctx.bold });
  if (app.role) drawParagraph(ctx, `Re: ${app.role}`, { color: 0.35 });
  ctx.y -= 12;

  drawParagraph(ctx, app.greeting);
  ctx.y -= 6;

  for (const block of app.letterBody.split(/\n\s*\n/)) {
    for (const raw of block.split("\n")) {
      const line = raw.trim();
      if (!line) continue;
      const bullet = /^[•*\-–]\s+/.test(line);
      drawParagraph(ctx, line.replace(/^[•*\-–]\s+/, ""), bullet ? { indent: 14, bullet: true } : {});
      if (bullet) ctx.y -= 2;
    }
    ctx.y -= 8;
  }

  ctx.y -= 4;
  newPageIfNeeded(ctx, LEADING * 3);
  drawParagraph(ctx, sigLines[0] ?? "Sincerely,");
  drawParagraph(ctx, name, { font: ctx.bold });

  return doc.save();
}

export function letterFileName(app: Application, signature: string): string {
  const name = (signature.split("\n")[1] ?? "Cover").trim().replace(/\s+/g, "_");
  const company = app.company.replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_|_$/g, "");
  return `${name}_Cover_Letter_${company || "Company"}.pdf`;
}
