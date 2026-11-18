import 'dotenv/config';
import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { db, ensureDemoEnvironment, hashPassword, initDatabase, initOrgDefaults, verifyPassword } from './server/db.ts';
import { requireAuth, requireRole, signSessionToken, writeAuditLog, type AuthenticatedRequest } from './server/auth.ts';
import { validateTargetDomain, verifyTargetOwnership } from './server/security.ts';
import { getGatewayStatus, setOrgGatewaySecrets, testGatewayConnection } from './server/aiGateway.ts';
import { cancelActiveAssessment, launchAssessmentExecution, resolveToolApproval } from './server/orchestrator.ts';
import type { OrgRole, VulnerabilitySeverity } from './src/types/argus.ts';

initDatabase();

const app = express();
app.use(express.json({ limit: '1mb' }));

// Simple in-memory rate limiter for auth & scan triggers
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
function rateLimit(maxRequests: number, windowMs: number) {
  return (req: express.Request, res: express.Response, next: express.NextFunction): void => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const bucket = rateBuckets.get(key);
    if (!bucket || now > bucket.resetAt) {
      rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }
    if (bucket.count >= maxRequests) {
      res.status(429).json({ error: 'Rate limit exceeded. Please wait before retrying.' });
      return;
    }
    bucket.count += 1;
    next();
  };
}

function buildSessionResponse(userId: string, orgId: string) {
  const user = db.prepare('SELECT id, email, full_name, job_title, intended_use_case, auth_acknowledged, onboarding_completed, created_at FROM profiles WHERE id = ?').get(userId) as {
    id: string;
    email: string;
    full_name: string;
    job_title: string;
    intended_use_case: string;
    auth_acknowledged: number;
    onboarding_completed: number;
    created_at: string;
  };
  const org = db.prepare(`
    SELECT o.id, o.name, o.domain, o.industry, o.is_demo, o.created_at, m.role
    FROM organizations o
    JOIN organization_members m ON m.organization_id = o.id
    WHERE o.id = ? AND m.user_id = ?
  `).get(orgId, userId) as {
    id: string;
    name: string;
    domain: string;
    industry: string;
    is_demo: number;
    created_at: string;
    role: OrgRole;
  };

  const token = signSessionToken({ userId: user.id, orgId: org.id, email: user.email });
  return {
    token,
    user: {
      ...user,
      auth_acknowledged: user.auth_acknowledged === 1,
      onboarding_completed: user.onboarding_completed === 1,
    },
    organization: {
      ...org,
      is_demo: org.is_demo === 1,
    },
  };
}

// Health endpoint
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'argus-api' });
});

// ================= AUTH & ONBOARDING =================
app.post('/api/auth/signup', rateLimit(15, 60_000), (req, res) => {
  const { email, password, full_name } = req.body as { email?: string; password?: string; full_name?: string };
  if (!email || !password || password.length < 8) {
    res.status(400).json({ error: 'Valid email and password (minimum 8 characters) are required.' });
    return;
  }
  const normalizedEmail = email.trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM profiles WHERE email = ?').get(normalizedEmail);
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists.' });
    return;
  }

  const userId = crypto.randomUUID();
  const orgId = crypto.randomUUID();
  const now = new Date().toISOString();
  const cleanName = (full_name || '').trim() || normalizedEmail.split('@')[0];

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO profiles (id, email, password_hash, full_name, job_title, intended_use_case, auth_acknowledged, onboarding_completed, created_at)
      VALUES (?, ?, ?, ?, '', '', 0, 0, ?)
    `).run(userId, normalizedEmail, hashPassword(password), cleanName, now);

    db.prepare(`
      INSERT INTO organizations (id, name, domain, industry, is_demo, created_at)
      VALUES (?, ?, '', '', 0, ?)
    `).run(orgId, `${cleanName}'s Organization`, now);

    db.prepare(`
      INSERT INTO organization_members (id, organization_id, user_id, role, created_at)
      VALUES (?, ?, ?, 'Owner', ?)
    `).run(crypto.randomUUID(), orgId, userId, now);

    initOrgDefaults(orgId, now);
  });

  tx();
  writeAuditLog({
    orgId,
    userId,
    userEmail: normalizedEmail,
    action: 'USER_REGISTERED',
    resourceType: 'profile',
    resourceId: userId,
  });

  res.status(201).json(buildSessionResponse(userId, orgId));
});

app.post('/api/auth/login', rateLimit(20, 60_000), (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }
  const normalizedEmail = email.trim().toLowerCase();
  const user = db.prepare('SELECT id, password_hash FROM profiles WHERE email = ?').get(normalizedEmail) as
    | { id: string; password_hash: string }
    | undefined;
  if (!user || !verifyPassword(password, user.password_hash)) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }
  const membership = db
    .prepare('SELECT organization_id FROM organization_members WHERE user_id = ? ORDER BY created_at ASC LIMIT 1')
    .get(user.id) as { organization_id: string } | undefined;
  if (!membership) {
    res.status(403).json({ error: 'No organization membership associated with this account.' });
    return;
  }
  writeAuditLog({
    orgId: membership.organization_id,
    userId: user.id,
    userEmail: normalizedEmail,
    action: 'USER_LOGIN',
    resourceType: 'session',
    resourceId: user.id,
  });
  res.json(buildSessionResponse(user.id, membership.organization_id));
});

app.post('/api/auth/demo', rateLimit(20, 60_000), (_req, res) => {
  const demo = ensureDemoEnvironment();
  res.json(buildSessionResponse(demo.userId, demo.orgId));
});

app.post('/api/auth/forgot-password', rateLimit(10, 60_000), (req, res) => {
  const { email } = req.body as { email?: string };
  if (!email || !email.includes('@')) {
    res.status(400).json({ error: 'Provide a valid email address.' });
    return;
  }
  res.json({
    ok: true,
    message: 'If an account matches that address, password recovery instructions have been dispatched.',
  });
});

app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
  res.json(buildSessionResponse(req.auth!.userId, req.auth!.orgId));
});

app.post('/api/onboarding', requireAuth, (req: AuthenticatedRequest, res) => {
  const { full_name, job_title, organization_name, organization_domain, industry, intended_use_case, auth_acknowledged } = req.body as {
    full_name?: string;
    job_title?: string;
    organization_name?: string;
    organization_domain?: string;
    industry?: string;
    intended_use_case?: string;
    auth_acknowledged?: boolean;
  };

  if (!full_name?.trim() || !organization_name?.trim() || !auth_acknowledged) {
    res.status(400).json({
      error: 'Full name, organization name, and acknowledgement of authorization requirements are required.',
    });
    return;
  }

  db.prepare(`
    UPDATE profiles
    SET full_name = ?, job_title = ?, intended_use_case = ?, auth_acknowledged = 1, onboarding_completed = 1
    WHERE id = ?
  `).run(full_name.trim(), (job_title || '').trim(), (intended_use_case || '').trim(), req.auth!.userId);

  db.prepare(`
    UPDATE organizations
    SET name = ?, domain = ?, industry = ?
    WHERE id = ?
  `).run(organization_name.trim(), (organization_domain || '').trim(), (industry || '').trim(), req.auth!.orgId);

  writeAuditLog({
    orgId: req.auth!.orgId,
    userId: req.auth!.userId,
    userEmail: req.auth!.email,
    action: 'ONBOARDING_COMPLETED',
    resourceType: 'organization',
    resourceId: req.auth!.orgId,
    details: { organization_name: organization_name.trim() },
  });

  res.json(buildSessionResponse(req.auth!.userId, req.auth!.orgId));
});

