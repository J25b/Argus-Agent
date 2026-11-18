# ARGUS --- Lovable Master Build Prompt

## Product Overview

Build **ARGUS**, a premium autonomous AI penetration-testing and
security-intelligence SaaS platform.

**Tagline:** "See Every Weakness. Secure Every Layer."

**Descriptor:** "AUTONOMOUS SECURITY INTELLIGENCE"

ARGUS helps organizations assess their authorized digital assets,
identify security weaknesses, validate findings, understand risk, and
receive actionable remediation guidance.

ARGUS must feel like a mature enterprise security-operations
platform---not a generic AI chatbot or a template dashboard.

## 1. Product Identity and Visual Direction

### Brand concept

The name ARGUS is inspired by Argus Panoptes, the hundred-eyed guardian
from Greek mythology. The identity should communicate vigilance,
visibility, intelligence, and protection.

### Visual identity

Use this palette consistently:

-   Midnight Navy: `#0A1020`
-   Deep Blue: `#142A49`
-   Electric Blue: `#2388E8`
-   Ice Cyan: `#65B9FF`
-   Secure Green: `#16B887`
-   Amber: `#F0A43A`
-   Critical Red: `#E45B68`
-   White: `#F4F7FC`
-   Muted Grey: `#8796AB`

Typography: - Inter for interface text and headings. - JetBrains Mono
for technical information, identifiers, logs, and code-like data.

### Logo direction

Create a minimalist geometric eye emblem with a circular iris, central
pupil, and restrained concentric or layered geometry. Keep it
symmetrical, clean, and suitable for an enterprise cybersecurity
product. Avoid generic shield-and-lock imagery, cartoon robots, and
excessive detail.

### Interface principles

-   Premium, restrained, high-contrast enterprise design.
-   Clear information hierarchy and generous spacing.
-   Use charts only when they communicate meaningful data.
-   Use subtle motion for transitions and live status changes.
-   Design for desktop first while remaining fully responsive on tablets
    and phones.
-   Provide accessible contrast, keyboard navigation, labels, and focus
    states.
-   Include loading, empty, error, success, and permission-denied
    states.
-   Do not use decorative fake metrics or fabricated activity.

## 2. Technical Architecture

Build the frontend in Lovable using:

-   React
-   TypeScript
-   Tailwind CSS
-   shadcn/ui components
-   Supabase for PostgreSQL, authentication, row-level security,
    realtime updates, and storage

The full production architecture should include:

-   **Lovable frontend:** user interface and client-side application.
-   **Supabase:** authentication, relational data, organization
    membership, RLS, realtime events, and file storage.
-   **ARGUS backend API:** Python FastAPI service responsible for
    authorization, business logic, AI orchestration, assessment control,
    and reporting.
-   **ARGUS CORE:** the application's own central agent-orchestration
    layer.
-   **Bifrost by Maxim AI:** server-side AI gateway for model access,
    provider routing, supported tool/MCP gateway capabilities, and AI
    request observability.
-   **Redis and Celery:** background job queue and task processing.
-   **Isolated scanning workers:** execute approved security checks in
    controlled environments.
-   **PDF reporting service:** generates reports from actual stored
    assessment data.

Do not try to implement all production backend services inside the
Lovable frontend. Build the frontend and database foundation first, then
connect the backend and scanning infrastructure incrementally.

### High-level request flow

1.  A user interacts with the ARGUS frontend.
2.  The frontend calls the authenticated ARGUS backend API.
3.  The backend checks user permissions, organization access, target
    authorization, and assessment scope.
4.  ARGUS CORE plans and coordinates the requested workflow.
5.  ARGUS CORE requests model responses through Bifrost.
6.  Bifrost routes requests to models that are actually configured and
    available.
7.  The ARGUS policy engine validates any proposed tool call and its
    arguments.
8.  Only approved operations are sent to isolated scanning workers.
9.  Workers return evidence and results to the backend.
10. ARGUS CORE coordinates analysis, validation, and reporting.
11. Results are stored and displayed in the frontend through
    authenticated API calls and realtime updates where configured.

## 3. Bifrost by Maxim AI Integration

Use **Bifrost by Maxim AI** as ARGUS's central AI gateway.

