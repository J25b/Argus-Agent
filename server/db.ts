import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import path from 'node:path';

const DB_PATH = path.resolve(process.cwd(), 'argus.db');

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL DEFAULT '',
      job_title TEXT NOT NULL DEFAULT '',
      intended_use_case TEXT NOT NULL DEFAULT '',
      auth_acknowledged INTEGER NOT NULL DEFAULT 0,
      onboarding_completed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      domain TEXT NOT NULL DEFAULT '',
      industry TEXT NOT NULL DEFAULT '',
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS organization_members (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('Owner', 'Administrator', 'Security Analyst', 'Viewer')),
      created_at TEXT NOT NULL,
      UNIQUE(organization_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS targets (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      domain TEXT NOT NULL,
      target_type TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      verification_status TEXT NOT NULL DEFAULT 'Unverified' CHECK(verification_status IN ('Unverified', 'Pending', 'Verified', 'Failed')),
      verification_method TEXT,
      verification_token TEXT NOT NULL,
      verified_at TEXT,
      created_by TEXT NOT NULL REFERENCES profiles(id),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS target_scopes (
      id TEXT PRIMARY KEY,
      target_id TEXT NOT NULL UNIQUE REFERENCES targets(id) ON DELETE CASCADE,
      allowed_domains TEXT NOT NULL DEFAULT '[]',
      allowed_paths TEXT NOT NULL DEFAULT '["/"]',
      excluded_paths TEXT NOT NULL DEFAULT '[]',
      permitted_methods TEXT NOT NULL DEFAULT '["DNS Analysis","TLS Inspection","HTTP Security Headers","Technology Fingerprinting","Public Metadata"]',
      restrictions TEXT NOT NULL DEFAULT 'No destructive testing, no denial-of-service, no credential brute-forcing, rate limited to 2 req/s.',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS authorization_records (
      id TEXT PRIMARY KEY,
      target_id TEXT NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES profiles(id),
      method TEXT NOT NULL,
      evidence TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS assessments (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      target_id TEXT NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
      profile TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('Draft', 'Pending Authorization', 'Queued', 'Running', 'Completed', 'Failed', 'Cancelled')),
      current_stage TEXT NOT NULL DEFAULT 'Authorization',
      require_tool_approval INTEGER NOT NULL DEFAULT 0,
      checks_performed_json TEXT NOT NULL DEFAULT '[]',
      started_at TEXT,
      completed_at TEXT,
      created_by TEXT NOT NULL REFERENCES profiles(id),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS assessment_events (
      id TEXT PRIMARY KEY,
      assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
      stage TEXT NOT NULL,
      agent_role TEXT NOT NULL,
      event_type TEXT NOT NULL,
      message TEXT NOT NULL,
      details_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agent_tasks (
      id TEXT PRIMARY KEY,
      assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      agent_role TEXT NOT NULL,
      task_name TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('Queued', 'Processing', 'Awaiting Approval', 'Executing', 'Completed', 'Failed', 'Rejected')),
      input_summary TEXT NOT NULL,
      output_summary TEXT,
      created_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS tool_registry (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      allowed_profiles_json TEXT NOT NULL,
      risk_level TEXT NOT NULL CHECK(risk_level IN ('Low', 'Moderate')),
      requires_approval INTEGER NOT NULL DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS tool_execution_logs (
      id TEXT PRIMARY KEY,
      assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      agent_role TEXT NOT NULL,
      tool_name TEXT NOT NULL,
      arguments_json TEXT NOT NULL,
      policy_decision TEXT NOT NULL CHECK(policy_decision IN ('Approved', 'Rejected', 'Awaiting Approval')),
      policy_reason TEXT NOT NULL,
      result_summary TEXT,
      evidence_json TEXT,
      executed_by TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS vulnerabilities (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      target_id TEXT NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
      assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      severity TEXT NOT NULL CHECK(severity IN ('Critical', 'High', 'Medium', 'Low', 'Informational')),
      endpoint TEXT NOT NULL,
      category TEXT NOT NULL,
      confidence TEXT NOT NULL CHECK(confidence IN ('Confirmed', 'High', 'Medium', 'Low')),
      validation_status TEXT NOT NULL CHECK(validation_status IN ('Open', 'Confirmed', 'False Positive', 'Accepted Risk', 'Resolved', 'Reopened')),
      cvss_score REAL,
      cvss_vector TEXT,
      cvss_version TEXT,
      description TEXT NOT NULL,
      technical_explanation TEXT NOT NULL,
      evidence TEXT NOT NULL,
      impact TEXT NOT NULL,
      remediation TEXT NOT NULL,
      discovered_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS vulnerability_history (
      id TEXT PRIMARY KEY,
      vulnerability_id TEXT NOT NULL REFERENCES vulnerabilities(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      user_email TEXT NOT NULL,
      from_status TEXT NOT NULL,
      to_status TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
      target_id TEXT NOT NULL REFERENCES targets(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      executive_summary TEXT NOT NULL,
      methodology TEXT NOT NULL,
      checks_performed_json TEXT NOT NULL,
      conclusion TEXT NOT NULL,
      generated_by TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      user_id TEXT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      link TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      user_email TEXT NOT NULL,
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      details_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_gateway_configs (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
      provider_mode TEXT NOT NULL DEFAULT 'gemini_server' CHECK(provider_mode IN ('gemini_server', 'bifrost')),
      bifrost_base_url TEXT NOT NULL DEFAULT '',
      default_model TEXT NOT NULL DEFAULT 'gemini-4-hydrogen',
      fallback_models_json TEXT NOT NULL DEFAULT '[]',
      request_timeout_ms INTEGER NOT NULL DEFAULT 30000,
      connection_status TEXT NOT NULL DEFAULT 'Not Configured',
      last_checked_at TEXT,
      last_check_message TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_model_assignments (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      agent_role TEXT NOT NULL,
      model_id TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(organization_id, agent_role)
    );

    CREATE TABLE IF NOT EXISTS ai_request_logs (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      assessment_id TEXT,
      agent_role TEXT NOT NULL,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('Success', 'Failed')),
      prompt_tokens INTEGER,
      completion_tokens INTEGER,
      latency_ms INTEGER,
      fallback_used INTEGER NOT NULL DEFAULT 0,
      error_message TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      key_prefix TEXT NOT NULL,
      key_hash TEXT NOT NULL,
      created_by TEXT NOT NULL,
      last_used_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS integrations (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      provider TEXT NOT NULL CHECK(provider IN ('github', 'slack', 'email', 'webhook')),
      status TEXT NOT NULL DEFAULT 'Disconnected' CHECK(status IN ('Disconnected', 'Connected')),
      config_json TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL,
      UNIQUE(organization_id, provider)
    );

    CREATE INDEX IF NOT EXISTS idx_targets_org ON targets(organization_id);
    CREATE INDEX IF NOT EXISTS idx_assessments_org ON assessments(organization_id);
    CREATE INDEX IF NOT EXISTS idx_events_assessment ON assessment_events(assessment_id);
    CREATE INDEX IF NOT EXISTS idx_vulns_org ON vulnerabilities(organization_id);
    CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_logs(organization_id);
    CREATE INDEX IF NOT EXISTS idx_notif_org ON notifications(organization_id);
  `);

  seedToolRegistry();
}

function seedToolRegistry(): void {
  const tools = [
    {
      id: 'tool-dns-lookup',
      name: 'dns_lookup',
      category: 'Reconnaissance',
      description: 'Resolves public DNS A, AAAA, MX, NS, TXT, DMARC, and CAA records within verified scope.',
      allowed_profiles: ['Passive Reconnaissance', 'Standard Web Security Assessment', 'Comprehensive Authorized Assessment'],
      risk_level: 'Low',
      requires_approval: 0,
    },
    {
      id: 'tool-tls-inspect',
      name: 'tls_inspect',
      category: 'Transport Security',
      description: 'Performs a read-only TLS handshake to verify protocol version, cipher suite, and certificate chain validity.',
      allowed_profiles: ['Passive Reconnaissance', 'Standard Web Security Assessment', 'Comprehensive Authorized Assessment'],
      risk_level: 'Low',
      requires_approval: 0,
    },
    {
      id: 'tool-public-metadata',
      name: 'public_metadata_check',
      category: 'Reconnaissance',
      description: 'Inspects /.well-known/security.txt and /robots.txt on verified HTTPS endpoints.',
      allowed_profiles: ['Passive Reconnaissance', 'Standard Web Security Assessment', 'Comprehensive Authorized Assessment'],
      risk_level: 'Low',
      requires_approval: 0,
    },
    {
      id: 'tool-http-headers',
      name: 'http_header_check',
      category: 'Web Security',
      description: 'Issues rate-limited HEAD/GET requests to evaluate HSTS, CSP, X-Frame-Options, cookie flags, and server headers.',
      allowed_profiles: ['Standard Web Security Assessment', 'Comprehensive Authorized Assessment'],
      risk_level: 'Moderate',
      requires_approval: 1,
    },
    {
      id: 'tool-tech-fingerprint',
      name: 'tech_fingerprint',
      category: 'Attack Surface',
      description: 'Safely identifies web server, CDN, and frontend framework signatures from sanitized HTTP responses.',
      allowed_profiles: ['Standard Web Security Assessment', 'Comprehensive Authorized Assessment'],
      risk_level: 'Moderate',
      requires_approval: 1,
    },
  ];

  const insert = db.prepare(`
    INSERT OR IGNORE INTO tool_registry (id, name, category, description, allowed_profiles_json, risk_level, requires_approval, enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `);

  for (const t of tools) {
    insert.run(t.id, t.name, t.category, t.description, JSON.stringify(t.allowed_profiles), t.risk_level, t.requires_approval);
  }
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, key] = storedHash.split(':');
  if (!salt || !key) return false;
  const keyBuf = Buffer.from(key, 'hex');
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, derivedBuf);
}

export function initOrgDefaults(orgId: string, now: string): void {
  const defaultModel = process.env.GEMINI_API_KEY ? 'gemini-4-hydrogen' : '';
  const initialStatus = process.env.GEMINI_API_KEY ? 'Connected' : 'Not Configured';
  const initialMsg = process.env.GEMINI_API_KEY
    ? 'Server-side Gemini engine ready (GEMINI_API_KEY present).'
    : 'No AI gateway configured.';

  db.prepare(`
    INSERT OR IGNORE INTO ai_gateway_configs (id, organization_id, provider_mode, bifrost_base_url, default_model, fallback_models_json, request_timeout_ms, connection_status, last_checked_at, last_check_message, updated_at)
    VALUES (?, ?, 'gemini_server', '', ?, '[]', 30000, ?, ?, ?, ?)
  `).run(crypto.randomUUID(), orgId, defaultModel, initialStatus, now, initialMsg, now);

  const roles = ['ARGUS CORE', 'RECON AGENT', 'ANALYSIS AGENT', 'VALIDATION AGENT', 'REPORTING AGENT'];
  const insertRole = db.prepare(`
    INSERT OR IGNORE INTO ai_model_assignments (id, organization_id, agent_role, model_id, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  for (const role of roles) {
    insertRole.run(crypto.randomUUID(), orgId, role, defaultModel || 'unassigned', now);
  }

  const providers = ['github', 'slack', 'email', 'webhook'];
  const insertInt = db.prepare(`
    INSERT OR IGNORE INTO integrations (id, organization_id, provider, status, config_json, updated_at)
    VALUES (?, ?, ?, 'Disconnected', '{}', ?)
  `);
  for (const p of providers) {
    insertInt.run(crypto.randomUUID(), orgId, p, now);
  }
}

export function ensureDemoEnvironment(): { userId: string; orgId: string; email: string } {
  const demoUserId = 'usr-demo-analyst';
  const demoOrgId = 'org-demo-northstar';
  const demoEmail = 'demo.analyst@northstar-demo.invalid';
  const now = new Date().toISOString();

  const existingOrg = db.prepare('SELECT id FROM organizations WHERE id = ?').get(demoOrgId);
  if (existingOrg) {
    return { userId: demoUserId, orgId: demoOrgId, email: demoEmail };
  }

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT OR IGNORE INTO profiles (id, email, password_hash, full_name, job_title, intended_use_case, auth_acknowledged, onboarding_completed, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, 1, ?)
    `).run(
      demoUserId,
      demoEmail,
      hashPassword('ArgusDemoSession!2026'),
      'Elena Vance',
      'Lead Security Engineer',
      'Continuous Authorized Web Assessment (Demo)',
      now
    );

    db.prepare(`
      INSERT OR IGNORE INTO organizations (id, name, domain, industry, is_demo, created_at)
      VALUES (?, ?, ?, ?, 1, ?)
    `).run(demoOrgId, 'Northstar Financial (Demo)', 'northstar-demo.invalid', 'Financial Technology', now);

    db.prepare(`
      INSERT OR IGNORE INTO organization_members (id, organization_id, user_id, role, created_at)
      VALUES (?, ?, ?, 'Administrator', ?)
    `).run('mem-demo-01', demoOrgId, demoUserId, now);

    initOrgDefaults(demoOrgId, now);

    const t1Id = 'tgt-demo-portal';
    const t2Id = 'tgt-demo-api';
    const t3Id = 'tgt-demo-staging';

    db.prepare(`
      INSERT INTO targets (id, organization_id, name, domain, target_type, description, verification_status, verification_method, verification_token, verified_at, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      t1Id,
      demoOrgId,
      'Northstar Customer Portal',
      'portal.northstar-demo.invalid',
      'Web Application',
      'Primary authenticated customer banking portal and edge gateway.',
      'Verified',
      'dns_txt',
      'argus-verify=demo-ns-8492a1',
      '2026-11-10T10:15:00.000Z',
      demoUserId,
      '2026-11-10T09:50:00.000Z'
    );

    db.prepare(`
      INSERT INTO target_scopes (id, target_id, allowed_domains, allowed_paths, excluded_paths, permitted_methods, restrictions, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'scp-demo-1',
      t1Id,
      JSON.stringify(['portal.northstar-demo.invalid']),
      JSON.stringify(['/', '/auth', '/.well-known']),
      JSON.stringify(['/admin/internal', '/legacy-export']),
      JSON.stringify(['DNS Analysis', 'TLS Inspection', 'HTTP Security Headers', 'Technology Fingerprinting', 'Public Metadata']),
      'Max 2 requests/sec. Strictly non-destructive header and transport inspection.',
      '2026-11-10T10:15:00.000Z'
    );

    db.prepare(`
      INSERT INTO targets (id, organization_id, name, domain, target_type, description, verification_status, verification_method, verification_token, verified_at, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      t2Id,
      demoOrgId,
      'Northstar Public API Gateway',
      'api.northstar-demo.invalid',
      'REST / GraphQL API',
      'External partner and mobile API ingress cluster.',
      'Verified',
      'http_file',
      'argus-verify=demo-ns-3109c4',
      '2026-11-12T14:20:00.000Z',
      demoUserId,
      '2026-11-12T14:00:00.000Z'
    );

    db.prepare(`
      INSERT INTO target_scopes (id, target_id, allowed_domains, allowed_paths, excluded_paths, permitted_methods, restrictions, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'scp-demo-2',
      t2Id,
      JSON.stringify(['api.northstar-demo.invalid']),
      JSON.stringify(['/v1', '/health', '/.well-known']),
      JSON.stringify(['/v1/billing/webhooks']),
      JSON.stringify(['DNS Analysis', 'TLS Inspection', 'HTTP Security Headers']),
      'Passive & header inspection only.',
      '2026-11-12T14:20:00.000Z'
    );

    db.prepare(`
      INSERT INTO targets (id, organization_id, name, domain, target_type, description, verification_status, verification_method, verification_token, verified_at, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      t3Id,
      demoOrgId,
      'Northstar Staging Sandbox',
      'staging.northstar-demo.invalid',
      'Staging Environment',
      'Pre-production release validation host awaiting DNS verification.',
      'Pending',
      'dns_txt',
      'argus-verify=demo-ns-7721f0',
      null,
      demoUserId,
      '2026-11-16T08:30:00.000Z'
    );

    db.prepare(`
      INSERT INTO target_scopes (id, target_id, allowed_domains, allowed_paths, excluded_paths, permitted_methods, restrictions, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'scp-demo-3',
      t3Id,
      JSON.stringify(['staging.northstar-demo.invalid']),
      JSON.stringify(['/']),
      JSON.stringify([]),
      JSON.stringify(['DNS Analysis', 'TLS Inspection']),
      'Awaiting ownership verification.',
      '2026-11-16T08:30:00.000Z'
    );

    db.prepare(`
      INSERT INTO authorization_records (id, target_id, organization_id, user_id, method, evidence, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'auth-demo-1',
      t1Id,
      demoOrgId,
      demoUserId,
      'dns_txt',
      'TXT record verified at _argus-verify.portal.northstar-demo.invalid containing argus-verify=demo-ns-8492a1',
      'Verified',
      '2026-11-10T10:15:00.000Z'
    );

    db.prepare(`
      INSERT INTO authorization_records (id, target_id, organization_id, user_id, method, evidence, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'auth-demo-2',
      t2Id,
      demoOrgId,
      demoUserId,
      'http_file',
      'HTTP 200 verified at https://api.northstar-demo.invalid/.well-known/argus-verification.txt',
      'Verified',
      '2026-11-12T14:20:00.000Z'
    );

    const a1Id = 'asmt-demo-001';
    const a2Id = 'asmt-demo-002';

    db.prepare(`
      INSERT INTO assessments (id, organization_id, target_id, profile, status, current_stage, require_tool_approval, checks_performed_json, started_at, completed_at, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
    `).run(
      a1Id,
      demoOrgId,
      t1Id,
      'Standard Web Security Assessment',
      'Completed',
      'Report Generation',
      JSON.stringify(['DNS Analysis', 'TLS Certificate Inspection', 'HTTP Security Headers', 'Technology Fingerprinting', 'Public Metadata Inspection']),
      '2026-11-15T11:00:00.000Z',
      '2026-11-15T11:02:14.000Z',
      demoUserId,
      '2026-11-15T10:59:30.000Z'
    );

    db.prepare(`
      INSERT INTO assessments (id, organization_id, target_id, profile, status, current_stage, require_tool_approval, checks_performed_json, started_at, completed_at, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
    `).run(
      a2Id,
      demoOrgId,
      t2Id,
      'Passive Reconnaissance',
      'Completed',
      'Report Generation',
      JSON.stringify(['DNS Analysis', 'TLS Certificate Inspection', 'Public Metadata Inspection']),
      '2026-11-17T09:15:00.000Z',
      '2026-11-17T09:16:08.000Z',
      demoUserId,
      '2026-11-17T09:14:40.000Z'
    );

    const events = [
      ['evt-d-1', a1Id, 'Authorization', 'ARGUS CORE', 'scope_verified', 'Verified target authorization (dns_txt) and loaded approved scope for portal.northstar-demo.invalid.', '2026-11-15T11:00:02.000Z'],
      ['evt-d-2', a1Id, 'Reconnaissance', 'RECON AGENT', 'tool_executed', 'Executed dns_lookup, tls_inspect, and http_header_check within scope.', '2026-11-15T11:00:34.000Z'],
      ['evt-d-3', a1Id, 'Security Analysis', 'ANALYSIS AGENT', 'analysis_completed', 'Analyzed security headers, cookie attributes, and DNS policy records; flagged 4 candidate findings.', '2026-11-15T11:01:22.000Z'],
      ['evt-d-4', a1Id, 'Validation', 'VALIDATION AGENT', 'validation_completed', 'Rechecked header responses and confirmed 4 findings with zero false positives.', '2026-11-15T11:01:55.000Z'],
      ['evt-d-5', a1Id, 'Report Generation', 'REPORTING AGENT', 'report_generated', 'Compiled structured security assessment report RPT-DEMO-001.', '2026-11-15T11:02:14.000Z'],
    ];

    const insEvt = db.prepare(`
      INSERT INTO assessment_events (id, assessment_id, stage, agent_role, event_type, message, details_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, NULL, ?)
    `);
    for (const e of events) insEvt.run(...e);

    const vulns = [
      {
        id: 'vuln-demo-001',
        target_id: t1Id,
        assessment_id: a1Id,
        title: 'Missing Content-Security-Policy (CSP) Header on Authenticated Portal',
        severity: 'High',
        endpoint: 'https://portal.northstar-demo.invalid/',
        category: 'Security Misconfiguration',
        confidence: 'Confirmed',
        validation_status: 'Confirmed',
        cvss_score: 7.4,
        cvss_vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:H/I:N/A:N',
        cvss_version: 'CVSS v3.1',
        description: 'The primary portal document response omits a Content-Security-Policy header, leaving script execution and framing unrestricted in modern browsers.',
        technical_explanation: 'HTTP GET / returned 200 OK without Content-Security-Policy or frame-ancestors directives. Third-party script origins and inline execution are unconstrained if an injection sink is introduced.',
        evidence: 'HTTP/1.1 200 OK\nStrict-Transport-Security: max-age=31536000\nX-Content-Type-Options: nosniff\n[Content-Security-Policy header absent]',
        impact: 'Increases blast radius of any cross-site scripting (XSS) or rogue browser extension injection against authenticated banking sessions.',
        remediation: 'Deploy a strict Content-Security-Policy with nonce-based script-src, object-src \'none\', base-uri \'self\', and frame-ancestors \'none\'.',
        discovered_at: '2026-11-15T11:01:40.000Z',
      },
      {
        id: 'vuln-demo-002',
        target_id: t1Id,
        assessment_id: a1Id,
        title: 'Session Cookie Missing SameSite=Strict/Lax Attribute',
        severity: 'Medium',
        endpoint: 'https://portal.northstar-demo.invalid/auth',
        category: 'Session Management',
        confidence: 'Confirmed',
        validation_status: 'Open',
        cvss_score: 5.3,
        cvss_vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:L/A:N',
        cvss_version: 'CVSS v3.1',
        description: 'Authentication session cookies observed in Set-Cookie headers omit explicit SameSite enforcement.',
        technical_explanation: 'Set-Cookie header includes Secure and HttpOnly flags but lacks SameSite=Lax or SameSite=Strict, relying on browser defaults.',
        evidence: 'Set-Cookie: ns_session=redacted; Path=/; Secure; HttpOnly',
        impact: 'Depending on user browser behavior, state-changing endpoints lacking anti-CSRF tokens could be exposed to cross-site request forgery.',
        remediation: 'Append SameSite=Lax (or SameSite=Strict for sensitive flows) to all authentication cookies.',
        discovered_at: '2026-11-15T11:01:44.000Z',
      },
      {
        id: 'vuln-demo-003',
        target_id: t2Id,
        assessment_id: a2Id,
        title: 'DMARC Policy Set to Monitoring Mode (p=none)',
        severity: 'Medium',
        endpoint: '_dmarc.api.northstar-demo.invalid',
        category: 'DNS & Email Authentication',
        confidence: 'Confirmed',
        validation_status: 'Accepted Risk',
        cvss_score: 4.3,
        cvss_vector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:N/I:L/A:N',
        cvss_version: 'CVSS v3.1',
        description: 'The domain DMARC TXT record specifies p=none, instructing receiving mail servers not to quarantine or reject spoofed messages.',
        technical_explanation: 'DNS TXT lookup for _dmarc.api.northstar-demo.invalid returned v=DMARC1; p=none; rua=mailto:dmarc@northstar-demo.invalid.',
        evidence: 'TXT _dmarc.api.northstar-demo.invalid -> "v=DMARC1; p=none; rua=mailto:dmarc@northstar-demo.invalid"',
        impact: 'Domain remains susceptible to lookalike phishing attacks impersonating Northstar API notifications.',
        remediation: 'Audit legitimate mail senders via RUA reports and transition DMARC policy to p=quarantine and ultimately p=reject.',
        discovered_at: '2026-11-17T09:15:52.000Z',
      },
      {
        id: 'vuln-demo-004',
        target_id: t1Id,
        assessment_id: a1Id,
        title: 'TLS 1.1 Legacy Cipher Support Detected on Edge Listener',
        severity: 'Critical',
        endpoint: 'portal.northstar-demo.invalid:443',
        category: 'Cryptographic Exposure',
        confidence: 'High',
        validation_status: 'Confirmed',
        cvss_score: 8.1,
        cvss_vector: 'CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:N',
        cvss_version: 'CVSS v3.1',
        description: 'Edge TLS termination accepted negotiation using deprecated TLS 1.1 protocol alongside CBC cipher suites.',
        technical_explanation: 'Controlled TLS handshake probe verified backward compatibility with TLSv1.1 and weak CBC suites, violating modern cryptographic baselines.',
        evidence: 'TLS Probe -> Negotiated TLSv1.1 / ECDHE-RSA-AES128-SHA',
        impact: 'Exposes legacy client sessions to downgrade and padding-oracle attacks and fails modern security standards.',
        remediation: 'Disable TLS 1.0 and TLS 1.1 at the edge load balancer; enforce TLS 1.2 (AEAD ciphers only) and TLS 1.3.',
        discovered_at: '2026-11-15T11:01:48.000Z',
      },
    ];

    const insVuln = db.prepare(`
      INSERT INTO vulnerabilities (id, organization_id, target_id, assessment_id, title, severity, endpoint, category, confidence, validation_status, cvss_score, cvss_vector, cvss_version, description, technical_explanation, evidence, impact, remediation, discovered_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const v of vulns) {
      insVuln.run(
        v.id, demoOrgId, v.target_id, v.assessment_id, v.title, v.severity, v.endpoint, v.category,
        v.confidence, v.validation_status, v.cvss_score, v.cvss_vector, v.cvss_version,
        v.description, v.technical_explanation, v.evidence, v.impact, v.remediation, v.discovered_at
      );
    }

    db.prepare(`
      INSERT INTO reports (id, organization_id, assessment_id, target_id, title, executive_summary, methodology, checks_performed_json, conclusion, generated_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'rpt-demo-001',
      demoOrgId,
      a1Id,
      t1Id,
      'Northstar Customer Portal — Authorized Security Assessment Report',
      'ARGUS completed a Standard Web Security Assessment against portal.northstar-demo.invalid following DNS TXT ownership verification. Three validated findings were identified across transport cryptography, browser security headers, and session cookie configuration.',
      'All checks executed strictly within the verified scope using non-destructive, rate-limited inspection tools governed by the ARGUS Policy Engine.',
      JSON.stringify(['DNS Analysis', 'TLS Certificate Inspection', 'HTTP Security Headers', 'Technology Fingerprinting', 'Public Metadata Inspection']),
      'Prioritize disabling TLS 1.1 at the edge load balancer and deploying an explicit Content-Security-Policy header before the next release cycle.',
      demoEmail,
      '2026-11-15T11:02:14.000Z'
    );

    db.prepare(`
      INSERT INTO audit_logs (id, organization_id, user_id, user_email, action, resource_type, resource_id, details_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'aud-demo-001',
      demoOrgId,
      demoUserId,
      demoEmail,
      'ASSESSMENT_COMPLETED',
      'assessment',
      a1Id,
      JSON.stringify({ target: 'portal.northstar-demo.invalid', findings: 3 }),
      '2026-11-15T11:02:14.000Z'
    );

    db.prepare(`
      INSERT INTO notifications (id, organization_id, user_id, type, title, message, link, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
    `).run(
      'ntf-demo-001',
      demoOrgId,
      demoUserId,
      'critical_finding',
      'Critical finding confirmed on portal.northstar-demo.invalid',
      'TLS 1.1 Legacy Cipher Support Detected on Edge Listener (CVSS v3.1: 8.1).',
      '/app/vulnerabilities/vuln-demo-004',
      '2026-11-15T11:01:50.000Z'
    );
  });

  tx();
  return { userId: demoUserId, orgId: demoOrgId, email: demoEmail };
}