// ================= OVERVIEW DASHBOARD =================
app.get('/api/overview', requireAuth, (req: AuthenticatedRequest, res) => {
  const orgId = req.auth!.orgId;

  const totalAssessments = (db.prepare('SELECT COUNT(*) as c FROM assessments WHERE organization_id = ?').get(orgId) as { c: number }).c;
  const registeredTargets = (db.prepare('SELECT COUNT(*) as c FROM targets WHERE organization_id = ?').get(orgId) as { c: number }).c;
  const verifiedTargets = (
    db.prepare("SELECT COUNT(*) as c FROM targets WHERE organization_id = ? AND verification_status = 'Verified'").get(orgId) as { c: number }
  ).c;
  const totalVulnerabilities = (db.prepare('SELECT COUNT(*) as c FROM vulnerabilities WHERE organization_id = ?').get(orgId) as { c: number }).c;
  const criticalFindings = (
    db.prepare("SELECT COUNT(*) as c FROM vulnerabilities WHERE organization_id = ? AND severity = 'Critical'").get(orgId) as { c: number }
  ).c;

  const sevRows = db
    .prepare('SELECT severity, COUNT(*) as c FROM vulnerabilities WHERE organization_id = ? GROUP BY severity')
    .all(orgId) as { severity: VulnerabilitySeverity; c: number }[];
  const severity_distribution: Record<VulnerabilitySeverity, number> = {
    Critical: 0,
    High: 0,
    Medium: 0,
    Low: 0,
    Informational: 0,
  };
  for (const r of sevRows) severity_distribution[r.severity] = r.c;

  const recentAssessments = (
    db
      .prepare(`
      SELECT a.*, t.name as target_name, t.domain as target_domain
      FROM assessments a
      JOIN targets t ON t.id = a.target_id
      WHERE a.organization_id = ?
      ORDER BY a.created_at DESC
      LIMIT 5
    `)
      .all(orgId) as Record<string, unknown>[]
  ).map((r) => ({
    ...r,
    require_tool_approval: r.require_tool_approval === 1,
    checks_performed: JSON.parse((r.checks_performed_json as string) || '[]'),
  }));

  const recentVulnerabilities = db
    .prepare(`
      SELECT v.*, t.name as target_name, t.domain as target_domain
      FROM vulnerabilities v
      JOIN targets t ON t.id = v.target_id
      WHERE v.organization_id = ?
      ORDER BY v.discovered_at DESC
      LIMIT 5
    `)
    .all(orgId);

  const recentActivity = (
    db
      .prepare('SELECT * FROM audit_logs WHERE organization_id = ? ORDER BY created_at DESC LIMIT 8')
      .all(orgId) as Record<string, unknown>[]
  ).map((r) => ({
    ...r,
    details: r.details_json ? JSON.parse(r.details_json as string) : null,
  }));

  const timelineRows = db
    .prepare(`
      SELECT substr(a.created_at, 1, 10) as date,
             COUNT(DISTINCT a.id) as completed,
             COUNT(v.id) as findings
      FROM assessments a
      LEFT JOIN vulnerabilities v ON v.assessment_id = a.id
      WHERE a.organization_id = ?
      GROUP BY substr(a.created_at, 1, 10)
      ORDER BY date ASC
      LIMIT 14
    `)
    .all(orgId);

  res.json({
    total_assessments: totalAssessments,
    registered_targets: registeredTargets,
    verified_targets: verifiedTargets,
    total_vulnerabilities: totalVulnerabilities,
    critical_findings: criticalFindings,
    severity_distribution,
    recent_assessments: recentAssessments,
    recent_vulnerabilities: recentVulnerabilities,
    recent_activity: recentActivity,
    assessment_timeline: timelineRows,
  });
});

// ================= TARGETS & SCOPE =================
function formatTarget(row: Record<string, unknown>) {
  const scopeRow = db.prepare('SELECT * FROM target_scopes WHERE target_id = ?').get(row.id) as Record<string, unknown> | undefined;
  return {
    ...row,
    scope: scopeRow
      ? {
          id: scopeRow.id,
          target_id: scopeRow.target_id,
          allowed_domains: JSON.parse(scopeRow.allowed_domains as string),
          allowed_paths: JSON.parse(scopeRow.allowed_paths as string),
          excluded_paths: JSON.parse(scopeRow.excluded_paths as string),
          permitted_methods: JSON.parse(scopeRow.permitted_methods as string),
          restrictions: scopeRow.restrictions,
          updated_at: scopeRow.updated_at,
        }
      : undefined,
  };
}

app.get('/api/targets', requireAuth, (req: AuthenticatedRequest, res) => {
  const rows = db
    .prepare('SELECT * FROM targets WHERE organization_id = ? ORDER BY created_at DESC')
    .all(req.auth!.orgId) as Record<string, unknown>[];
  res.json(rows.map(formatTarget));
});

app.post('/api/targets', requireAuth, requireRole(['Owner', 'Administrator', 'Security Analyst']), (req: AuthenticatedRequest, res) => {
  const { name, domain, target_type, description } = req.body as {
    name?: string;
    domain?: string;
    target_type?: string;
    description?: string;
  };
  if (!name?.trim() || !domain?.trim()) {
    res.status(400).json({ error: 'Target name and domain are required.' });
    return;
  }
  const check = validateTargetDomain(domain);
  if (!check.valid) {
    res.status(400).json({ error: check.reason });
    return;
  }

  const targetId = crypto.randomUUID();
  const token = `argus-verify=${crypto.randomBytes(12).toString('hex')}`;
  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO targets (id, organization_id, name, domain, target_type, description, verification_status, verification_method, verification_token, verified_at, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'Unverified', NULL, ?, NULL, ?, ?)
    `).run(targetId, req.auth!.orgId, name.trim(), check.domain, (target_type || 'Web Application').trim(), (description || '').trim(), token, req.auth!.userId, now);

    db.prepare(`
      INSERT INTO target_scopes (id, target_id, allowed_domains, allowed_paths, excluded_paths, permitted_methods, restrictions, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      targetId,
      JSON.stringify([check.domain]),
      JSON.stringify(['/']),
      JSON.stringify([]),
      JSON.stringify(['DNS Analysis', 'TLS Inspection', 'HTTP Security Headers', 'Technology Fingerprinting', 'Public Metadata']),
      'Non-destructive security inspection only. Rate limited to 2 req/s.',
      now
    );
  });
  tx();

  writeAuditLog({
    orgId: req.auth!.orgId,
    userId: req.auth!.userId,
    userEmail: req.auth!.email,
    action: 'TARGET_CREATED',
    resourceType: 'target',
    resourceId: targetId,
    details: { domain: check.domain },
  });

  const created = db.prepare('SELECT * FROM targets WHERE id = ?').get(targetId) as Record<string, unknown>;
  res.status(201).json(formatTarget(created));
});

