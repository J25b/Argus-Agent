import { GoogleGenAI, Type } from '@google/genai';
import crypto from 'node:crypto';
import { db } from './db.ts';
import type { AgentRole, AiGatewayStatus } from '../src/types/argus.ts';

interface ServerSecrets {
  bifrostApiKey: string;
  bifrostVirtualKey: string;
}

// Secrets remain strictly in server memory / process.env, never exposed to browser or client queries
const runtimeSecretsByOrg = new Map<string, ServerSecrets>();

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function getOrgSecrets(orgId: string): ServerSecrets {
  const mem = runtimeSecretsByOrg.get(orgId);
  return {
    bifrostApiKey: mem?.bifrostApiKey || process.env.BIFROST_API_KEY || '',
    bifrostVirtualKey: mem?.bifrostVirtualKey || process.env.BIFROST_VIRTUAL_KEY || '',
  };
}

export function setOrgGatewaySecrets(orgId: string, apiKey?: string, virtualKey?: string): void {
  const existing = getOrgSecrets(orgId);
  runtimeSecretsByOrg.set(orgId, {
    bifrostApiKey: apiKey !== undefined && apiKey.trim() !== '' ? apiKey.trim() : existing.bifrostApiKey,
    bifrostVirtualKey: virtualKey !== undefined && virtualKey.trim() !== '' ? virtualKey.trim() : existing.bifrostVirtualKey,
  });
}

export function getGatewayStatus(orgId: string): AiGatewayStatus {
  const row = db.prepare('SELECT * FROM ai_gateway_configs WHERE organization_id = ?').get(orgId) as
    | {
        provider_mode: 'gemini_server' | 'bifrost';
        bifrost_base_url: string;
        default_model: string;
        fallback_models_json: string;
        request_timeout_ms: number;
        connection_status: AiGatewayStatus['connection_status'];
        last_checked_at: string | null;
        last_check_message: string | null;
      }
    | undefined;

  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY');
  const secrets = getOrgSecrets(orgId);
  const envBifrostUrl = process.env.BIFROST_BASE_URL || '';

  const providerMode = row?.provider_mode || 'gemini_server';
  const bifrostBaseUrl = row?.bifrost_base_url || envBifrostUrl;
  const availableModels: { id: string; provider: string; label: string }[] = [];

  if (geminiConfigured) {
    availableModels.push({
      id: 'gemini-4-hydrogen',
      provider: 'Google Gemini (Server-Side)',
      label: 'gemini-4-hydrogen',
    });
  }

  let status: AiGatewayStatus['connection_status'] = row?.connection_status || 'Not Configured';
  if (providerMode === 'gemini_server') {
    status = geminiConfigured ? 'Connected' : 'Not Configured';
  }

  return {
    provider_mode: providerMode,
    bifrost_base_url: bifrostBaseUrl,
    has_bifrost_api_key: Boolean(secrets.bifrostApiKey),
    has_bifrost_virtual_key: Boolean(secrets.bifrostVirtualKey),
    gemini_server_configured: geminiConfigured,
    default_model: row?.default_model || (geminiConfigured ? 'gemini-4-hydrogen' : ''),
    fallback_models: row ? (JSON.parse(row.fallback_models_json) as string[]) : [],
    request_timeout_ms: row?.request_timeout_ms || 30000,
    connection_status: status,
    last_checked_at: row?.last_checked_at || null,
    last_check_message: row?.last_check_message || null,
    available_models: availableModels,
  };
}

