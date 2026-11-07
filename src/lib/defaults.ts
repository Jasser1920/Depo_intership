import type { Settings } from "./types";

// Ground-truth facts the AI is allowed to use. Edit them in Settings.
export const DEFAULT_PROFILE = `Name: Jasser Nahali
Nationality: Tunisian (non-EU). Based in Tunis, Tunisia. Open to relocate.
Education: ESPRIT (School of Engineering and Technology), National Engineering Degree in Computer Science (Web & Cloud), 2024 – present, final year.
Looking for: 6-month minimum final-year internship (PFE) in software engineering (backend, distributed systems, cloud/DevOps, full-stack). Available from 1 December 2026.
Target countries: Portugal, Switzerland, Denmark.
Languages: English (C1), French (B2).
Links: linkedin.com/in/jasser-nahali-78a94a263 | github.com/Jasser1920 | jasser-nahali.netlify.app

SKILLS
- Backend & microservices: Java, Spring Boot, Node.js, Fastify, NestJS, .NET / C#, RESTful APIs, WebSockets, Socket.io
- Cloud, DevOps & containers: Docker, Kubernetes, Jenkins CI/CD, GitLab CI/CD, SonarQube, Grafana, Nginx, Linux
- Languages: TypeScript, JavaScript, Python, Java, Go, SQL, C++
- Databases: PostgreSQL, MySQL, SQL Server, MongoDB, Prisma ORM, Entity Framework
- Frontend: React 18, Next.js 15, Angular, Tailwind CSS, Monaco Editor
- Security & practice: Keycloak (OAuth2/JWT, RBAC), automated unit/E2E testing, Git, Postman, Agile/Scrum

EXPERIENCE
1. Software Developer Intern — Medianet, Tunis (06/2026 – 08/2026). Project: Code-Dual, real-time competitive coding engine.
   - Bidirectional code editor with Monaco Editor + Socket.io on Fastify; code and cursor state sync < 100 ms across 20+ concurrent active duels.
   - Isolated execution sandbox wrapping Judge0 on Docker; automated tests across 6 languages (Go, Python, Java, C++, Rust, JS) in < 1.5 s.
   - Relational schema in SQL Server with Prisma ORM; 80% unit test coverage on core backend modules.
2. Full-Stack Developer Intern — Hendrik Thurau Enterprises, Switzerland (remote) (07/2025 – 08/2025). Project: KiddySafe, real-time family safety platform.
   - Cross-platform services with React Ionic and Next.js; 12 REST API endpoints processing continuous location updates from mock GPS streams.
   - WebSocket event pipeline delivering emergency SOS notifications to guardian dashboards in < 300 ms.
   - Containerized microservices with Docker; Kubernetes manifests for pod restarts; international Agile team.
3. Full-Stack Developer — Freelance, Tunisia (01/2025 – 02/2025). Project: Nutriwell Store, e-commerce engine.
   - Decoupled app (React 18, Vite, Fastify) managing 50+ catalog items and order states via PostgreSQL + Prisma ORM.
   - Checkout and cart validation REST routes with average local API response < 120 ms.

PROJECTS
- Job Outreach Suite (2026) — open-source Next.js 15 platform integrating Gemini AI APIs with Hunter.io; validates hiring-manager contacts in < 2 s and generates outreach templates bounded to ≤ 10 lines.
- SmartSite (2024) — event-driven telemetry platform: NestJS + Python/FastAPI microservices processing video at 20–25 FPS for YOLOv8 violation detection; containerized pods on a 3-node Kubernetes cluster, Jenkins CI/CD, SonarQube quality gates, Keycloak RBAC over 4 user tiers.
- Firma — enterprise backend in Java / Spring Boot (and C#/.NET) exposing 15+ secured REST endpoints with an Angular/TypeScript frontend, relational schema modeling and automated unit tests.`;