app.get('/api/targets/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const row = db.prepare('SELECT * FROM targets WHERE id = ? AND organization_id = ?').get(req.params.id, req.auth!.orgId) as
    | Record<string, unknown>
    | undefined;
  if (!row) {
    res.status(404).json({ error: 'Target not found.' });
    return;
  }

  const authHistory = db
    .prepare(`
      SELECT ar.*, p.email as user_email
      FROM authorization_records ar
      LEFT JOIN profiles p ON p.id = ar.user_id
      WHERE ar.target_id = ? AND ar.organization_id = ?
      ORDER BY ar.created_at DESC
    `)
    .all(row.id, req.auth!.orgId);

  const assessments = (
    db
      .prepare('SELECT * FROM assessments WHERE target_id = ? AND organization_id = ? ORDER BY created_at DESC')
      .all(row.id, req.auth!.orgId) as Record<string, unknown>[]
  ).map((a) => ({
    ...a,
    require_tool_approval: a.require_tool_approval === 1,
    checks_performed: JSON.parse((a.checks_performed_json as string) || '[]'),
  }));

  const vulnerabilities = db
    .prepare('SELECT * FROM vulnerabilities WHERE target_id = ? AND organization_id = ? ORDER BY discovered_at DESC')
    .all(row.id, req.auth!.orgId);

  res.json({
    target: formatTarget(row),
    authorization_history: authHistory,
    assessments,
    vulnerabilities,
  });
});