Bifrost is the AI infrastructure layer. It is not the ARGUS
penetration-testing engine, the ARGUS business-logic layer, or a
substitute for ARGUS CORE.

Use Bifrost server-side through its supported API or SDK. An
OpenAI-compatible interface may be used for the initial integration
where supported by the installed Bifrost version.

### Bifrost responsibilities

Use Bifrost for capabilities supported by the deployed version and
configuration, such as:

-   Unified access to configured model providers.
-   Model and provider routing.
-   Configured fallback behavior.
-   Virtual keys and gateway-level access controls.
-   Budgets and rate limits where configured.
-   Supported MCP/tool gateway functionality.
-   Request and usage observability where available.

### Integration requirements

-   Verify the current official Bifrost documentation and installed
    version before implementation.
-   Do not invent Bifrost API routes, request fields, environment
    variable names, model identifiers, or MCP configuration.
-   Use the actual configured model catalog. Do not hardcode guessed
    model names.
-   Keep Bifrost credentials, provider keys, and privileged virtual keys
    on the server only.
-   Never expose gateway secrets to the browser or return secret values
    after saving.
-   Do not call model providers directly from the frontend.
-   Show the gateway as connected only after a real backend health or
    connection check succeeds.
-   If Bifrost is unavailable, show a clear unavailable or degraded
    state. Do not fabricate a successful AI response.
-   Record actual request outcomes and usage data only when the deployed
    gateway provides them.

### Tool-call approval flow

Treat AI-generated tool calls as proposals, not permission to execute.

For each proposed tool call:

1.  Receive the proposal from the model through Bifrost.
2.  Validate the tool name against ARGUS's registered tool list.
3.  Validate the argument schema and reject unexpected arguments.
4.  Confirm the operation is permitted by the user's role and assessment
    profile.
5.  Confirm the destination is within the verified target scope.
6.  Apply rate, resource, and safety limits.
7.  Approve or reject the operation through the ARGUS policy engine.
8.  Execute only approved operations through the controlled backend or
    isolated worker.
9.  Record the proposal, decision, execution result, and evidence in
    audit logs.
10. Return the structured result to ARGUS CORE.

Keep explicit approval and policy enforcement as the default. Do not
enable unrestricted automatic tool execution or Agent Mode for security
operations.

### Bifrost configuration

Create an admin-only ARGUS integration page. The following are **ARGUS
application configuration placeholders**, not claims about native
Bifrost environment-variable names:

``` env
BIFROST_BASE_URL=
BIFROST_API_KEY=
BIFROST_VIRTUAL_KEY=
BIFROST_DEFAULT_MODEL=
BIFROST_FALLBACK_MODELS=
BIFROST_REQUEST_TIMEOUT=
```

Load secrets from server-side environment configuration or a secure
secret manager. Do not store them in frontend code or expose them
through Supabase client queries.

### AI model assignments

Allow administrators to assign models from the actual configured Bifrost
model catalog to logical ARGUS roles:

-   ARGUS CORE
-   RECON AGENT
-   ANALYSIS AGENT
-   VALIDATION AGENT
-   REPORTING AGENT

These are ARGUS application roles. Do not imply that Bifrost
automatically supplies these specialized agents.

### AI usage and observability

Where supported by the configured gateway, display:

-   Total AI requests.
-   Successful and failed requests.
-   Model and provider usage.
-   Token usage.
-   Estimated cost.
-   Latency.
-   Fallback activity.
-   Recent request logs.

If a metric is unavailable, label it unavailable or omit it. Never
invent usage, cost, or latency values.

## 4. ARGUS CORE and Specialized Agents

ARGUS CORE is the application's central orchestration service. It is
separate from Bifrost.

ARGUS CORE should:

-   Understand the requested assessment objective.
-   Load the verified target and approved scope.
-   Select an allowed assessment profile.
-   Create an assessment plan.
-   Assign permitted tasks to specialized agents.
-   Request structured model outputs through Bifrost.
-   Validate model outputs against schemas.
-   Send proposed tool calls to the policy engine.
-   Coordinate approved task execution.
-   Collect and interpret evidence.
-   Request validation of potential findings.
-   Generate final assessment results and reports.
-   Record meaningful events and decisions for auditing.

