"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ContactFinder } from "@/components/ContactFinder";
import { ErrorBox } from "@/components/ui";
import { api } from "@/lib/client";
import type { Application, EnvStatus, Provider, Settings } from "@/lib/types";

const COUNTRIES = ["Portugal", "Switzerland", "Denmark", "Other"];

export default function NewApplication() {
  const router = useRouter();
  const [kind, setKind] = useState<"posting" | "spontaneous">("posting");
  const [url, setUrl] = useState("");
  const [jobText, setJobText] = useState("");
  const [company, setCompany] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [country, setCountry] = useState("Portugal");
  const [otherCountry, setOtherCountry] = useState("");
  const [notes, setNotes] = useState("");
  const [provider, setProvider] = useState<Provider>("claude");
  const [env, setEnv] = useState<EnvStatus | null>(null);
  const [busy, setBusy] = useState<"" | "fetch" | "write">("");
  const [error, setError] = useState("");
  const [domain, setDomain] = useState("");

  useEffect(() => {
    // Prefill from links like /new?kind=spontaneous&company=Pleo&country=Denmark&domain=pleo.io
    const q = new URLSearchParams(window.location.search);
    if (q.get("kind") === "spontaneous") setKind("spontaneous");
    if (q.get("company")) setCompany(q.get("company")!);
    if (q.get("domain")) setDomain(q.get("domain")!);
    const c = q.get("country");
    if (c) {
      if (COUNTRIES.includes(c)) setCountry(c);
      else { setCountry("Other"); setOtherCountry(c); }
    }
  }, []);

  useEffect(() => {
    api<{ settings: Settings; env: EnvStatus }>("/api/settings").then((d) => {
      setProvider(d.settings.defaultProvider);
      setEnv(d.env);
    });
  }, []);

  async function fetchUrl() {
    setError("");
    setBusy("fetch");
    try {
      const job = await api<{ text: string; company: string }>("/api/fetch-job", { method: "POST", json: { url } });
      setJobText(job.text);
      if (job.company && !company) setCompany(job.company);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy("write");
    try {
      const app = await api<Application>("/api/applications", {
        method: "POST",
        json: {
          kind, url, jobText, company, contactName, contactEmail, notes, provider,
          country: country === "Other" ? otherCountry : country,
        },
      });
      router.push(`/applications/${app.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy("");
    }
  }

  const providerReady = env ? env[provider] : true;

  return (
    <form onSubmit={generate} className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-xl font-semibold">New application</h1>

      <div className="card space-y-4">
        <div className="flex gap-2">
          {(["posting", "spontaneous"] as const).map((k) => (
            <button type="button" key={k} onClick={() => setKind(k)} className={`btn ${kind === k ? "btn-primary" : ""}`}>
              {k === "posting" ? "Job posting" : "Spontaneous application"}
            </button>
          ))}
        </div>

        {kind === "posting" && (
          <div>
            <label className="label" htmlFor="url">Job link (optional — tries to import the description)</label>
            <div className="flex gap-2">
              <input id="url" className="field" placeholder="https://boards.greenhouse.io/…" value={url} onChange={(e) => setUrl(e.target.value)} />
              <button type="button" className="btn" disabled={!url || busy !== ""} onClick={fetchUrl}>
                {busy === "fetch" ? "Fetching…" : "Import"}
              </button>
            </div>
          </div>
        )}

        <div>
          <label className="label" htmlFor="job">{kind === "posting" ? "Job description" : "What you know about the company (optional)"}</label>
          <textarea
            id="job"
            className="field min-h-56 font-mono text-xs"
            placeholder={kind === "posting" ? "Paste the full job description here…" : "Product, stack, recent news, team you'd join…"}
            value={jobText}
            onChange={(e) => setJobText(e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="company">Company {kind === "spontaneous" && "*"}</label>
            <input id="company" className="field" value={company} onChange={(e) => setCompany(e.target.value)} required={kind === "spontaneous"} />
          </div>
          <div>
            <label className="label" htmlFor="country">Country</label>
            <div className="flex gap-2">
              <select id="country" className="field" value={country} onChange={(e) => setCountry(e.target.value)}>
                {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              {country === "Other" && <input className="field" placeholder="Country" value={otherCountry} onChange={(e) => setOtherCountry(e.target.value)} />}
            </div>
          </div>
          <div>
            <label className="label" htmlFor="cname">Contact name</label>
            <input id="cname" className="field" placeholder="e.g. Tania Fernandes" value={contactName} onChange={(e) => setContactName(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="cemail">Contact email</label>
            <input id="cemail" type="email" className="field" placeholder="careers@company.com" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
          </div>
        </div>
        <ContactFinder
          key={domain}
          defaultDomain={domain}
          onPick={(email, name) => { setContactEmail(email); if (name) setContactName(name); }}
        />

        <div>
          <label className="label" htmlFor="notes">Extra instructions for this letter (optional)</label>
          <input id="notes" className="field" placeholder="e.g. Focus on Kubernetes; mention their Project 02" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-muted" htmlFor="provider">Write with</label>
        <select id="provider" className="field w-auto" value={provider} onChange={(e) => setProvider(e.target.value as Provider)}>
          <option value="claude">Claude{env && !env.claude ? " (no key)" : ""}</option>
          <option value="gemini">Gemini{env && !env.gemini ? " (no key)" : ""}</option>
        </select>
        <button className="btn btn-primary ml-auto" disabled={busy !== "" || !providerReady || (!jobText.trim() && !company.trim())}>
          {busy === "write" ? "Writing & checking your letter… (up to a minute)" : "Generate application"}
        </button>
      </div>
      {!providerReady && <ErrorBox message={`No API key for ${provider}. Add it to .env.local (see Settings).`} />}
      <ErrorBox message={error} />
    </form>
  );
}
