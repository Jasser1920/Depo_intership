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
}

export interface EnvStatus {
  claude: boolean;
  gemini: boolean;
  gmail: boolean;
  gmailUser: string;
  cvUploaded: boolean;
  claudeModel: string;
  geminiModel: string;
}