Do not expose private chain-of-thought. Show concise action summaries,
task status, decisions, and evidence instead.

### RECON AGENT

Responsibilities: - DNS analysis. - TLS certificate inspection. -
Technology identification. - HTTP response analysis. - Security-header
analysis. - Public endpoint discovery within approved scope. - Passive
reconnaissance.

### ANALYSIS AGENT

Responsibilities: - Security configuration analysis. - Common
web-application vulnerability checks. - Application security analysis. -
Evidence interpretation. - Risk identification and classification.

### VALIDATION AGENT

Responsibilities: - Safe rechecks of suspected findings. -
False-positive analysis. - Evidence validation. - Confidence
assignment. - Clear validation status.

### REPORTING AGENT

Responsibilities: - Executive summaries. - Technical explanations. -
Severity and risk summaries. - Remediation guidance. - Risk
prioritization. - Structured assessment reports.

Each agent must have a defined role, system instructions, permitted
tools, input schema, output schema, execution limits, error handling,
and audit records.

## 5. Security, Authorization, and Safe Execution

ARGUS must only assess targets for which the user has demonstrated
authorization.

A checkbox alone is not sufficient proof of ownership or authorization.

### Target verification

Support verifiable methods such as: - DNS TXT record verification. -
HTTP file verification.

Record verification method, verification status, timestamp, and relevant
authorization evidence.

### Scope management

Each target must have a scope record containing:

-   Allowed domains and hosts.
-   Allowed paths.
-   Excluded paths.
-   Permitted testing methods.
-   Explicit restrictions.
-   Authorization record.
-   Verification status.

Every assessment task must be checked against the approved scope on the
backend.

### Required security controls

Protect against:

-   Server-side request forgery (SSRF).
-   Requests to private, loopback, link-local, and cloud metadata
    addresses.
-   Unsafe redirects.
-   DNS rebinding.
-   Scope expansion.
-   Unvalidated hostnames and IP addresses.
-   Excessive request rates and resource consumption.
-   Unauthorized access between organizations.

Do not provide the AI with unrestricted shell access or arbitrary
command execution.

Do not implement destructive exploitation, credential theft,
persistence, stealth or evasion, denial-of-service testing, unauthorized
access, or unrestricted network scanning.

### Worker isolation

Scanning workers must use: - Isolated execution environments. - Resource
and time limits. - Strict network egress restrictions. - Destination
validation. - Request-rate limits. - Emergency cancellation. - Detailed
execution and audit logs.

Every operation must be traceable to a specific authorized assessment.

Treat content retrieved from scanned websites as untrusted input. It may
contain prompt-injection attempts. Never allow website content to
override ARGUS system instructions, policy rules, user permissions, or
assessment scope.

### Organization and role security

Use Supabase Row Level Security and backend authorization to isolate
organization data.

Support these roles: - Owner - Administrator - Security Analyst - Viewer

Audit sensitive actions and protect audit records from unauthorized
modification.

## 6. Public Website

Create these public routes:

-   `/`
-   `/features`
-   `/how-it-works`
-   `/security`
-   `/login`
-   `/signup`
-   `/forgot-password`

### Navigation

Include: - ARGUS logo. - Product. - Features. - How It Works. -
Security. - Sign In. - Get Started.

### Homepage hero

Headline:

**See Every Weakness. Secure Every Layer.**

Supporting copy:

"Meet ARGUS, your autonomous AI penetration-testing agent. Discover
vulnerabilities, understand your attack surface and strengthen your
security posture with intelligent security assessments."

Primary CTA: **Start Securing Your Assets**

Secondary CTA: **Explore the Platform**

Build the rest of the homepage with: - Product capability highlights. -
How ARGUS works. - Security and authorization principles. - A clear
explanation of the assessment workflow. - Final conversion section. -
Professional footer.

Do not claim certifications, compliance status, customer numbers, or
capabilities that have not been verified.

## 7. Authentication and Onboarding

Use Supabase Auth for: - Email registration. - Login. - Email
verification. - Password recovery and reset. - Logout. - Session
management. - Protected routes.

Build an onboarding flow that collects: - User profile information. -
Organization name and details. - User's role. - Intended use case. -
Acknowledgement of authorization requirements. - Introductory
explanation of the dashboard.