export async function testGatewayConnection(orgId: string): Promise<{
  status: AiGatewayStatus['connection_status'];
  message: string;
  models: { id: string; provider: string; label: string }[];
  checked_at: string;
}> {
  const current = getGatewayStatus(orgId);
  const now = new Date().toISOString();

  if (current.provider_mode === 'bifrost') {
    if (!current.bifrost_base_url) {
      const msg = 'Bifrost base URL is not configured.';
      db.prepare(`
        UPDATE ai_gateway_configs SET connection_status = 'Not Configured', last_checked_at = ?, last_check_message = ?, updated_at = ?
        WHERE organization_id = ?
      `).run(now, msg, now, orgId);
      return { status: 'Not Configured', message: msg, models: [], checked_at: now };
    }

    const secrets = getOrgSecrets(orgId);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.min(current.request_timeout_ms, 10000));
    try {
      const cleanBase = current.bifrost_base_url.replace(/\/+$/, '');
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (secrets.bifrostApiKey) headers['Authorization'] = `Bearer ${secrets.bifrostApiKey}`;
      if (secrets.bifrostVirtualKey) headers['x-bf-vk'] = secrets.bifrostVirtualKey;

      const resp = await fetch(`${cleanBase}/v1/models`, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      if (!resp.ok) {
        const msg = `Bifrost gateway returned HTTP ${resp.status} ${resp.statusText}.`;
        db.prepare(`
          UPDATE ai_gateway_configs SET connection_status = 'Unavailable', last_checked_at = ?, last_check_message = ?, updated_at = ?
          WHERE organization_id = ?
        `).run(now, msg, now, orgId);
        return { status: 'Unavailable', message: msg, models: [], checked_at: now };
      }

      const data = (await resp.json()) as { data?: { id: string; owned_by?: string }[] };
      const models = Array.isArray(data?.data)
        ? data.data.map((m) => ({ id: m.id, provider: m.owned_by || 'Bifrost', label: m.id }))
        : [];
      const msg = `Connected to Bifrost gateway (${models.length} model${models.length === 1 ? '' : 's'} reported).`;
      db.prepare(`
        UPDATE ai_gateway_configs SET connection_status = 'Connected', last_checked_at = ?, last_check_message = ?, updated_at = ?
        WHERE organization_id = ?
      `).run(now, msg, now, orgId);
      return { status: 'Connected', message: msg, models, checked_at: now };
    } catch (err) {
      const msg = `Bifrost connection check failed: ${err instanceof Error ? err.message : 'Network error'}`;
      db.prepare(`
        UPDATE ai_gateway_configs SET connection_status = 'Unavailable', last_checked_at = ?, last_check_message = ?, updated_at = ?
        WHERE organization_id = ?
      `).run(now, msg, now, orgId);
      return { status: 'Unavailable', message: msg, models: [], checked_at: now };
    } finally {
      clearTimeout(timeout);
    }
  }

  // Server-side Gemini check
  const ai = getGeminiClient();
  if (!ai) {
    const msg = 'GEMINI_API_KEY is not configured on the server.';
    db.prepare(`
      UPDATE ai_gateway_configs SET connection_status = 'Not Configured', last_checked_at = ?, last_check_message = ?, updated_at = ?
      WHERE organization_id = ?
    `).run(now, msg, now, orgId);
    return { status: 'Not Configured', message: msg, models: [], checked_at: now };
  }

  const start = Date.now();
  try {
    const resp = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: 'Reply with OK.',
    });
    const latency = Date.now() - start;
    const text = (resp.text || '').trim();
    const msg = `Server-side Gemini engine connected (gemini-4-hydrogen responded in ${latency}ms: "${text.slice(0, 20)}").`;
    db.prepare(`
      UPDATE ai_gateway_configs SET connection_status = 'Connected', last_checked_at = ?, last_check_message = ?, updated_at = ?
      WHERE organization_id = ?
    `).run(now, msg, now, orgId);
    return {
      status: 'Connected',
      message: msg,
      models: [{ id: 'gemini-4-hydrogen', provider: 'Google Gemini (Server-Side)', label: 'gemini-4-hydrogen' }],
      checked_at: now,
    };
  } catch (err) {
    const msg = `Server-side Gemini health check failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
    db.prepare(`
      UPDATE ai_gateway_configs SET connection_status = 'Unavailable', last_checked_at = ?, last_check_message = ?, updated_at = ?
      WHERE organization_id = ?
    `).run(now, msg, now, orgId);
    return { status: 'Unavailable', message: msg, models: [], checked_at: now };
  }
}

export async function invokeAgentModel(params: {
  orgId: string;
  assessmentId: string;
  agentRole: AgentRole;
  systemInstruction: string;
  prompt: string;
  jsonSchema?: Record<string, unknown>;
}): Promise<{ ok: boolean; text?: string; error?: string; model?: string; latencyMs?: number }> {
  const gateway = getGatewayStatus(params.orgId);
  const assignment = db
    .prepare('SELECT model_id FROM ai_model_assignments WHERE organization_id = ? AND agent_role = ?')
    .get(params.orgId, params.agentRole) as { model_id: string } | undefined;

  const assignedModel =
    assignment?.model_id && assignment.model_id !== 'unassigned'
      ? assignment.model_id
      : gateway.default_model || 'gemini-4-hydrogen';

  const start = Date.now();

  if (gateway.provider_mode === 'bifrost') {
    if (!gateway.bifrost_base_url) {
      return { ok: false, error: 'Bifrost gateway is not configured.' };
    }
    const secrets = getOrgSecrets(params.orgId);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), gateway.request_timeout_ms);
    try {
      const cleanBase = gateway.bifrost_base_url.replace(/\/+$/, '');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (secrets.bifrostApiKey) headers['Authorization'] = `Bearer ${secrets.bifrostApiKey}`;
      if (secrets.bifrostVirtualKey) headers['x-bf-vk'] = secrets.bifrostVirtualKey;

      const resp = await fetch(`${cleanBase}/v1/chat/completions`, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          model: assignedModel,
          messages: [
            { role: 'system', content: params.systemInstruction },
            { role: 'user', content: params.prompt },
          ],
          response_format: params.jsonSchema ? { type: 'json_object' } : undefined,
        }),
      });
      const latencyMs = Date.now() - start;
      if (!resp.ok) {
        const errText = await resp.text();
        logAiRequest(params.orgId, params.assessmentId, params.agentRole, 'Bifrost', assignedModel, 'Failed', null, null, latencyMs, false, errText.slice(0, 300));
        return { ok: false, error: `Bifrost returned HTTP ${resp.status}`, model: assignedModel, latencyMs };
      }
      const data = (await resp.json()) as {
        choices?: { message?: { content?: string } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const text = data?.choices?.[0]?.message?.content || '';
      logAiRequest(
        params.orgId,
        params.assessmentId,
        params.agentRole,
        'Bifrost',
        assignedModel,
        'Success',
        data?.usage?.prompt_tokens ?? null,
        data?.usage?.completion_tokens ?? null,
        latencyMs,
        false,
        null
      );
      return { ok: true, text, model: assignedModel, latencyMs };
    } catch (err) {
      const latencyMs = Date.now() - start;
      const errMsg = err instanceof Error ? err.message : 'Bifrost request error';
      logAiRequest(params.orgId, params.assessmentId, params.agentRole, 'Bifrost', assignedModel, 'Failed', null, null, latencyMs, false, errMsg);
      return { ok: false, error: errMsg, model: assignedModel, latencyMs };
    } finally {
      clearTimeout(timeout);
    }
  }

  // Server-side Gemini path
  const ai = getGeminiClient();
  if (!ai) {
    return { ok: false, error: 'AI gateway unavailable: GEMINI_API_KEY not configured on server.' };
  }

  const modelToUse = 'gemini-4-hydrogen';
  try {
    const response = await ai.models.generateContent({
      model: modelToUse,
      contents: params.prompt,
      config: {
        systemInstruction: params.systemInstruction,
        ...(params.jsonSchema
          ? {
              responseMimeType: 'application/json',
              responseSchema: params.jsonSchema as { type: Type },
            }
          : {}),
      },
    });
    const latencyMs = Date.now() - start;
    const promptTokens = response.usageMetadata?.promptTokenCount ?? null;
    const completionTokens = response.usageMetadata?.candidatesTokenCount ?? null;

    logAiRequest(
      params.orgId,
      params.assessmentId,
      params.agentRole,
      'Google Gemini',
      modelToUse,
      'Success',
      promptTokens,
      completionTokens,
      latencyMs,
      false,
      null
    );

    return { ok: true, text: response.text || '', model: modelToUse, latencyMs };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const errMsg = err instanceof Error ? err.message : 'Gemini request failed';
    logAiRequest(params.orgId, params.assessmentId, params.agentRole, 'Google Gemini', modelToUse, 'Failed', null, null, latencyMs, false, errMsg);
    return { ok: false, error: errMsg, model: modelToUse, latencyMs };
  }
}

function logAiRequest(
  orgId: string,
  assessmentId: string,
  agentRole: string,
  provider: string,
  model: string,
  status: 'Success' | 'Failed',
  promptTokens: number | null,
  completionTokens: number | null,
  latencyMs: number | null,
  fallbackUsed: boolean,
  errorMessage: string | null
): void {
  db.prepare(`
    INSERT INTO ai_request_logs (id, organization_id, assessment_id, agent_role, provider, model, status, prompt_tokens, completion_tokens, latency_ms, fallback_used, error_message, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    orgId,
    assessmentId,
    agentRole,
    provider,
    model,
    status,
    promptTokens,
    completionTokens,
    latencyMs,
    fallbackUsed ? 1 : 0,
    errorMessage,
    new Date().toISOString()
  );
}