app.put('/api/targets/:id/scope', requireAuth, requireRole(['Owner', 'Administrator', 'Security Analyst']), (req: AuthenticatedRequest, res) => {
  const target = db.prepare('SELECT * FROM targets WHERE id = ? AND organization_id = ?').get(req.params.id, req.auth!.orgId) as
    | { id: string; domain: string }
    | undefined;
  if (!target) {
    res.status(404).json({ error: 'Target not found.' });
    return;
  }

  const { allowed_domains, allowed_paths, excluded_paths, permitted_methods, restrictions } = req.body as {
    allowed_domains?: string[];
    allowed_paths?: string[];
    excluded_paths?: string[];
    permitted_methods?: string[];
    restrictions?: string;
  };

  // Enforce scope containment: allowed_domains must be subdomains or exact match of verified target domain
  const sanitizedDomains = (allowed_domains || [target.domain])
    .map((d) => d.trim().toLowerCase())
    .filter((d) => d === target.domain || d.endsWith(`.${target.domain}`));
  if (sanitizedDomains.length === 0) {
    res.status(400).json({
      error: `Scope expansion rejected: allowed domains must match or be subdomains of verified domain ${target.domain}.`,
    });
    return;
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE target_scopes
    SET allowed_domains = ?, allowed_paths = ?, excluded_paths = ?, permitted_methods = ?, restrictions = ?, updated_at = ?
    WHERE target_id = ?
  `).run(
    JSON.stringify(sanitizedDomains),
    JSON.stringify((allowed_paths || ['/']).map((p) => p.trim()).filter(Boolean)),
    JSON.stringify((excluded_paths || []).map((p) => p.trim()).filter(Boolean)),
    JSON.stringify(permitted_methods || []),
    (restrictions || '').trim(),
    now,
    target.id
  );

  writeAuditLog({
    orgId: req.auth!.orgId,
    userId: req.auth!.userId,
    userEmail: req.auth!.email,
    action: 'TARGET_SCOPE_UPDATED',
    resourceType: 'target',
    resourceId: target.id,
    details: { allowed_domains: sanitizedDomains },
  });

  const updated = db.prepare('SELECT * FROM targets WHERE id = ?').get(target.id) as Record<string, unknown>;
  res.json(formatTarget(updated));
});

app.post('/api/targets/:id/verify', requireAuth, requireRole(['Owner', 'Administrator', 'Security Analyst']), rateLimit(12, 60_000), async (req: AuthenticatedRequest, res) => {
  const target = db.prepare('SELECT * FROM targets WHERE id = ? AND organization_id = ?').get(req.params.id, req.auth!.orgId) as
    | { id: string; domain: string; verification_token: string }
    | undefined;
  if (!target) {
    res.status(404).json({ error: 'Target not found.' });
    return;
  }

  const { method } = req.body as { method?: 'dns_txt' | 'http_file' };
  if (method !== 'dns_txt' && method !== 'http_file') {
    res.status(400).json({ error: 'Verification method must be dns_txt or http_file.' });
    return;
  }

  const result = await verifyTargetOwnership(target.domain, method, target.verification_token);
  const now = new Date().toISOString();
  const nextStatus = result.verified ? 'Verified' : 'Failed';

  db.prepare(`
    UPDATE targets
    SET verification_status = ?, verification_method = ?, verified_at = ?
    WHERE id = ?
  `).run(nextStatus, method, result.verified ? now : null, target.id);

  db.prepare(`
    INSERT INTO authorization_records (id, target_id, organization_id, user_id, method, evidence, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(crypto.randomUUID(), target.id, req.auth!.orgId, req.auth!.userId, method, result.evidence || result.error || '', nextStatus, now);

  if (result.verified) {
    db.prepare(`
      INSERT INTO notifications (id, organization_id, user_id, type, title, message, link, is_read, created_at)
      VALUES (?, ?, NULL, 'target_verified', ?, ?, ?, 0, ?)
    `).run(
      crypto.randomUUID(),
      req.auth!.orgId,
      `Target verified: ${target.domain}`,
      `Ownership confirmed via ${method === 'dns_txt' ? 'DNS TXT record' : 'HTTP verification file'}.`,
      `/app/targets/${target.id}`,
      now
    );
  }

  writeAuditLog({
    orgId: req.auth!.orgId,
    userId: req.auth!.userId,
    userEmail: req.auth!.email,
    action: result.verified ? 'TARGET_VERIFIED' : 'TARGET_VERIFICATION_FAILED',
    resourceType: 'target',
    resourceId: target.id,
    details: { method, domain: target.domain, verified: result.verified },
  });

  const updated = db.prepare('SELECT * FROM targets WHERE id = ?').get(target.id) as Record<string, unknown>;
  res.json({
    verified: result.verified,
    evidence: result.evidence,
    error: result.error || null,
    target: formatTarget(updated),
  });
});

// ================= ASSESSMENTS =================
app.get('/api/assessments', requireAuth, (req: AuthenticatedRequest, res) => {
  const rows = (
    db
      .prepare(`
      SELECT a.*, t.name as target_name, t.domain as target_domain
      FROM assessments a
      JOIN targets t ON t.id = a.target_id
      WHERE a.organization_id = ?
      ORDER BY a.created_at DESC
    `)
      .all(req.auth!.orgId) as Record<string, unknown>[]
  ).map((r) => ({
    ...r,
    require_tool_approval: r.require_tool_approval === 1,
    checks_performed: JSON.parse((r.checks_performed_json as string) || '[]'),
  }));
  res.json(rows);
});

app.post('/api/assessments', requireAuth, requireRole(['Owner', 'Administrator', 'Security Analyst']), (req: AuthenticatedRequest, res) => {
  const { target_id, profile, require_tool_approval, launch_immediately } = req.body as {
    target_id?: string;
    profile?: string;
    require_tool_approval?: boolean;
    launch_immediately?: boolean;
  };

  if (!target_id || !profile) {
    res.status(400).json({ error: 'target_id and profile are required.' });
    return;
  }

  const target = db.prepare('SELECT * FROM targets WHERE id = ? AND organization_id = ?').get(target_id, req.auth!.orgId) as
    | { id: string; domain: string; verification_status: string }
    | undefined;
  if (!target) {
    res.status(404).json({ error: 'Target not found.' });
    return;
  }
  if (target.verification_status !== 'Verified') {
    res.status(403).json({
      error: 'Unverified target assessment blocked. Complete DNS TXT or HTTP ownership verification before creating an assessment.',
    });
    return;
  }

  const assessmentId = crypto.randomUUID();
  const now = new Date().toISOString();
  const initialStatus = launch_immediately ? 'Queued' : 'Pending Authorization';

  db.prepare(`
    INSERT INTO assessments (id, organization_id, target_id, profile, status, current_stage, require_tool_approval, checks_performed_json, started_at, completed_at, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, 'Authorization', ?, '[]', NULL, NULL, ?, ?)
  `).run(assessmentId, req.auth!.orgId, target.id, profile, initialStatus, require_tool_approval ? 1 : 0, req.auth!.userId, now);

  db.prepare(`
    INSERT INTO notifications (id, organization_id, user_id, type, title, message, link, is_read, created_at)
    VALUES (?, ?, NULL, 'assessment_created', ?, ?, ?, 0, ?)
  `).run(
    crypto.randomUUID(),
    req.auth!.orgId,
    `Assessment created for ${target.domain}`,
    `Profile: ${profile}`,
    `/app/assessments/${assessmentId}`,
    now
  );

  writeAuditLog({
    orgId: req.auth!.orgId,
    userId: req.auth!.userId,
    userEmail: req.auth!.email,
    action: 'ASSESSMENT_CREATED',
    resourceType: 'assessment',
    resourceId: assessmentId,
    details: { target_domain: target.domain, profile },
  });

  if (launch_immediately) {
    launchAssessmentExecution({
      assessmentId,
      orgId: req.auth!.orgId,
      userId: req.auth!.userId,
      userEmail: req.auth!.email,
    });
  }

  const created = db
    .prepare(`
      SELECT a.*, t.name as target_name, t.domain as target_domain
      FROM assessments a
      JOIN targets t ON t.id = a.target_id
      WHERE a.id = ?
    `)
    .get(assessmentId) as Record<string, unknown>;

  res.status(201).json({
    ...created,
    require_tool_approval: created.require_tool_approval === 1,
    checks_performed: [],
  });
});

app.get('/api/assessments/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const row = db
    .prepare(`
      SELECT a.*, t.name as target_name, t.domain as target_domain
      FROM assessments a
      JOIN targets t ON t.id = a.target_id
      WHERE a.id = ? AND a.organization_id = ?
    `)
    .get(req.params.id, req.auth!.orgId) as Record<string, unknown> | undefined;

  if (!row) {
    res.status(404).json({ error: 'Assessment not found.' });
    return;
  }

  const events = (
    db
      .prepare('SELECT * FROM assessment_events WHERE assessment_id = ? ORDER BY created_at ASC')
      .all(row.id) as Record<string, unknown>[]
  ).map((e) => ({
    ...e,
    details: e.details_json ? JSON.parse(e.details_json as string) : null,
  }));

  const tasks = db.prepare('SELECT * FROM agent_tasks WHERE assessment_id = ? ORDER BY created_at ASC').all(row.id);

  const toolLogs = (
    db
      .prepare('SELECT * FROM tool_execution_logs WHERE assessment_id = ? ORDER BY created_at ASC')
      .all(row.id) as Record<string, unknown>[]
  ).map((l) => ({
    ...l,
    arguments: JSON.parse((l.arguments_json as string) || '{}'),
    evidence: l.evidence_json ? JSON.parse(l.evidence_json as string) : null,
  }));

  const vulnerabilities = db
    .prepare('SELECT * FROM vulnerabilities WHERE assessment_id = ? ORDER BY discovered_at DESC')
    .all(row.id);

  const report = db.prepare('SELECT id, title, created_at FROM reports WHERE assessment_id = ? LIMIT 1').get(row.id) || null;

  res.json({
    assessment: {
      ...row,
      require_tool_approval: row.require_tool_approval === 1,
      checks_performed: JSON.parse((row.checks_performed_json as string) || '[]'),
    },
    events,
    tasks,
    tool_logs: toolLogs,
    vulnerabilities,
    report,
  });
});

app.get('/api/assessments/:id/events', requireAuth, (req: AuthenticatedRequest, res) => {
  const exists = db.prepare('SELECT id FROM assessments WHERE id = ? AND organization_id = ?').get(req.params.id, req.auth!.orgId);
  if (!exists) {
    res.status(404).json({ error: 'Assessment not found.' });
    return;
  }
  const events = (
    db
      .prepare('SELECT * FROM assessment_events WHERE assessment_id = ? ORDER BY created_at ASC')
      .all(req.params.id) as Record<string, unknown>[]
  ).map((e) => ({
    ...e,
    details: e.details_json ? JSON.parse(e.details_json as string) : null,
  }));
  res.json(events);
});

app.post('/api/assessments/:id/start', requireAuth, requireRole(['Owner', 'Administrator', 'Security Analyst']), rateLimit(10, 60_000), (req: AuthenticatedRequest, res) => {
  const row = db
    .prepare(`
      SELECT a.*, t.verification_status
      FROM assessments a
      JOIN targets t ON t.id = a.target_id
      WHERE a.id = ? AND a.organization_id = ?
    `)
    .get(req.params.id, req.auth!.orgId) as { id: string; status: string; verification_status: string } | undefined;

  if (!row) {
    res.status(404).json({ error: 'Assessment not found.' });
    return;
  }
  if (row.verification_status !== 'Verified') {
    res.status(403).json({ error: 'Cannot start assessment on an unverified target.' });
    return;
  }
  if (row.status === 'Running' || row.status === 'Queued') {
    res.status(409).json({ error: 'Assessment is already active.' });
    return;
  }

  db.prepare("UPDATE assessments SET status = 'Queued' WHERE id = ?").run(row.id);
  launchAssessmentExecution({
    assessmentId: row.id,
    orgId: req.auth!.orgId,
    userId: req.auth!.userId,
    userEmail: req.auth!.email,
  });

  res.json({ ok: true, status: 'Queued' });
});

app.post('/api/assessments/:id/cancel', requireAuth, requireRole(['Owner', 'Administrator', 'Security Analyst']), (req: AuthenticatedRequest, res) => {
  const exists = db.prepare('SELECT id FROM assessments WHERE id = ? AND organization_id = ?').get(req.params.id, req.auth!.orgId);
  if (!exists) {
    res.status(404).json({ error: 'Assessment not found.' });
    return;
  }
  cancelActiveAssessment(req.params.id, req.auth!.userId, req.auth!.email, req.auth!.orgId);
  res.json({ ok: true, status: 'Cancelled' });
});

app.post('/api/tool-logs/:id/decision', requireAuth, requireRole(['Owner', 'Administrator', 'Security Analyst']), (req: AuthenticatedRequest, res) => {
  const { approved } = req.body as { approved?: boolean };
  if (typeof approved !== 'boolean') {
    res.status(400).json({ error: 'Boolean approved field is required.' });
    return;
  }

  const log = db.prepare('SELECT id, tool_name, assessment_id FROM tool_execution_logs WHERE id = ? AND organization_id = ?').get(req.params.id, req.auth!.orgId) as
    | { id: string; tool_name: string; assessment_id: string }
    | undefined;
  if (!log) {
    res.status(404).json({ error: 'Tool execution record not found.' });
    return;
  }

  const resolved = resolveToolApproval(log.id, approved, req.auth!.email);
  if (!resolved) {
    res.status(409).json({ error: 'Tool call is no longer awaiting approval.' });
    return;
  }

  writeAuditLog({
    orgId: req.auth!.orgId,
    userId: req.auth!.userId,
    userEmail: req.auth!.email,
    action: approved ? 'TOOL_CALL_APPROVED' : 'TOOL_CALL_REJECTED',
    resourceType: 'tool_execution_log',
    resourceId: log.id,
    details: { tool_name: log.tool_name, assessment_id: log.assessment_id },
  });

  res.json({ ok: true, decision: approved ? 'Approved' : 'Rejected' });
});

// ================= VULNERABILITIES =================
app.get('/api/vulnerabilities', requireAuth, (req: AuthenticatedRequest, res) => {
  const rows = db
    .prepare(`
      SELECT v.*, t.name as target_name, t.domain as target_domain
      FROM vulnerabilities v
      JOIN targets t ON t.id = v.target_id
      WHERE v.organization_id = ?
      ORDER BY v.discovered_at DESC
    `)
    .all(req.auth!.orgId);
  res.json(rows);
});

app.get('/api/vulnerabilities/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const vuln = db
    .prepare(`
      SELECT v.*, t.name as target_name, t.domain as target_domain
      FROM vulnerabilities v
      JOIN targets t ON t.id = v.target_id
      WHERE v.id = ? AND v.organization_id = ?
    `)
    .get(req.params.id, req.auth!.orgId);
  if (!vuln) {
    res.status(404).json({ error: 'Vulnerability not found.' });
    return;
  }
  const history = db
    .prepare('SELECT * FROM vulnerability_history WHERE vulnerability_id = ? ORDER BY created_at DESC')
    .all(req.params.id);
  res.json({ vulnerability: vuln, history });
});