Do not let unauthenticated users access protected application data.

## 8. Authenticated Application Routes

Create these routes:

-   `/app/overview`
-   `/app/targets`
-   `/app/targets/:id`
-   `/app/assessments`
-   `/app/assessments/new`
-   `/app/assessments/:id`
-   `/app/vulnerabilities`
-   `/app/vulnerabilities/:id`
-   `/app/agent`
-   `/app/reports`
-   `/app/reports/:id`
-   `/app/settings`
-   `/app/settings/profile`
-   `/app/settings/security`
-   `/app/settings/integrations`
-   `/app/settings/ai-gateway`

The `/app/settings/ai-gateway` route must be administrator-only.

### Main navigation

-   Overview
-   Targets
-   Scope Management
-   Assessments
-   Vulnerabilities
-   Reports
-   ARGUS Agent
-   Agent Activity
-   AI Usage and Models
-   Notifications
-   Settings

Administrator-only sections: - AI Gateway Configuration - Model
Assignments - Agent Configuration - Tool Registry - System Monitoring

## 9. Overview Dashboard

Display actual stored data for:

-   Total assessments.
-   Registered targets.
-   Vulnerabilities.
-   Critical findings.

Include: - Vulnerability distribution: Critical, High, Medium, Low,
Informational. - Assessment activity. - Security trends. - Recent
assessments. - Recent vulnerabilities. - Recent activity.

All dashboard figures and charts must come from real database records.

For a new account, show useful empty states and explain how to add a
verified target and create the first assessment.

If sample data is used for a demonstration, label the environment
clearly:

**DEMO ENVIRONMENT --- SAMPLE DATA**

Never mix demo records with real customer findings.

## 10. Targets and Scope Management

Users should be able to: - Add a target. - Provide a target name,
domain, type, and description. - Associate the target with their
organization. - Verify ownership or authorization. - Define allowed and
excluded scope. - Review verification and authorization history.

Target details should show: - Target information. - Verification
status. - Scope. - Authorization history. - Assessment history. -
Related findings.

Do not allow an unverified target to be assessed.

## 11. Assessment Workflow

Build a multi-step assessment wizard:

1.  Select a verified target.
2.  Choose an assessment profile.
3.  Review permitted scope.
4.  Review restrictions.
5.  Confirm authorization.
6.  Review the assessment summary.
7.  Launch the assessment.

### Assessment profiles

-   Passive Reconnaissance.
-   Standard Web Security Assessment.
-   Comprehensive Authorized Assessment.

Only enable checks that are implemented, configured, and permitted by
the target scope.

### Assessment statuses

-   Draft
-   Pending Authorization
-   Queued
-   Running
-   Completed
-   Failed
-   Cancelled

Display real backend job status only. Never simulate a scan or show
fabricated progress.

### Live assessment page

Show the real lifecycle: - Authorization. - Reconnaissance. - Security
analysis. - Validation. - Report generation.

Display actual task events and timestamps. A Stop Assessment action must
request backend cancellation and terminate active workers where
possible. Show the actual cancellation result.

## 12. Agent Monitoring and Activity

Create an ARGUS Agent monitoring area that displays:

-   ARGUS CORE status.
-   Bifrost connection status.
-   Configured model.
-   Current assessment.
-   Current agent and task.
-   Recent activity.
-   Proposed tool calls.
-   Approved and rejected tool calls.
-   Completed and failed tasks.

Use truthful states such as: - Gateway unavailable. - Model
unavailable. - Agent idle. - Agent processing. - Tool awaiting
approval. - Tool executing. - Task completed. - Task failed.

Only display events that were actually emitted by the backend.

## 13. AI Gateway Administration

Create `/app/settings/ai-gateway` as an administrator-only integration
page.

This is ARGUS's integration interface, not a replacement for the Bifrost
administration interface.

Display: - Connection status. - Configured endpoint. - Last successful
connection. - Configuration status. - Gateway health. - Available
configured models, where retrievable. - Model assignments by ARGUS agent
role.

### Test Connection

The button must call the ARGUS backend. The backend should perform a
real health or connection check and verify model availability where
supported.

Return a sanitized result and record the check timestamp. Do not return
credentials or secret values to the browser.

