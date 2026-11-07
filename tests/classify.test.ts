import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_PROFILE } from "../src/lib/defaults";
import { classifyKind, detectCountry, isSoftwareRole, localScore, REMOTE_EUROPE, skillsFromProfile, visaHint } from "../src/lib/search/classify";
import { checkDraft, countWords, findBanned } from "../src/lib/checks";

const targets = ["Portugal", "Switzerland", "Denmark"];
const opts = { targets, includeRemote: true };

test("detectCountry: cities, native names and country codes", () => {
  assert.equal(detectCountry("In-Office · Lisboa, Lisboa, Portugal", opts), "Portugal");
  assert.equal(detectCountry("Zürich", opts), "Switzerland");
  assert.equal(detectCountry("Épalinges, Switzerland", opts), "Switzerland");
  assert.equal(detectCountry("København", opts), "Denmark");
  assert.equal(detectCountry("Madrid, MD, Spain", { ...opts, countryCode: "es" }), "");
  assert.equal(detectCountry("Geneva", { ...opts, countryCode: "CH" }), "Switzerland");
});

test("detectCountry: no false match on Baden-Württemberg", () => {
  assert.equal(detectCountry("Heidelberg, Baden-Württemberg, Deutschland", opts), "");
});

test("detectCountry: remote rules", () => {
  assert.equal(detectCountry("Remote", { ...opts, remote: true }), REMOTE_EUROPE);
  assert.equal(detectCountry("Remote - EMEA", opts), REMOTE_EUROPE);
  assert.equal(detectCountry("Remote - US", opts), "");
  assert.equal(detectCountry("Berlin (Remote)", opts), "");
  assert.equal(detectCountry("Remote", { ...opts, includeRemote: false, remote: true }), "");
});

test("classifyKind + isSoftwareRole", () => {
  assert.equal(classifyKind("Software Engineer Intern (2027)", false), "internship");
  assert.equal(classifyKind("Estágio em Desenvolvimento Backend", false), "internship");
  assert.equal(classifyKind("Junior Backend Engineer", false), null);
  assert.equal(classifyKind("Junior Backend Engineer", true), "junior");
  assert.equal(classifyKind("Senior Engineer", true), null);
  assert.ok(isSoftwareRole("Software Engineer Intern - Industrialization"));
  assert.ok(isSoftwareRole("DevOps Internship"));
  assert.ok(!isSoftwareRole("Purchase to Pay Intern (Paid Internship)"));
  assert.ok(!isSoftwareRole("Marketing Intern"));
  assert.ok(!isSoftwareRole("Sales Engineering Intern"));
});

test("visaHint", () => {
  assert.equal(visaHint("Applicants must have the right to work in Switzerland."), "blocker");
  assert.equal(visaHint("We are unable to sponsor visas for this role."), "blocker");
  assert.equal(visaHint("EU citizenship required."), "blocker");
  assert.equal(visaHint("We offer visa sponsorship is available and relocation support."), "ok");
  // Cloudflare's US export-control boilerplate must not count as a visa blocker
  assert.equal(visaHint("authorization to receive software ... without sponsorship for an export license."), "");
  assert.equal(visaHint("A great place to work."), "");
});

test("skillsFromProfile + localScore", () => {
  const skills = skillsFromProfile(DEFAULT_PROFILE);
  for (const s of ["Kubernetes", "Docker", "TypeScript", "PostgreSQL", "Node.js", "C#"]) assert.ok(skills.includes(s), `missing ${s}`);
  const hi = localScore({ title: "Backend Engineer Intern", text: "Node.js, TypeScript, PostgreSQL, Docker, Kubernetes, Go, REST APIs, Linux", kind: "internship", country: "Denmark", targets, visa: "", skills });
  const lo = localScore({ title: "Backend Engineer Intern", text: "Node.js", kind: "internship", country: "Denmark", targets, visa: "blocker", skills });
  assert.ok(hi.score >= 80, `high score was ${hi.score}`);
  assert.ok(lo.score < hi.score - 30);
  assert.ok(hi.matched.includes("Kubernetes"));
});

test("letter checks", () => {
  assert.equal(countWords("• Built a WebSocket pipeline — under 300 ms."), 7);
  assert.deepEqual(findBanned("I am eager to learn and passionate."), ["passionate", "eager to learn"]);
  const issues = checkDraft({ letterBody: "I am writing to apply.", subjects: [{ text: "Candidature stage" }] });
  assert.ok(issues.some((i) => i.includes("words")));
  assert.ok(issues.some((i) => i.includes("passive intro")));
  assert.ok(issues.some((i) => i.includes("candidature")));
});

test("skill matching: CI/CD stays whole, short skills are case-sensitive", () => {
  const skills = skillsFromProfile(DEFAULT_PROFILE);
  assert.ok(skills.some((s) => /CI\/CD/.test(s)));
  assert.ok(!skills.includes("CD"));
  const r = localScore({ title: "Intern", text: "You will go far with us. Experience with Go and Kubernetes.", kind: "internship", country: "Denmark", targets, visa: "", skills });
  assert.ok(r.matched.includes("Go"));
  const r2 = localScore({ title: "Intern", text: "Ready to go the extra mile.", kind: "internship", country: "Denmark", targets, visa: "", skills });
  assert.ok(!r2.matched.includes("Go"));
});