export const DEFAULT_RULES = `1. CORE ARCHITECTURE (4 strategic paragraphs)

Paragraph 1 — The Operational Hook (~35–45 words)
- Lead immediately with the employer's core engineering challenge (e.g. streaming telemetry without frame drops, scaling multi-tenant execution sandboxes, guaranteeing sub-100ms API responsiveness).
- Never open with a passive intro like "I am writing to apply..." or "I am an engineering student looking for...".
- Position the candidate as an immediate technical contributor and solution, not as an applicant seeking guidance.

Paragraph 2 — Hard Technical Proof & Quantified Evidence (~100–120 words)
- Apply Claim → Evidence → Impact.
- Anchor every claim in verified, realistic metrics, choosing the ones most relevant to the employer:
  - Execution sandbox: isolated Docker container (Judge0) evaluating code across 6 languages safely in < 1.5 s.
  - Synchronization latency: Fastify & Socket.io WebSockets keeping state sync < 100 ms across 20+ active sessions.
  - Persistence & tests: SQL Server & PostgreSQL with 80% automated unit test coverage and API responses < 120 ms.
  - High-throughput inference: event-driven Python/NestJS microservices processing video telemetry at 20–25 FPS on a multi-node Kubernetes cluster.
  - Production endpoints: 12 REST endpoints and real-time alerts < 300 ms for an international European (Swiss) system.
- It is fine to present this paragraph as one intro line ("As a final-year software engineering student at ESPRIT (Web & Cloud):") followed by 3–4 bullets.

Paragraph 3 — Company Bridge & Explicit Mobility (~50–60 words)
- Directly tie the company's specific mission, product or stack to the systems the candidate builds.
- Frame the contribution around zero-onboarding velocity ("rather than requiring onboarding overhead, I bring immediate delivery capacity").
- Include an explicit relocation and availability statement, e.g.:
  "Ready to relocate to [target country] for a 6-month final-year internship (PFE), available from 1 December 2026."

Paragraph 4 — Low-Friction Ask (~20–25 words)
- Propose a brief, conversational technical exchange about upcoming roadmap deliverables.
- Zero desperate or subservient language.

2. STRICT LENGTH RULES
- Cover letter / email body: 180–220 words (never exceed 250).
- LinkedIn direct message / InMail: 50–80 words, C-R-V-A structure (Context, Relevance, Value, Ask).
- Connection request note: under 300 characters.

3. BANNED PATTERNS (disqualifying)
- No AI clichés or empty emotional words: passionate, motivated, eager to learn, dynamic, hardworking, hungry to learn, fast learner.
- Complete emotional detachment: objective, peer-to-peer engineering tone; talk about architectural trade-offs, latency, concurrency, reliability — not feelings.
- No academic apologies: never "As a student with no professional experience..." or "I want to learn from your senior developers". Frame academic and freelance projects with production-grade rigor.
- No generic openings: sentence 1 must contain technical substance specific to this company's product domain.

4. SUBJECT LINE FORMULA (cold emails)
Write 5 distinct subject lines, 6–10 words each, collegial tone, never generic tags like "Candidature Stage" or "Application for":
1. Observation & tech fit — a specific system challenge.
2. Personal project → company bridge — what a project taught about their exact challenge.
3. Targeted technical question — a sharp question about their bottlenecks.
4. Concrete metric hook — lead with a number (e.g. "Sub-100ms sync & isolated Docker sandboxes: direct delivery").
5. Contrast hook — production delivery vs. onboarding cost.`;

