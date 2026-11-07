"use client";

import { useEffect, useState } from "react";
import { ErrorBox } from "@/components/ui";
import { api } from "@/lib/client";
import type { EnvStatus, Settings } from "@/lib/types";

function Status({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={ok ? "text-green-700" : "text-red-700"}>{ok ? "●" : "○"}</span>
      {label}
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [defaults, setDefaults] = useState<Settings | null>(null);
  const [env, setEnv] = useState<EnvStatus | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    api<{ settings: Settings; env: EnvStatus; defaults: Settings }>("/api/settings")
      .then((d) => { setSettings(d.settings); setEnv(d.env); setDefaults(d.defaults); })
      .catch((e) => setError(e.message));
  }, []);

  if (!settings || !env) return error ? <ErrorBox message={error} /> : <p className="text-sm text-muted">Loading…</p>;

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setSettings({ ...settings, [k]: v });

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(label); setError(""); setNotice("");
    try { await fn(); } catch (e) { setError((e as Error).message); } finally { setBusy(""); }
  }

  const save = () =>
    run("save", async () => {
      const d = await api<{ settings: Settings; env: EnvStatus }>("/api/settings", { method: "PUT", json: settings });
      setSettings(d.settings); setEnv(d.env); setNotice("Settings saved.");
    });

  const upload = (file: File) =>
    run("cv", async () => {
      const form = new FormData();
      form.append("file", file);
      await api("/api/cv", { method: "POST", body: form });
      setEnv({ ...env, cvUploaded: true }); setNotice("CV uploaded — it will be attached to every email.");
    });

  const testSmtp = () =>
    run("smtp", async () => {
      await api("/api/smtp-test", { method: "POST" });
      setNotice(`Gmail connection works (${env.gmailUser}).`);
    });

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <h1 className="text-xl font-semibold">Settings</h1>
      {notice && <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{notice}</div>}
      <ErrorBox message={error} />

      <div className="card grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <div className="text-sm font-semibold">Connections <span className="font-normal text-muted">(from .env.local)</span></div>
          <Status ok={env.claude} label={`Claude API · ${env.claudeModel}`} />
          <Status ok={env.gemini} label={`Gemini API · ${env.geminiModel}`} />
          <Status ok={env.gmail} label={env.gmail ? `Gmail SMTP · ${env.gmailUser}` : "Gmail SMTP"} />
          <Status ok={env.cvUploaded} label="CV uploaded" />
          <button className="btn mt-2" onClick={testSmtp} disabled={!env.gmail || busy !== ""}>{busy === "smtp" ? "Testing…" : "Test Gmail connection"}</button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="label" htmlFor="cv">CV (PDF, attached to every email)</label>
            <input id="cv" type="file" accept="application/pdf" className="field" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            {env.cvUploaded && <a href="/api/cv" target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-brand underline">View current CV</a>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="prov">Default AI</label>
              <select id="prov" className="field" value={settings.defaultProvider} onChange={(e) => set("defaultProvider", e.target.value as Settings["defaultProvider"])}>
                <option value="claude">Claude</option>
                <option value="gemini">Gemini</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="fud">Follow up after (days)</label>
              <input id="fud" type="number" min={1} className="field" value={settings.followUpDays} onChange={(e) => set("followUpDays", Number(e.target.value))} />
            </div>
          </div>
        </div>
      </div>

      <div className="card space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold" htmlFor="profile">Your profile — the only facts the AI may use</label>
          <button className="text-xs text-brand underline" onClick={() => defaults && set("profile", defaults.profile)}>Reset</button>
        </div>
        <textarea id="profile" className="field min-h-80 font-mono text-xs" value={settings.profile} onChange={(e) => set("profile", e.target.value)} />
      </div>

      <div className="card space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-semibold" htmlFor="rules">Writing rules</label>
          <button className="text-xs text-brand underline" onClick={() => defaults && set("rules", defaults.rules)}>Reset</button>
        </div>
        <textarea id="rules" className="field min-h-80 font-mono text-xs" value={settings.rules} onChange={(e) => set("rules", e.target.value)} />
      </div>

      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Sample letters (style reference)</span>
          <button className="btn px-2 py-1 text-xs" onClick={() => set("samples", [...settings.samples, ""])}>+ Add sample</button>
        </div>
        {settings.samples.map((s, i) => (
          <div key={i} className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted">
              Sample {i + 1}
              <button className="text-red-700 underline" onClick={() => set("samples", settings.samples.filter((_, j) => j !== i))}>Remove</button>
            </div>
            <textarea className="field min-h-48 text-xs" value={s} onChange={(e) => set("samples", settings.samples.map((x, j) => (j === i ? e.target.value : x)))} />
          </div>
        ))}
      </div>

      <div className="card space-y-2">
        <label className="text-sm font-semibold" htmlFor="sig">Signature (line 1 = sign-off, line 2 = your name)</label>
        <textarea id="sig" className="field min-h-32 font-mono text-xs" value={settings.signature} onChange={(e) => set("signature", e.target.value)} />
      </div>

      <div className="sticky bottom-4 flex justify-end">
        <button className="btn btn-primary shadow-lg" onClick={save} disabled={busy !== ""}>{busy === "save" ? "Saving…" : "Save settings"}</button>
      </div>
    </div>
  );
}
