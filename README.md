# 🎯 Internship Hunter

A personal app for my final-year internship (PFE) search in **Portugal, Switzerland and Denmark**. It finds internships, writes cover letters with my rules, sends them from Gmail after I review them, watches my inbox for replies, and shows what's working.

| Version | What it does |
|---|---|
| **v1: Write & send** | Claude or Gemini writes the cover letter, 5 subject lines, a LinkedIn DM and a connection note from my rules and samples. Rule checks run (word counts, banned words, passive openings) with one automatic revision. I review, then send from Gmail with my CV and a cover letter PDF attached. Tracker and follow-ups included. |
| **v2: Find opportunities** | Searches **29 verified company boards** (Greenhouse, Lever, Ashby, SmartRecruiters) plus Arbeitnow and RemoteOK, with optional Jooble and Adzuna. Keeps software internships in my target countries or remote Europe, flags visa barriers for a non-EU candidate, scores each job against my CV, and writes an application in one click. |
| **v3: Automation** | A daily routine (search → inbox check → **digest email to myself**) runs while the app is open. **AI company discovery** checks every suggestion against the real job boards. Companies with no internship postings become targets for spontaneous applications. |
| **v4: Contacts, inbox & analytics** | **Contact finder** (Hunter.io: engineering managers, recruiters, email verification). **Gmail inbox sync** detects replies and bounces and updates statuses. **Analytics**: response rate by country, application type, subject angle and AI writer. |

## Pages

- **Tracker** `/`: applications by status, with follow-up, reply and bounce badges
- **Opportunities** `/jobs`: found internships with score, visa flag, matched skills, and *Write application*
- **Companies** `/companies`: watchlist, AI discovery, add a board, spontaneous-application shortcuts
- **New application** `/new`: paste a job or start a spontaneous application, and find a contact
- **Application** `/applications/:id`: review, edit, send, follow up, inbox replies, LinkedIn texts
- **Analytics** `/analytics`: funnel, weekly sends, response rates
- **Settings** `/settings`: keys status, CV, search and automation, profile facts, rules, samples, signature

## Setup

```bash
npm install
cp .env.example .env.local   # fill it in (see below)
npm run dev                  # http://localhost:3000
```

Then in **Settings**:

1. upload your CV
2. click **Test Gmail connection**
3. click **Run daily routine now** once

### `.env.local`

| Variable | Needed for | Where to get it |
|---|---|---|
| `ANTHROPIC_API_KEY` | Claude writing and scoring | console.anthropic.com |
| `GEMINI_API_KEY` | Gemini writing and scoring | aistudio.google.com |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | sending, digest, inbox sync | Google Account → Security → 2-Step Verification → **App passwords** |
| `SENDER_NAME` | From name | your name |
| `JOOBLE_API_KEY` *(optional)* | extra job source: PT/DK/CH | jooble.org/api/about |
| `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` *(optional)* | extra job source: CH | developer.adzuna.com |
| `HUNTER_API_KEY` *(optional)* | finding real contacts | hunter.io (25 free searches a month) |
| `APP_URL` *(optional)* | links in the digest email | defaults to `http://localhost:3000` |

You need at least one AI key. Gmail inbox sync uses IMAP with the same App Password.

## How it works

**Search (v2).** Each run fetches every watched board and job feed (about 4,000 postings in about 3 seconds), then keeps a posting only if:

- the title says intern, internship, trainee, estágio, praktik, thesis, working student and similar (junior roles are optional)
- it's a software role (sales, marketing, HR and similar are excluded)
- the location is in a target country, or it's remote and open to Europe

A keyword score uses the skills from your profile. Visa wording ("right to work in the EU", "no sponsorship" / "relocation support") gets flagged. Then the AI scores the best new jobs, up to 20 per run (configurable), in batches. *Quick search* skips the AI and costs nothing.

**Daily routine (v3).** `src/instrumentation.ts` starts a scheduler when the server starts. Every 10 minutes it checks whether the daily run is due (default 08:00) or the inbox needs checking (every 3h). The daily run does search → Gmail sync → digest email (only when there's something new). The app has to be running. Leave `npm run start` open, or use **Run daily routine now**.

**Discovery (v3).** The AI suggests companies for a country and focus. The app then tries its guessed board tokens, and name variants, on all four ATS platforms, and only offers **+ Watch** for boards that really exist.

**Inbox sync (v4).** It matches incoming mail to applications by `In-Reply-To`/`References` and by the recipient's company domain:

- A reply moves the application from Applied → Replied and shows the message.
- A bounce marks the application so you can pick another contact.

**Writing rules (v1).** Your profile facts, rules and samples are in Settings, and they go into the AI prompt as-is. The AI may only use facts from your profile. Rule checks are in `src/lib/checks.ts`.

## Development

```bash
npm test        # unit tests (location/intern/visa classification, skill matching, letter checks)
npm run lint
npm run build
```

Code map:

- `src/lib/search/`: sources, classification, search engine
- `src/lib/ai/`: providers (Claude + Gemini), writer, scorer, discovery
- `src/lib/automation/`: daily routine, digest, scheduler token
- `src/lib/inbox.ts`: IMAP sync
- `src/lib/contacts.ts`: Hunter.io

## Data & privacy

Everything stays on your machine in `data/` (gitignored):

- applications
- found jobs
- search runs
- settings
- CV
- the scheduler's local token

API keys live in `.env.local`, which is also gitignored. Emails are sent only after you click **Send** and confirm.
