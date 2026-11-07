export type Provider = "claude" | "gemini";

export const STATUSES = ["draft", "applied", "replied", "interview", "offer", "rejected"] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<Status, string> = {
  draft: "Draft",
  applied: "Applied",
  replied: "Replied",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
};

export type VisaFlag = "ok" | "warning" | "blocker";

export interface Subject {
  angle: string;
  text: string;
}

export interface FollowUp {
  sentAt: string;
  subject: string;
  body: string;
  messageId?: string;
}

export interface HistoryEvent {
  at: string;
  event: string;
}

export interface Application {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: Status;
  provider: Provider;

  source: {
    kind: "posting" | "spontaneous";
    url: string;
    jobText: string;
    notes: string;
  };

  company: string;
  role: string;
  country: string;
  city: string;
  contactName: string;
  toEmail: string;
  cc: string;

  match: { score: number; matched: string[]; missing: string[]; summary: string };
  visa: { flag: VisaFlag; note: string };
  companyChallenge: string;

  subjects: Subject[];
  subject: string;
  greeting: string;
  letterBody: string;
  linkedinMessage: string;
  connectionNote: string;
  attachLetterPdf: boolean;

  issues: string[];
  sentAt?: string;
  messageId?: string;
  subjectAngle?: string;
  jobId?: string;
  replies?: Reply[];
  bounced?: boolean;
  followUps: FollowUp[];
  history: HistoryEvent[];
}

export interface Settings {
  defaultProvider: Provider;
  followUpDays: number;
  profile: string;
  rules: string;
  samples: string[];
  signature: string;
  watchlist: WatchCompany[];
  search: SearchSettings;
  lastDailyRun?: string; // YYYY-MM-DD
  lastInboxSync?: string; // ISO
}

export interface EnvStatus {
  claude: boolean;
  gemini: boolean;
  gmail: boolean;
  gmailUser: string;
  cvUploaded: boolean;
  claudeModel: string;
  geminiModel: string;
  hunter: boolean;
  jooble: boolean;
  adzuna: boolean;
}

// ---------- v2: job search ----------

export const ATS_TYPES = ["greenhouse", "lever", "ashby", "smartrecruiters"] as const;
export type Ats = (typeof ATS_TYPES)[number];

export interface WatchCompany {
  name: string;
  ats: Ats;
  token: string;
  country: string; // main target country for this company ("" = global)
  domain?: string; // company website domain, used for contact finding
}

export type JobKind = "internship" | "junior";
export type JobStatus = "new" | "saved" | "dismissed" | "applied";

export interface Job {
  id: string; // `${source}:${externalId}`
  source: string; // greenhouse | lever | ashby | smartrecruiters | arbeitnow | remoteok | jooble | adzuna
  company: string;
  title: string;
  location: string;
  country: string; // Portugal | Switzerland | Denmark | Remote (Europe) | ...
  remote: boolean;
  url: string;
  description: string;
  postedAt: string;
  firstSeenAt: string;
  lastSeenAt: string;
  kind: JobKind;
  localScore: number;
  matchedSkills: string[];
  visaHint: VisaFlag | "";
  ai?: { score: number; visa: VisaFlag; reason: string; provider: Provider; at: string };
  status: JobStatus;
  applicationId?: string;
}

export interface SourceResult {
  name: string;
  ok: boolean;
  fetched: number;
  kept: number;
  error?: string;
}

export interface SearchRun {
  id: string;
  at: string;
  trigger: "manual" | "daily";
  durationMs: number;
  sources: SourceResult[];
  newJobs: number;
  aiScored: number;
  digestSent?: boolean;
  repliesFound?: number;
  error?: string;
}

export interface SearchSettings {
  countries: string[];
  includeRemote: boolean;
  includeJunior: boolean;
  useArbeitnow: boolean;
  useRemoteOk: boolean;
  useJooble: boolean;
  useAdzuna: boolean;
  keywords: string; // extra search keywords for keyword-based sources
  aiScoreLimit: number; // max new jobs AI-scored per run
  autoDaily: boolean;
  dailyHour: number; // local hour 0-23
  digestEmail: boolean;
  digestMinScore: number;
  autoInboxSync: boolean;
}

// ---------- v4: inbox ----------

export interface Reply {
  id: string; // Message-ID of the incoming email
  at: string;
  from: string;
  subject: string;
  snippet: string;
  kind: "reply" | "bounce";
}