### AI usage dashboard

Where actual data is available, display: - Request volume. - Success and
failure counts. - Provider and model usage. - Tokens. - Estimated
cost. - Latency. - Fallback events.

Make unavailable metrics explicit instead of fabricating them.

Audit all configuration changes.

## 14. Vulnerability Management

### Vulnerability list

Display: - Finding title. - Severity. - Target. - Endpoint. -
Category. - Confidence. - Validation status. - Date discovered.

Severity levels: - Critical - High - Medium - Low - Informational

### Vulnerability detail

Include: - Description. - Technical explanation. - Evidence. - Impact. -
Remediation guidance. - Validation history. - Related assessment.

Use CVSS-compatible scoring where applicable and identify the scoring
version. Do not assign arbitrary scores.

Keep severity, confidence, and validation status as separate concepts.

### Vulnerability statuses

-   Open
-   Confirmed
-   False Positive
-   Accepted Risk
-   Resolved
-   Reopened

Audit every status change.

## 15. Reports

Generate professional PDF reports using actual stored assessment data.

Include: - ARGUS branding. - Assessment ID. - Target and approved
scope. - Executive summary. - Methodology. - Checks actually
performed. - Findings and severity. - Evidence. - Remediation
recommendations. - Conclusion.

Never list checks that were not performed. Never invent findings or
evidence.

Apply organization-level access controls to report viewing and
downloads.

## 16. Notifications

Support notifications for real events, including: - Target
verification. - Assessment created. - Assessment started. - Assessment
completed. - Assessment failed. - Critical finding detected. - Report
generated.

Do not create fake notifications.

## 17. Settings and Integrations

Provide: - Profile settings. - Security settings. - Notification
preferences. - Integration settings. - Future API access management.

Potential integrations may include GitHub, Slack, email, and external
security tools, but do not display any integration as connected until a
real connection has been established.

API keys must be created and managed securely on the backend. Do not
reveal secret values after creation.

## 18. Database Design

Create a relational schema with appropriate UUID primary keys, foreign
keys, indexes, constraints, timestamps, and organization-level RLS
policies.

Recommended tables:

-   `profiles`
-   `organizations`
-   `organization_members`
-   `targets`
-   `target_scopes`
-   `authorization_records`
-   `assessments`
-   `assessment_jobs`
-   `agents`
-   `agent_tasks`
-   `assessment_events`
-   `vulnerabilities`
-   `vulnerability_history`
-   `reports`
-   `notifications`
-   `audit_logs`
-   `ai_gateway_configs`
-   `ai_model_assignments`
-   `ai_request_logs`
-   `tool_registry`
-   `tool_execution_logs`

Store secrets in server-side configuration or a secure secret manager,
not in frontend-accessible tables.

Use migrations and enforce referential integrity. Make sure organization
membership and role checks are enforced in both the backend and database
policies.

## 19. ARGUS Backend API

These are proposed ARGUS application API routes. They are not Bifrost
API routes.

Targets: - `POST /api/targets` - `GET /api/targets` -
`POST /api/targets/:id/verify`

Assessments: - `POST /api/assessments` - `GET /api/assessments` -
`GET /api/assessments/:id` - `POST /api/assessments/:id/start` -
`POST /api/assessments/:id/cancel` - `GET /api/assessments/:id/events`

Vulnerabilities: - `GET /api/vulnerabilities` -
`GET /api/vulnerabilities/:id`

Reports: - `POST /api/reports` - `GET /api/reports/:id`

AI gateway: - `GET /api/ai-gateway/status` -
`POST /api/ai-gateway/test` - `GET /api/ai-gateway/models`

AI usage: - `GET /api/ai-usage/summary` - `GET /api/ai-usage/logs`

Implement authentication, authorization, validation, rate limits,
structured errors, and audit logging for all protected endpoints.

Use the official Bifrost documentation for Bifrost-specific routes and
request formats. Do not assume the ARGUS routes above are provided by
Bifrost.

## 20. Initial Real Scanning Capabilities

Start with safe, controlled capabilities:

-   DNS analysis.
-   TLS certificate inspection.
-   HTTP security-header checks.
-   Technology fingerprinting.
-   Public metadata inspection.
-   Safe configuration checks.
-   Controlled vulnerability checks within verified scope.