export const DEFAULT_SAMPLES = [
  `Dear Integration Objects Recruitment Team,

Building a cloud-native, containerized architecture for an industrial IoT platform like SIOTH requires engineers who build resilient microservices, orchestrate multi-node Kubernetes clusters, and automate zero-downtime CI/CD pipelines without onboarding drag.

As a final-year software engineering student at ESPRIT (Web & Cloud):
• Orchestrated an event-driven platform on SmartSite coupling NestJS with Python microservices at 20–25 FPS, deploying containerized pods across a Kubernetes cluster with automated Jenkins CI/CD quality gates, SonarQube validation, and Keycloak access controls.
• Architected an isolated Docker sandbox on Code-Dual running polyglot workloads safely under 1.5s, while Fastify WebSocket pipelines sustained bidirectional data synchronization below 100ms.
• Developed enterprise backends and REST APIs in C#/.NET and Java/Spring Boot (Firma), optimizing relational schemas under SQL Server and PostgreSQL with strict automated testing.
• Engineered serverless LLM automation workflows in Job Outreach Suite with strict schema validation under 2 seconds.

Integration Objects’ leadership in industrial digital transformation and IIoT connectivity directly matches the containerized, high-throughput systems I build. I want to contribute directly to containerizing SIOTH services, authoring Kubernetes manifests/Helm charts, and building automated CI/CD pipelines for Project 02 (with strong secondary interest in Project 07 or Project 05).

I would welcome the opportunity for a technical interview to discuss how my background in Kubernetes, Docker, and .NET aligns with your development squad's roadmap. My CV is attached for your review.`,
  `Dear Tania Fernandes,

Building scalable, resilient enterprise applications across EMEA requires software engineers who write clean, modular code, implement strict test-driven boundaries, and integrate seamlessly into agile delivery squads with minimal onboarding friction.

As a final-year software engineering student at ESPRIT specialized in distributed systems, Java backends, and modern cloud architectures:
• Engineered decoupled enterprise backends using Java and Spring Boot (Firma), exposing 15+ secured RESTful API endpoints integrated with responsive Angular/TypeScript frontends, relational schema modeling, and automated unit testing suites.
• Architected an isolated Docker execution sandbox (Judge0) on Code-Dual evaluating polyglot workloads safely under strict kernel limits in under 1.5 seconds, while engineering Fastify WebSocket pipelines sustaining bidirectional data synchronization below 100ms across 20+ active sessions.
• Orchestrated an event-driven telemetry platform on SmartSite coupling NestJS with Python microservices, deploying containerized pods across a Kubernetes cluster with automated Jenkins CI/CD pipelines, SonarQube quality gates, and Keycloak access controls (OAuth2/JWT).
• Optimized transactional checkout endpoints on Nutriwell Store with PostgreSQL and Prisma ORM, sustaining average API latencies below 120ms under continuous load.

Devoteam’s focus on human-centric digital transformation and cloud-native excellence aligns directly with the resilient systems I build. I want to contribute directly to your Java and Angular development squads, unit/integration testing strategies, and CI/CD pipelines. I am ready to relocate for a 6-month final-year internship (PFE) starting early 2027.

I would welcome a brief conversation regarding upcoming engineering needs across your client delivery teams.`,
];

export const DEFAULT_SIGNATURE = `Sincerely,
Jasser Nahali
Software Engineer | ESPRIT
+216 29 523 985 | Jasser.Nahali@esprit.tn
linkedin.com/in/jasser-nahali-78a94a263 | github.com/Jasser1920`;

export const DEFAULT_SETTINGS: Settings = {
  defaultProvider: "claude",
  followUpDays: 7,
  profile: DEFAULT_PROFILE,
  rules: DEFAULT_RULES,
  samples: DEFAULT_SAMPLES,
  signature: DEFAULT_SIGNATURE,
};

export const COUNTRY_NOTES = `- Denmark: flat hierarchy; keep it direct, concise and informal-professional. Emphasize ownership, collaboration and pragmatic engineering. No flattery.
- Switzerland: more formal and precise; structured, results-oriented, quality and reliability matter. The candidate's remote internship for a Swiss company (Hendrik Thurau Enterprises / KiddySafe) is a strong, relevant signal — use it.
- Portugal: professional but warm; growing tech hubs (Lisbon, Porto). Relocation readiness and experience in international/European teams are worth stating.`;