app.patch('/api/vulnerabilities/:id/status', requireAuth, requireRole(['Owner', 'Administrator', 'Security Analyst']), (req: AuthenticatedRequest, res) => {
  const { validation_status, note } = req.body as { validation_status?: string; note?: string };
  const allowed = ['Open', 'Confirmed', 'False Positive', 'Accepted Risk', 'Resolved', 'Reopened'];
  if (!validation_status || !allowed.includes(validation_status)) {
    res.status(400).json({ error: 'Invalid validation status.' });
    return;
  }

  const existing = db.prepare('SELECT id, validation_status, title FROM vulnerabilities WHERE id = ? AND organization_id = ?').get(req.params.id, req.auth!.orgId) as
    | { id: string; validation_status: string; title: string }
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Vulnerability not found.' });
    return;
  }

  const now = new Date().toISOString();
  db.prepare('UPDATE vulnerabilities SET validation_status = ? WHERE id = ?').run(validation_status, existing.id);
  db.prepare(`
    INSERT INTO vulnerability_history (id, vulnerability_id, user_id, user_email, from_status, to_status, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(crypto.randomUUID(), existing.id, req.auth!.userId, req.auth!.email, existing.validation_status, validation_status, (note || '').trim(), now);

  writeAuditLog({
    orgId: req.auth!.orgId,
    userId: req.auth!.userId,
    userEmail: req.auth!.email,
    action: 'VULNERABILITY_STATUS_CHANGED',
    resourceType: 'vulnerability',
    resourceId: existing.id,
    details: { from: existing.validation_status, to: validation_status, note: (note || '').trim() },
  });

  const updated = db
    .prepare(`
      SELECT v.*, t.name as target_name, t.domain as target_domain
      FROM vulnerabilities v
      JOIN targets t ON t.id = v.target_id
      WHERE v.id = ?
    `)
    .get(existing.id);
  const history = db.prepare('SELECT * FROM vulnerability_history WHERE vulnerability_id = ? ORDER BY created_at DESC').all(existing.id);

  res.json({ vulnerability: updated, history });
});

// ================= REPORTS =================
app.get('/api/reports', requireAuth, (req: AuthenticatedRequest, res) => {
  const rows = (
    db
      .prepare(`
      SELECT r.*, t.name as target_name, t.domain as target_domain, a.profile as assessment_profile
      FROM reports r
      JOIN targets t ON t.id = r.target_id
      JOIN assessments a ON a.id = r.assessment_id
      WHERE r.organization_id = ?
      ORDER BY r.created_at DESC
    `)
      .all(req.auth!.orgId) as Record<string, unknown>[]
  ).map((r) => ({
    ...r,
    checks_performed: JSON.parse((r.checks_performed_json as string) || '[]'),
  }));
  res.json(rows);
});

app.post('/api/reports', requireAuth, requireRole(['Owner', 'Administrator', 'Security Analyst']), (req: AuthenticatedRequest, res) => {
  const { assessment_id } = req.body as { assessment_id?: string };
  if (!assessment_id) {
    res.status(400).json({ error: 'assessment_id is required.' });
    return;
  }

  const assessment = db
    .prepare(`
      SELECT a.*, t.name as target_name, t.domain as target_domain
      FROM assessments a
      JOIN targets t ON t.id = a.target_id
      WHERE a.id = ? AND a.organization_id = ?
    `)
    .get(assessment_id, req.auth!.orgId) as
    | { id: string; target_id: string; target_name: string; target_domain: string; profile: string; status: string; checks_performed_json: string }
    | undefined;
  if (!assessment) {
    res.status(404).json({ error: 'Assessment not found.' });
    return;
  }

  const existing = db.prepare('SELECT id FROM reports WHERE assessment_id = ? AND organization_id = ?').get(assessment.id, req.auth!.orgId) as
    | { id: string }
    | undefined;
  if (existing) {
    res.json({ id: existing.id });
    return;
  }

  const vulnCount = (db.prepare('SELECT COUNT(*) as c FROM vulnerabilities WHERE assessment_id = ?').get(assessment.id) as { c: number }).c;
  const checks = JSON.parse(assessment.checks_performed_json || '[]') as string[];
  const reportId = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO reports (id, organization_id, assessment_id, target_id, title, executive_summary, methodology, checks_performed_json, conclusion, generated_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    reportId,
    req.auth!.orgId,
    assessment.id,
    assessment.target_id,
    `${assessment.target_name} — ${assessment.profile} Report`,
    `Assessment of ${assessment.target_domain} executed ${checks.length} controlled security checks and recorded ${vulnCount} finding(s).`,
    'Checks executed within verified target scope under ARGUS Policy Engine governance.',
    JSON.stringify(checks),
    'Review findings ordered by severity and re-assess following remediation.',
    req.auth!.email,
    now
  );

  res.status(201).json({ id: reportId });
});

app.get('/api/reports/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const report = db
    .prepare(`
      SELECT r.*, t.name as target_name, t.domain as target_domain, a.profile as assessment_profile,
             sc.allowed_domains, sc.allowed_paths, sc.excluded_paths, sc.restrictions
      FROM reports r
      JOIN targets t ON t.id = r.target_id
      JOIN assessments a ON a.id = r.assessment_id
      LEFT JOIN target_scopes sc ON sc.target_id = t.id
      WHERE r.id = ? AND r.organization_id = ?
    `)
    .get(req.params.id, req.auth!.orgId) as Record<string, unknown> | undefined;
  if (!report) {
    res.status(404).json({ error: 'Report not found.' });
    return;
  }

  const findings = db
    .prepare('SELECT * FROM vulnerabilities WHERE assessment_id = ? AND organization_id = ? ORDER BY discovered_at ASC')
    .all(report.assessment_id, req.auth!.orgId);

  res.json({
    report: {
      ...report,
      checks_performed: JSON.parse((report.checks_performed_json as string) || '[]'),
      scope: {
        allowed_domains: report.allowed_domains ? JSON.parse(report.allowed_domains as string) : [],
        allowed_paths: report.allowed_paths ? JSON.parse(report.allowed_paths as string) : [],
        excluded_paths: report.excluded_paths ? JSON.parse(report.excluded_paths as string) : [],
        restrictions: report.restrictions || '',
      },
    },
    findings,
  });
});

// ================= ARGUS AGENT MONITOR & TOOL REGISTRY =================
app.get('/api/agent/monitor', requireAuth, (req: AuthenticatedRequest, res) => {
  const orgId = req.auth!.orgId;
  const gateway = getGatewayStatus(orgId);
  const activeAssessments = db
    .prepare(`
      SELECT a.*, t.name as target_name, t.domain as target_domain
      FROM assessments a
      JOIN targets t ON t.id = a.target_id
      WHERE a.organization_id = ? AND a.status IN ('Running', 'Queued')
      ORDER BY a.created_at DESC
    `)
    .all(orgId);

  const tasks = db
    .prepare('SELECT * FROM agent_tasks WHERE organization_id = ? ORDER BY created_at DESC LIMIT 25')
    .all(orgId);

  const toolLogs = (
    db
      .prepare('SELECT * FROM tool_execution_logs WHERE organization_id = ? ORDER BY created_at DESC LIMIT 30')
      .all(orgId) as Record<string, unknown>[]
  ).map((l) => ({
    ...l,
    arguments: JSON.parse((l.arguments_json as string) || '{}'),
    evidence: l.evidence_json ? JSON.parse(l.evidence_json as string) : null,
  }));

  const tools = (db.prepare('SELECT * FROM tool_registry ORDER BY category ASC, name ASC').all() as Record<string, unknown>[]).map((t) => ({
    ...t,
    allowed_profiles: JSON.parse((t.allowed_profiles_json as string) || '[]'),
    requires_approval: t.requires_approval === 1,
    enabled: t.enabled === 1,
  }));

  res.json({
    core_status: activeAssessments.length > 0 ? 'Processing' : 'Idle',
    gateway,
    active_assessments: activeAssessments,
    tasks,
    tool_logs: toolLogs,
    tools,
  });
});

app.patch('/api/tools/:id', requireAuth, requireRole(['Owner', 'Administrator']), (req: AuthenticatedRequest, res) => {
  const { enabled, requires_approval } = req.body as { enabled?: boolean; requires_approval?: boolean };
  const tool = db.prepare('SELECT * FROM tool_registry WHERE id = ?').get(req.params.id) as { id: string; name: string } | undefined;
  if (!tool) {
    res.status(404).json({ error: 'Tool not found.' });
    return;
  }
  if (typeof enabled === 'boolean') {
    db.prepare('UPDATE tool_registry SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, tool.id);
  }
  if (typeof requires_approval === 'boolean') {
    db.prepare('UPDATE tool_registry SET requires_approval = ? WHERE id = ?').run(requires_approval ? 1 : 0, tool.id);
  }
  writeAuditLog({
    orgId: req.auth!.orgId,
    userId: req.auth!.userId,
    userEmail: req.auth!.email,
    action: 'TOOL_REGISTRY_UPDATED',
    resourceType: 'tool',
    resourceId: tool.id,
    details: { name: tool.name, enabled, requires_approval },
  });
  res.json({ ok: true });
});

// ================= NOTIFICATIONS =================
app.get('/api/notifications', requireAuth, (req: AuthenticatedRequest, res) => {
  const rows = (
    db
      .prepare('SELECT * FROM notifications WHERE organization_id = ? ORDER BY created_at DESC LIMIT 50')
      .all(req.auth!.orgId) as Record<string, unknown>[]
  ).map((n) => ({ ...n, is_read: n.is_read === 1 }));
  res.json(rows);
});

app.post('/api/notifications/:id/read', requireAuth, (req: AuthenticatedRequest, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND organization_id = ?').run(req.params.id, req.auth!.orgId);
  res.json({ ok: true });
});

app.post('/api/notifications/read-all', requireAuth, (req: AuthenticatedRequest, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE organization_id = ?').run(req.auth!.orgId);
  res.json({ ok: true });
});

// ================= AI GATEWAY & USAGE (ADMIN-ONLY) =================
app.get('/api/ai-gateway/status', requireAuth, requireRole(['Owner', 'Administrator']), (req: AuthenticatedRequest, res) => {
  const status = getGatewayStatus(req.auth!.orgId);
  const assignments = db
    .prepare('SELECT * FROM ai_model_assignments WHERE organization_id = ?')
    .all(req.auth!.orgId);
  res.json({ status, assignments });
});

app.put('/api/ai-gateway/config', requireAuth, requireRole(['Owner', 'Administrator']), (req: AuthenticatedRequest, res) => {
  const { provider_mode, bifrost_base_url, bifrost_api_key, bifrost_virtual_key, default_model, fallback_models, request_timeout_ms } =
    req.body as {
      provider_mode?: 'gemini_server' | 'bifrost';
      bifrost_base_url?: string;
      bifrost_api_key?: string;
      bifrost_virtual_key?: string;
      default_model?: string;
      fallback_models?: string[];
      request_timeout_ms?: number;
    };

  if (provider_mode !== 'gemini_server' && provider_mode !== 'bifrost') {
    res.status(400).json({ error: 'Invalid provider_mode.' });
    return;
  }

  // Store sensitive keys strictly in server memory, never return them or store plaintext secrets in DB
  if (bifrost_api_key || bifrost_virtual_key) {
    setOrgGatewaySecrets(req.auth!.orgId, bifrost_api_key, bifrost_virtual_key);
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE ai_gateway_configs
    SET provider_mode = ?, bifrost_base_url = ?, default_model = ?, fallback_models_json = ?, request_timeout_ms = ?, updated_at = ?
    WHERE organization_id = ?
  `).run(
    provider_mode,
    (bifrost_base_url || '').trim(),
    (default_model || '').trim(),
    JSON.stringify(Array.isArray(fallback_models) ? fallback_models : []),
    Math.min(Math.max(Number(request_timeout_ms) || 30000, 3000), 120000),
    now,
    req.auth!.orgId
  );

  writeAuditLog({
    orgId: req.auth!.orgId,
    userId: req.auth!.userId,
    userEmail: req.auth!.email,
    action: 'AI_GATEWAY_CONFIG_UPDATED',
    resourceType: 'ai_gateway_config',
    resourceId: req.auth!.orgId,
    details: { provider_mode, bifrost_base_url: (bifrost_base_url || '').trim() },
  });

  res.json({ status: getGatewayStatus(req.auth!.orgId) });
});

