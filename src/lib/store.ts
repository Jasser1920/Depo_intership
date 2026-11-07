import "server-only";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DEFAULT_SETTINGS } from "./defaults";
import type { Application, EnvStatus, Job, SearchRun, Settings } from "./types";

// Simple JSON-file storage. It is a single-user local app, so this is enough
// and keeps the project dependency-free (no database server, no native build).
export const DATA_DIR = path.join(process.cwd(), "data");
const APPS_FILE = path.join(DATA_DIR, "applications.json");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const JOBS_FILE = path.join(DATA_DIR, "jobs.json");
const RUNS_FILE = path.join(DATA_DIR, "runs.json");
export const CV_FILE = path.join(DATA_DIR, "cv.pdf");

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeJson(file: string, value: unknown) {
  ensureDir();
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
}

// ---------- settings ----------

export function getSettings(): Settings {
  const saved = readJson<Partial<Settings>>(SETTINGS_FILE, {});
  const settings = { ...DEFAULT_SETTINGS, ...saved, search: { ...DEFAULT_SETTINGS.search, ...saved.search } };
  // If the chosen default AI has no key but the other one does, use the one that works.
  const hasKey = { claude: Boolean(process.env.ANTHROPIC_API_KEY), gemini: Boolean(process.env.GEMINI_API_KEY) };
  if (!hasKey[settings.defaultProvider]) {
    const other = settings.defaultProvider === "claude" ? "gemini" : "claude";
    if (hasKey[other]) settings.defaultProvider = other;
  }
  return settings;
}

export function saveSettings(patch: Partial<Settings>): Settings {
  const next = { ...getSettings(), ...patch };
  writeJson(SETTINGS_FILE, next);
  return next;
}

export function getEnvStatus(): EnvStatus {
  return {
    claude: Boolean(process.env.ANTHROPIC_API_KEY),
    gemini: Boolean(process.env.GEMINI_API_KEY),
    gmail: Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD),
    gmailUser: process.env.GMAIL_USER ?? "",
    cvUploaded: fs.existsSync(CV_FILE),
    claudeModel: process.env.CLAUDE_MODEL || "claude-opus-5-5",
    geminiModel: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    hunter: Boolean(process.env.HUNTER_API_KEY),
    jooble: Boolean(process.env.JOOBLE_API_KEY),
    adzuna: Boolean(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY),
  };
}

// ---------- applications ----------

export function listApplications(): Application[] {
  return readJson<Application[]>(APPS_FILE, []).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
}

export function getApplication(id: string): Application | undefined {
  return listApplications().find((a) => a.id === id);
}

export function createApplication(
  data: Omit<Application, "id" | "createdAt" | "updatedAt" | "history" | "followUps">,
): Application {
  const now = new Date().toISOString();
  const app: Application = {
    ...data,
    id: crypto.randomUUID().slice(0, 8),
    createdAt: now,
    updatedAt: now,
    followUps: [],
    history: [{ at: now, event: `Generated with ${data.provider}` }],
  };
  writeJson(APPS_FILE, [app, ...readJson<Application[]>(APPS_FILE, [])]);
  return app;
}

export function updateApplication(
  id: string,
  patch: Partial<Application>,
  event?: string,
): Application | undefined {
  const apps = readJson<Application[]>(APPS_FILE, []);
  const i = apps.findIndex((a) => a.id === id);
  if (i === -1) return undefined;
  const now = new Date().toISOString();
  const prev = apps[i];
  const next: Application = {
    ...prev,
    ...patch,
    id: prev.id,
    createdAt: prev.createdAt,
    updatedAt: now,
    history: event ? [...prev.history, { at: now, event }] : prev.history,
  };
  apps[i] = next;
  writeJson(APPS_FILE, apps);
  return next;
}

export function deleteApplication(id: string): boolean {
  const apps = readJson<Application[]>(APPS_FILE, []);
  const next = apps.filter((a) => a.id !== id);
  writeJson(APPS_FILE, next);
  return next.length !== apps.length;
}

// ---------- jobs (v2) ----------

export function listJobs(): Job[] {
  return readJson<Job[]>(JOBS_FILE, []);
}

export function saveJobs(jobs: Job[]) {
  writeJson(JOBS_FILE, jobs);
}

export function getJob(id: string): Job | undefined {
  return listJobs().find((j) => j.id === id);
}

export function updateJob(id: string, patch: Partial<Job>): Job | undefined {
  const jobs = listJobs();
  const i = jobs.findIndex((j) => j.id === id);
  if (i === -1) return undefined;
  jobs[i] = { ...jobs[i], ...patch, id: jobs[i].id };
  saveJobs(jobs);
  return jobs[i];
}

export function listRuns(): SearchRun[] {
  return readJson<SearchRun[]>(RUNS_FILE, []);
}

export function addRun(run: SearchRun) {
  writeJson(RUNS_FILE, [run, ...listRuns()].slice(0, 50));
}

export function updateRun(id: string, patch: Partial<SearchRun>) {
  writeJson(RUNS_FILE, listRuns().map((r) => (r.id === id ? { ...r, ...patch } : r)));
}
