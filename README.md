# 🎯 Internship Hunter

A personal app for my final-year internship (PFE) search in **Portugal, Switzerland and Denmark**. It:

1. Takes a job posting (paste the text or import from a link) or a company for a spontaneous application.
2. Uses **Claude or Gemini** (switchable for each letter) to score the match against my CV, flag visa problems for a non-EU candidate, and write:
   - a cover letter that follows my 4-paragraph rules and my sample style (180–220 words)
   - 5 subject lines (one per angle)
   - a LinkedIn DM (50–80 words) and a connection note (under 300 characters)
3. **Checks the draft against my rules** (word counts, banned words, passive openings, subject length) and has the AI revise it once if a rule is broken. Live checks keep running while I edit.
4. Lets me **review and edit everything**, then **send from Gmail** with my CV and a generated cover letter PDF attached. Nothing is sent without an explicit confirm.
5. Tracks every application (Draft → Applied → Replied → Interview → Offer / Rejected) and drafts **follow-ups** that are sent as replies in the same Gmail thread.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind v4 · Anthropic SDK (`claude-opus-5-5`) · Google GenAI SDK (Gemini) · Nodemailer (Gmail SMTP) · pdf-lib · JSON-file storage in `data/` (local, gitignored).

## Setup

```bash
npm install
cp .env.example .env.local   # then fill it in
npm run dev                  # http://localhost:3000
```

### `.env.local`

| Variable | What |
|---|---|
| `ANTHROPIC_API_KEY` | From console.anthropic.com (optional if you use Gemini) |
| `CLAUDE_MODEL` | Defaults to `claude-opus-5-5` |
| `GEMINI_API_KEY` | From aistudio.google.com (optional if you use Claude) |
| `GEMINI_MODEL` | Defaults to `gemini-2.5-flash` |
| `GMAIL_USER` | Your Gmail address |
| `GMAIL_APP_PASSWORD` | A 16-character **App Password**, not your normal password: Google Account → Security → turn on 2-Step Verification → App passwords |
| `SENDER_NAME` | Name shown in the From field |

Then open **Settings** to:

- upload your CV (PDF)
- click **Test Gmail connection**
- adjust your profile facts, writing rules, samples and signature

## How the letter writing works

- **Profile** (Settings) holds the only facts the AI may use. It's told never to invent employers, metrics or dates.
- **Rules** and **samples** go into the system prompt as-is. Edit them and the next letter follows the new version.
- Country notes (Denmark is direct, Switzerland is formal, Portugal is warm) are in `src/lib/defaults.ts`.
- Rule checks live in `src/lib/checks.ts`, including the banned-phrase list.
- Claude requests turn on server-side refusal fallbacks (`fallbacks: "default"`), so a declined request is retried on a recommended fallback model.

## Data & privacy

Everything stays on your machine:

- `data/applications.json`: your applications
- `data/settings.json`: your edited settings
- `data/cv.pdf`: your CV

`data/` and `.env.local` are gitignored. Gmail keeps a copy of every sent email in your Sent folder.

## Roadmap

- [ ] **v2:** daily search across Landing.jobs, TheHub.io, SwissDevJobs, plus Greenhouse/Lever company watchlists, with a morning digest
- [ ] Filter out offers that require EU work authorization, and push up companies that sponsor visas
- [ ] Find contacts for spontaneous applications (reuse the Hunter.io code from Job Outreach Suite)
- [ ] Read replies over Gmail IMAP and update statuses automatically