app.put('/api/ai-gateway/assignments', requireAuth, requireRole(['Owner', 'Administrator']), (req: AuthenticatedRequest, res) => {
  const { assignments } = req.body as { assignments?: { agent_role: string; model_id: string }[] };
  if (!Array.isArray(assignments)) {
    res.status(400).json({ error: 'assignments array is required.' });
    return;
  }
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE ai_model_assignments SET model_id = ?, updated_at = ?
    WHERE organization_id = ? AND agent_role = ?
  `);
  for (const item of assignments) {
    stmt.run(item.model_id, now, req.auth!.orgId, item.agent_role);
  }

  writeAuditLog({
    orgId: req.auth!.orgId,
    userId: req.auth!.userId,
    userEmail: req.auth!.email,
    action: 'AI_MODEL_ASSIGNMENTS_UPDATED',
    resourceType: 'ai_model_assignments',
    resourceId: req.auth!.orgId,
    details: { assignments },
  });

  res.json({ assignments: db.prepare('SELECT * FROM ai_model_assignments WHERE organization_id = ?').all(req.auth!.orgId) });
});

app.post('/api/ai-gateway/test', requireAuth, requireRole(['Owner', 'Administrator']), async (req: AuthenticatedRequest, res) => {
  const result = await testGatewayConnection(req.auth!.orgId);
  writeAuditLog({
    orgId: req.auth!.orgId,
    userId: req.auth!.userId,
    userEmail: req.auth!.email,
    action: 'AI_GATEWAY_TESTED',
    resourceType: 'ai_gateway_config',
    resourceId: req.auth!.orgId,
    details: { status: result.status, message: result.message },
  });
  res.json(result);
});

app.get('/api/ai-gateway/models', requireAuth, requireRole(['Owner', 'Administrator']), (req: AuthenticatedRequest, res) => {
  const status = getGatewayStatus(req.auth!.orgId);
  res.json(status.available_models);
});

app.get('/api/ai-usage/summary', requireAuth, requireRole(['Owner', 'Administrator']), (req: AuthenticatedRequest, res) => {
  const orgId = req.auth!.orgId;
  const agg = db
    .prepare(`
      SELECT COUNT(*) as total_requests,
             SUM(CASE WHEN status = 'Success' THEN 1 ELSE 0 END) as successful_requests,
             SUM(CASE WHEN status = 'Failed' THEN 1 ELSE 0 END) as failed_requests,
             COALESCE(SUM(prompt_tokens), 0) as total_prompt_tokens,
             COALESCE(SUM(completion_tokens), 0) as total_completion_tokens,
             AVG(latency_ms) as avg_latency_ms,
             SUM(fallback_used) as fallback_events
      FROM ai_request_logs
      WHERE organization_id = ?
    `)
    .get(orgId) as {
    total_requests: number;
    successful_requests: number | null;
    failed_requests: number | null;
    total_prompt_tokens: number;
    total_completion_tokens: number;
    avg_latency_ms: number | null;
    fallback_events: number | null;
  };

  const byModel = db
    .prepare(`
      SELECT model, provider, COUNT(*) as count,
             COALESCE(SUM(prompt_tokens), 0) + COALESCE(SUM(completion_tokens), 0) as tokens
      FROM ai_request_logs
      WHERE organization_id = ?
      GROUP BY model, provider
    `)
    .all(orgId);

  res.json({
    total_requests: agg.total_requests || 0,
    successful_requests: agg.successful_requests || 0,
    failed_requests: agg.failed_requests || 0,
    total_prompt_tokens: agg.total_prompt_tokens || 0,
    total_completion_tokens: agg.total_completion_tokens || 0,
    avg_latency_ms: agg.avg_latency_ms !== null ? Math.round(agg.avg_latency_ms) : null,
    fallback_events: agg.fallback_events || 0,
    estimated_cost_usd: null, // Only populated when billing provider reports exact cost
    by_model: byModel,
  });
});

app.get('/api/ai-usage/logs', requireAuth, requireRole(['Owner', 'Administrator']), (req: AuthenticatedRequest, res) => {
  const rows = (
    db
      .prepare('SELECT * FROM ai_request_logs WHERE organization_id = ? ORDER BY created_at DESC LIMIT 50')
      .all(req.auth!.orgId) as Record<string, unknown>[]
  ).map((r) => ({ ...r, fallback_used: r.fallback_used === 1 }));
  res.json(rows);
});

// ================= SETTINGS, SECURITY, API KEYS & INTEGRATIONS =================
app.put('/api/settings/profile', requireAuth, (req: AuthenticatedRequest, res) => {
  const { full_name, job_title, organization_name, industry } = req.body as {
    full_name?: string;
    job_title?: string;
    organization_name?: string;
    industry?: string;
  };
  if (full_name) {
    db.prepare('UPDATE profiles SET full_name = ?, job_title = ? WHERE id = ?').run(
      full_name.trim(),
      (job_title || '').trim(),
      req.auth!.userId
    );
  }
  if (organization_name && (req.auth!.role === 'Owner' || req.auth!.role === 'Administrator')) {
    db.prepare('UPDATE organizations SET name = ?, industry = ? WHERE id = ?').run(
      organization_name.trim(),
      (industry || '').trim(),
      req.auth!.orgId
    );
  }
  writeAuditLog({
    orgId: req.auth!.orgId,
    userId: req.auth!.userId,
    userEmail: req.auth!.email,
    action: 'PROFILE_UPDATED',
    resourceType: 'profile',
    resourceId: req.auth!.userId,
  });
  res.json(buildSessionResponse(req.auth!.userId, req.auth!.orgId));
});

app.get('/api/settings/audit-logs', requireAuth, (req: AuthenticatedRequest, res) => {
  const rows = (
    db
      .prepare('SELECT * FROM audit_logs WHERE organization_id = ? ORDER BY created_at DESC LIMIT 100')
      .all(req.auth!.orgId) as Record<string, unknown>[]
  ).map((r) => ({
    ...r,
    details: r.details_json ? JSON.parse(r.details_json as string) : null,
  }));
  res.json(rows);
});

app.get('/api/settings/api-keys', requireAuth, (req: AuthenticatedRequest, res) => {
  const rows = db
    .prepare('SELECT id, name, key_prefix, created_by, last_used_at, created_at FROM api_keys WHERE organization_id = ? ORDER BY created_at DESC')
    .all(req.auth!.orgId);
  res.json(rows);
});

app.post('/api/settings/api-keys', requireAuth, requireRole(['Owner', 'Administrator']), (req: AuthenticatedRequest, res) => {
  const { name } = req.body as { name?: string };
  if (!name?.trim()) {
    res.status(400).json({ error: 'API key label is required.' });
    return;
  }
  const rawSecret = `argus_live_${crypto.randomBytes(24).toString('hex')}`;
  const prefix = rawSecret.slice(0, 18);
  const hash = crypto.createHash('sha256').update(rawSecret).digest('hex');
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO api_keys (id, organization_id, name, key_prefix, key_hash, created_by, last_used_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, NULL, ?)
  `).run(id, req.auth!.orgId, name.trim(), prefix, hash, req.auth!.email, now);

  writeAuditLog({
    orgId: req.auth!.orgId,
    userId: req.auth!.userId,
    userEmail: req.auth!.email,
    action: 'API_KEY_CREATED',
    resourceType: 'api_key',
    resourceId: id,
    details: { name: name.trim(), prefix },
  });

  // Return secret once at creation time only
  res.status(201).json({
    id,
    name: name.trim(),
    key_prefix: prefix,
    plaintext_key_once: rawSecret,
    created_by: req.auth!.email,
    created_at: now,
  });
});

