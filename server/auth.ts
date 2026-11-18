import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { db } from './db.ts';
import type { OrgRole } from '../src/types/argus.ts';

const EPHEMERAL_SECRET = crypto.randomBytes(32).toString('hex');

function getSessionSecret(): string {
  return process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16
    ? process.env.SESSION_SECRET
    : EPHEMERAL_SECRET;
}

export interface SessionPayload {
  userId: string;
  orgId: string;
  email: string;
  exp: number;
}

export interface AuthenticatedRequest extends Request {
  auth?: {
    userId: string;
    orgId: string;
    email: string;
    role: OrgRole;
    isDemo: boolean;
  };
}

export function signSessionToken(payload: Omit<SessionPayload, 'exp'>): string {
  const fullPayload: SessionPayload = {
    ...payload,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
  };
  const data = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const sig = crypto.createHmac('sha256', getSessionSecret()).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', getSessionSecret()).update(data).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as SessionPayload;
    if (!parsed.userId || !parsed.orgId || !parsed.exp || Date.now() > parsed.exp) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (!token) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  const payload = verifySessionToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
    return;
  }

  const membership = db.prepare(`
    SELECT m.role, o.is_demo, p.email
    FROM organization_members m
    JOIN organizations o ON o.id = m.organization_id
    JOIN profiles p ON p.id = m.user_id
    WHERE m.user_id = ? AND m.organization_id = ?
  `).get(payload.userId, payload.orgId) as { role: OrgRole; is_demo: number; email: string } | undefined;

  if (!membership) {
    res.status(403).json({ error: 'Organization membership not found or access revoked.' });
    return;
  }

  req.auth = {
    userId: payload.userId,
    orgId: payload.orgId,
    email: membership.email,
    role: membership.role,
    isDemo: membership.is_demo === 1,
  };
  next();
}

export function requireRole(allowedRoles: OrgRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (!allowedRoles.includes(req.auth.role)) {
      res.status(403).json({
        error: `Permission denied. Required role: ${allowedRoles.join(' or ')}. Your role: ${req.auth.role}.`,
      });
      return;
    }
    next();
  };
}

export function writeAuditLog(params: {
  orgId: string;
  userId: string;
  userEmail: string;
  action: string;
  resourceType: string;
  resourceId: string;
  details?: Record<string, unknown>;
}): void {
  db.prepare(`
    INSERT INTO audit_logs (id, organization_id, user_id, user_email, action, resource_type, resource_id, details_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    params.orgId,
    params.userId,
    params.userEmail,
    params.action,
    params.resourceType,
    params.resourceId,
    params.details ? JSON.stringify(params.details) : null,
    new Date().toISOString()
  );
}