If the scanning engine is not connected or configured, display:

**Scanning infrastructure is not configured.**

Do not simulate execution or return made-up findings.

## 21. Implementation Phases

Build the platform incrementally.

### Phase 1 --- Product foundation

-   Brand system and design tokens.
-   Public landing pages.
-   Authentication.
-   Onboarding.
-   Application shell and navigation.
-   Dashboard structure.
-   Supabase project connection.

### Phase 2 --- Core application workflows

-   Targets.
-   Ownership verification.
-   Scope management.
-   Assessment wizard.
-   Assessment records and status handling.
-   Vulnerability management.
-   Reports interface.

### Phase 3 --- Bifrost integration

-   Server-side Bifrost connection.
-   Gateway health check.
-   Configured model catalog.
-   Model assignments.
-   Structured AI requests and responses.
-   Configured fallback behavior.
-   Usage and observability display.

### Phase 4 --- ARGUS CORE and agents

-   Orchestration service.
-   Specialized agent roles.
-   Tool registry.
-   MCP integration where supported.
-   Policy validation.
-   Human approval workflow.
-   Agent activity and audit logs.

### Phase 5 --- Scanning infrastructure

-   FastAPI backend.
-   Redis and Celery.
-   Isolated scanning workers.
-   Safe reconnaissance.
-   Real security checks.
-   Evidence storage.
-   Finding validation.
-   Realtime assessment updates.

### Phase 6 --- Production readiness

-   PDF report generation.
-   Notifications.
-   AI usage monitoring.
-   Audit logging.
-   Security hardening.
-   Performance optimization.
-   Deployment and operational monitoring.

## 22. Lovable Build Instructions

Build in manageable stages. Do not attempt to create a fully functioning
autonomous penetration-testing engine entirely inside the frontend.

Start with the brand system, responsive public website, authentication,
onboarding, app shell, and dashboard. Then implement database-backed
target and assessment workflows. Integrate Bifrost server-side only
after the application foundation is stable. Add ARGUS CORE, tool
governance, and isolated scanning workers as separate backend services.

### Non-negotiable requirements

-   Do not invent Bifrost routes, config fields, model names, or
    capabilities.
-   Verify the official Bifrost documentation and deployed version
    before coding the integration.
-   Do not make direct model-provider calls from the browser.
-   Do not hardcode secrets.
-   Do not expose Bifrost or provider credentials to the frontend.
-   Do not fabricate scans, agent activity, findings, metrics, or
    gateway status.
-   Do not show the gateway as connected unless a real backend check
    succeeds.
-   Do not show an agent as running unless a real backend task is
    active.
-   Do not execute AI-proposed tool calls without ARGUS policy
    validation and authorization checks.
-   Do not permit assessments against unverified or out-of-scope
    targets.
-   Implement proper Supabase RLS and backend organization isolation.
-   Make all visible controls functional or clearly disabled with an
    explanation.
-   Include loading, empty, error, and success states.
-   Use reusable components and maintain consistent design tokens.
-   Keep the application responsive and accessible.
-   Clearly label all demonstration data.

### First Lovable task

Begin by implementing **Phase 1 only**: 1. Establish the ARGUS design
system. 2. Build the public landing page and supporting public pages. 3.
Build authentication screens and protected-route structure. 4. Build
onboarding. 5. Build the authenticated application shell and navigation.
6. Build the overview dashboard with honest empty states. 7. Connect
Supabase for authentication and the initial data model.

Do not pretend that Bifrost, ARGUS CORE, or scanning infrastructure is
already connected. Prepare clean integration boundaries and clearly
communicate which capabilities are not yet configured.

## 23. Official Bifrost References

Use these official resources to verify current capabilities and
implementation details:

-   Bifrost GitHub repository: https://github.com/maximhq/bifrost
-   Bifrost documentation: https://docs.getbifrost.ai
-   Maxim AI --- LLM Gateway: https://www.getmaxim.ai/llm-gateway
-   Maxim AI --- MCP Gateway: https://www.getmaxim.ai/mcp-gateway
-   Bifrost overview: https://www.getmaxim.ai/bifrost/

Always prioritize the documentation for the exact Bifrost version being
deployed.