app.delete('/api/settings/api-keys/:id', requireAuth, requireRole(['Owner', 'Administrator']), (req: AuthenticatedRequest, res) => {
  db.prepare('DELETE FROM api_keys WHERE id = ? AND organization_id = ?').run(req.params.id, req.auth!.orgId);
  writeAuditLog({
    orgId: req.auth!.orgId,
    userId: req.auth!.userId,
    userEmail: req.auth!.email,
    action: 'API_KEY_REVOKED',
    resourceType: 'api_key',
    resourceId: req.params.id,
  });
  res.json({ ok: true });
});

app.get('/api/settings/integrations', requireAuth, (req: AuthenticatedRequest, res) => {
  const rows = (
    db
      .prepare('SELECT * FROM integrations WHERE organization_id = ? ORDER BY provider ASC')
      .all(req.auth!.orgId) as Record<string, unknown>[]
  ).map((r) => ({
    ...r,
    config: JSON.parse((r.config_json as string) || '{}'),
  }));
  res.json(rows);
});

app.put('/api/settings/integrations/:provider', requireAuth, requireRole(['Owner', 'Administrator']), (req: AuthenticatedRequest, res) => {
  const provider = req.params.provider;
  if (!['github', 'slack', 'email', 'webhook'].includes(provider)) {
    res.status(400).json({ error: 'Unsupported integration provider.' });
    return;
  }
  const { endpoint, channel, connect } = req.body as { endpoint?: string; channel?: string; connect?: boolean };
  const now = new Date().toISOString();

  if (connect === false) {
    db.prepare(`
      UPDATE integrations SET status = 'Disconnected', config_json = '{}', updated_at = ?
      WHERE organization_id = ? AND provider = ?
    `).run(now, req.auth!.orgId, provider);
    res.json({ ok: true, status: 'Disconnected' });
    return;
  }

  if (!endpoint?.trim() && !channel?.trim()) {
    res.status(400).json({ error: 'Configuration endpoint or target channel is required before connecting.' });
    return;
  }

  const sanitizedConfig: Record<string, string> = {};
  if (endpoint) sanitizedConfig.endpoint = endpoint.trim();
  if (channel) sanitizedConfig.channel = channel.trim();

  db.prepare(`
    UPDATE integrations SET status = 'Connected', config_json = ?, updated_at = ?
    WHERE organization_id = ? AND provider = ?
  `).run(JSON.stringify(sanitizedConfig), now, req.auth!.orgId, provider);

  writeAuditLog({
    orgId: req.auth!.orgId,
    userId: req.auth!.userId,
    userEmail: req.auth!.email,
    action: 'INTEGRATION_UPDATED',
    resourceType: 'integration',
    resourceId: provider,
  });

  res.json({ ok: true, status: 'Connected' });
});

// ================= VITE / STATIC SERVER =================
async function startServer() {
  const PORT = 3000;
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ARGUS platform server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start ARGUS server:', err);
  process.exit(1);
});
