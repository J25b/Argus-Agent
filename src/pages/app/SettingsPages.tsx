import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { KeyRound, RefreshCw, ShieldAlert, Trash2 } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { SemanticStatusText } from '../../components/StatusText';
import { useAuth } from '../../context/AuthContext';
import type {
  AgentRole,
  AiGatewayStatus,
  AiModelAssignment,
  AiRequestLogItem,
  AiUsageSummary,
  ApiKeyItem,
  AuditLogItem,
  IntegrationItem,
  Organization,
  UserProfile,
} from '../../types/argus';

const SettingsNav: React.FC = () => {
  const location = useLocation();
  const { organization } = useAuth();
  const isAdmin = organization?.role === 'Owner' || organization?.role === 'Administrator';

  const tabs = [
    { label: 'Profile & Organization', to: '/app/settings/profile' },
    { label: 'Security & Audit Log', to: '/app/settings/security' },
    { label: 'Integrations', to: '/app/settings/integrations' },
    ...(isAdmin ? [{ label: 'AI Gateway & Usage', to: '/app/settings/ai-gateway' }] : []),
  ];

  return (
    <div className="flex flex-wrap items-center gap-1 p-1 bg-[#0E182E] border border-[#1E3354] rounded-md w-fit mb-6">
      {tabs.map((t) => {
        const active = location.pathname === t.to;
        return (
          <Link
            key={t.to}
            to={t.to}
            className={`px-3.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
              active ? 'bg-[#142A49] text-[#F4F7FC]' : 'text-[#8796AB] hover:text-[#F4F7FC]'
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
};

export const ProfileSettingsPage: React.FC = () => {
  const { user, organization, apiFetch, setSession } = useAuth();
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [jobTitle, setJobTitle] = useState(user?.job_title || '');
  const [orgName, setOrgName] = useState(organization?.name || '');
  const [industry, setIndustry] = useState(organization?.industry || '');
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = organization?.role === 'Owner' || organization?.role === 'Administrator';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(null);
    setError(null);
    try {
      const res = await apiFetch<{ token: string; user: UserProfile; organization: Organization }>(
        '/api/settings/profile',
        {
          method: 'PUT',
          body: JSON.stringify({
            full_name: fullName,
            job_title: jobTitle,
            organization_name: orgName,
            industry,
          }),
        }
      );
      setSession(res);
      setSaved('Profile settings saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save profile.');
    }
  };

  return (
    <AppShell breadcrumb="Settings / Profile & Organization">
      <SettingsNav />
      <form onSubmit={handleSave} className="max-w-2xl border border-[#1E3354] bg-[#0E182E] rounded-lg p-6 space-y-5">
        <h1 className="font-display text-lg font-semibold text-[#F4F7FC]">Profile &amp; Organization</h1>
        {saved && <div className="border border-[#16B887]/50 bg-[#16B887]/10 text-[#16B887] text-xs rounded p-3">{saved}</div>}
        {error && <div className="border border-[#E45B68]/50 bg-[#E45B68]/10 text-[#E45B68] text-xs rounded p-3">{error}</div>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[#F4F7FC]">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-[#0A1020] border border-[#1E3354] rounded-md text-[#F4F7FC]"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[#F4F7FC]">Job Title</label>
            <input
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-[#0A1020] border border-[#1E3354] rounded-md text-[#F4F7FC]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#1E3354]">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[#F4F7FC]">Organization Name</label>
            <input
              type="text"
              disabled={!isAdmin}
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-[#0A1020] border border-[#1E3354] rounded-md text-[#F4F7FC] disabled:opacity-60"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-[#F4F7FC]">Industry</label>
            <input
              type="text"
              disabled={!isAdmin}
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-[#0A1020] border border-[#1E3354] rounded-md text-[#F4F7FC] disabled:opacity-60"
            />
          </div>
        </div>

        <button type="submit" className="px-5 py-2 text-xs font-semibold text-[#F4F7FC] bg-[#2388E8] hover:bg-[#1C74CA] rounded-md">
          Save Changes
        </button>
      </form>
    </AppShell>
  );
};

export const SecuritySettingsPage: React.FC = () => {
  const { apiFetch, organization } = useAuth();
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [keyName, setKeyName] = useState('');
  const [newKeyOnce, setNewKeyOnce] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = organization?.role === 'Owner' || organization?.role === 'Administrator';

  const loadData = useCallback(() => {
    apiFetch<ApiKeyItem[]>('/api/settings/api-keys').then(setKeys).catch(() => {});
    apiFetch<AuditLogItem[]>('/api/settings/audit-logs').then(setAuditLogs).catch(() => {});
  }, [apiFetch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNewKeyOnce(null);
    try {
      const created = await apiFetch<{ plaintext_key_once: string }>('/api/settings/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name: keyName }),
      });
      setNewKeyOnce(created.plaintext_key_once);
      setKeyName('');
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create API key.');
    }
  };

  const handleRevoke = async (id: string) => {
    await apiFetch(`/api/settings/api-keys/${id}`, { method: 'DELETE' });
    loadData();
  };

  return (
    <AppShell breadcrumb="Settings / Security & Audit Log">
      <SettingsNav />
      <div className="space-y-6">
        <div className="border border-[#1E3354] bg-[#0E182E] rounded-lg p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h1 className="font-display text-lg font-semibold text-[#F4F7FC] flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-[#65B9FF]" />
                <span>API Access Management</span>
              </h1>
              <p className="text-xs text-[#8796AB]">
                API keys are hashed on the server with SHA-256. Secret values are displayed once at creation and never retrievable afterwards.
              </p>
            </div>
          </div>

          {error && <div className="border border-[#E45B68]/50 bg-[#E45B68]/10 text-[#E45B68] text-xs rounded p-3">{error}</div>}
          {newKeyOnce && (
            <div className="border border-[#16B887]/50 bg-[#16B887]/10 rounded p-4 space-y-1.5">
              <p className="text-xs font-semibold text-[#16B887]">Copy your new API key now — it will not be shown again:</p>
              <p className="font-mono text-xs text-[#F4F7FC] break-all">{newKeyOnce}</p>
            </div>
          )}

          {isAdmin && (
            <form onSubmit={handleCreateKey} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                required
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                placeholder="CI/CD Pipeline Key"
                className="flex-1 max-w-sm px-3.5 py-2 text-sm bg-[#0A1020] border border-[#1E3354] rounded-md text-[#F4F7FC]"
              />
              <button type="submit" className="px-4 py-2 text-xs font-semibold text-[#F4F7FC] bg-[#2388E8] hover:bg-[#1C74CA] rounded-md whitespace-nowrap">
                Generate API Key
              </button>
            </form>
          )}

          <div className="divide-y divide-[#1E3354] border-t border-[#1E3354]">
            {keys.length === 0 ? (
              <p className="py-4 text-xs text-[#8796AB]">No API keys created.</p>
            ) : (
              keys.map((k) => (
                <div key={k.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                  <div>
                    <p className="font-medium text-[#F4F7FC]">{k.name}</p>
                    <p className="font-mono text-[#8796AB]">
                      {k.key_prefix}•••••••• · Created by {k.created_by} · {new Date(k.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => handleRevoke(k.id)}
                      className="inline-flex items-center gap-1 text-[#E45B68] hover:underline"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Revoke
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="border border-[#1E3354] bg-[#0E182E] rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-[#1E3354]">
            <h2 className="font-display text-base font-semibold text-[#F4F7FC]">Immutable Organization Audit Log</h2>
          </div>
          <div className="divide-y divide-[#1E3354] max-h-96 overflow-y-auto">
            {auditLogs.map((log) => (
              <div key={log.id} className="px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="space-y-0.5">
                  <p className="font-mono text-[#65B9FF]">{log.action}</p>
                  <p className="text-[#8796AB]">
                    {log.resource_type} ({log.resource_id.slice(0, 12)}) · {log.user_email}
                  </p>
                </div>
                <span className="font-mono text-[#8796AB] tabular-nums">{new Date(log.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export const IntegrationsSettingsPage: React.FC = () => {
  const { apiFetch, organization } = useAuth();
  const [items, setItems] = useState<IntegrationItem[]>([]);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isAdmin = organization?.role === 'Owner' || organization?.role === 'Administrator';

  const load = useCallback(() => {
    apiFetch<IntegrationItem[]>('/api/settings/integrations').then((rows) => {
      setItems(rows);
      const map: Record<string, string> = {};
      for (const r of rows) map[r.provider] = r.config.endpoint || r.config.channel || '';
      setInputs(map);
    });
  }, [apiFetch]);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggle = async (item: IntegrationItem, connect: boolean) => {
    setMsg(null);
    setError(null);
    try {
      await apiFetch(`/api/settings/integrations/${item.provider}`, {
        method: 'PUT',
        body: JSON.stringify({ endpoint: inputs[item.provider] || '', connect }),
      });
      setMsg(`${item.provider} updated.`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update integration.');
    }
  };

  return (
    <AppShell breadcrumb="Settings / Integrations">
      <SettingsNav />
      <div className="space-y-4">
        {msg && <div className="border border-[#16B887]/50 bg-[#16B887]/10 text-[#16B887] text-xs rounded p-3">{msg}</div>}
        {error && <div className="border border-[#E45B68]/50 bg-[#E45B68]/10 text-[#E45B68] text-xs rounded p-3">{error}</div>}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {items.map((item) => (
            <div key={item.id} className="border border-[#1E3354] bg-[#0E182E] rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-semibold text-[#F4F7FC] capitalize">{item.provider}</h2>
                <SemanticStatusText status={item.status} />
              </div>
              <input
                type="text"
                disabled={!isAdmin}
                value={inputs[item.provider] || ''}
                onChange={(e) => setInputs((prev) => ({ ...prev, [item.provider]: e.target.value }))}
                placeholder={`Enter ${item.provider} webhook or target endpoint...`}
                className="w-full px-3 py-2 text-xs font-mono bg-[#0A1020] border border-[#1E3354] rounded-md text-[#F4F7FC] disabled:opacity-60"
              />
              {isAdmin && (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleToggle(item, true)}
                    className="px-3.5 py-1.5 text-xs font-semibold text-[#F4F7FC] bg-[#2388E8] hover:bg-[#1C74CA] rounded"
                  >
                    Connect
                  </button>
                  {item.status === 'Connected' && (
                    <button
                      type="button"
                      onClick={() => handleToggle(item, false)}
                      className="px-3.5 py-1.5 text-xs text-[#E45B68] border border-[#E45B68]/50 rounded"
                    >
                      Disconnect
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
};

export const AiGatewayAdminPage: React.FC = () => {
  const { apiFetch, organization } = useAuth();
  const isAdmin = organization?.role === 'Owner' || organization?.role === 'Administrator';

  const [status, setStatus] = useState<AiGatewayStatus | null>(null);
  const [assignments, setAssignments] = useState<AiModelAssignment[]>([]);
  const [usage, setUsage] = useState<AiUsageSummary | null>(null);
  const [logs, setLogs] = useState<AiRequestLogItem[]>([]);

  const [providerMode, setProviderMode] = useState<'gemini_server' | 'bifrost'>('gemini_server');
  const [bifrostUrl, setBifrostUrl] = useState('');
  const [bifrostApiKey, setBifrostApiKey] = useState('');
  const [bifrostVirtualKey, setBifrostVirtualKey] = useState('');
  const [defaultModel, setDefaultModel] = useState('');
  const [timeoutMs, setTimeoutMs] = useState(30000);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(() => {
    if (!isAdmin) return;
    apiFetch<{ status: AiGatewayStatus; assignments: AiModelAssignment[] }>('/api/ai-gateway/status')
      .then((res) => {
        setStatus(res.status);
        setAssignments(res.assignments);
        setProviderMode(res.status.provider_mode);
        setBifrostUrl(res.status.bifrost_base_url);
        setDefaultModel(res.status.default_model);
        setTimeoutMs(res.status.request_timeout_ms);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load gateway config.'));

    apiFetch<AiUsageSummary>('/api/ai-usage/summary').then(setUsage).catch(() => {});
    apiFetch<AiRequestLogItem[]>('/api/ai-usage/logs').then(setLogs).catch(() => {});
  }, [apiFetch, isAdmin]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  if (!isAdmin) {
    return (
      <AppShell breadcrumb="Settings / AI Gateway (Restricted)">
        <div className="border border-[#E45B68]/50 bg-[#0E182E] rounded-lg p-8 max-w-xl space-y-3">
          <div className="flex items-center gap-2 text-[#E45B68]">
            <ShieldAlert className="w-5 h-5" />
            <h1 className="font-display text-lg font-semibold">Administrator Access Required</h1>
          </div>
          <p className="text-sm text-[#8796AB]">
            AI Gateway configuration, Bifrost routing, and usage observability are restricted to Organization Owners and Administrators. Your current role is <span className="font-mono text-[#F4F7FC]">{organization?.role}</span>.
          </p>
        </div>
      </AppShell>
    );
  }

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setTestResult(null);
    try {
      await apiFetch('/api/ai-gateway/config', {
        method: 'PUT',
        body: JSON.stringify({
          provider_mode: providerMode,
          bifrost_base_url: bifrostUrl,
          bifrost_api_key: bifrostApiKey || undefined,
          bifrost_virtual_key: bifrostVirtualKey || undefined,
          default_model: defaultModel,
          request_timeout_ms: timeoutMs,
        }),
      });
      setBifrostApiKey('');
      setBifrostVirtualKey('');
      setTestResult('Gateway configuration saved and audit-logged.');
      loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save config.');
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setError(null);
    setTestResult(null);
    try {
      const res = await apiFetch<{ status: string; message: string; checked_at: string }>('/api/ai-gateway/test', {
        method: 'POST',
      });
      setTestResult(`${res.status}: ${res.message}`);
      loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection test failed.');
    } finally {
      setTesting(false);
    }
  };

  const handleAssignmentChange = async (role: AgentRole, modelId: string) => {
    const updated = assignments.map((a) => (a.agent_role === role ? { ...a, model_id: modelId } : a));
    setAssignments(updated);
    await apiFetch('/api/ai-gateway/assignments', {
      method: 'PUT',
      body: JSON.stringify({ assignments: updated.map((a) => ({ agent_role: a.agent_role, model_id: a.model_id })) }),
    });
  };

  return (
    <AppShell breadcrumb="Settings / AI Gateway Administration">
      <SettingsNav />
      <div className="space-y-6">
        {error && <div role="alert" className="border border-[#E45B68]/50 bg-[#E45B68]/10 text-[#E45B68] text-xs rounded p-3.5">{error}</div>}
        {testResult && <div className="border border-[#65B9FF]/50 bg-[#65B9FF]/10 text-[#F4F7FC] text-xs rounded p-3.5 font-mono">{testResult}</div>}

        {/* Status Summary */}
        {status && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="border border-[#1E3354] bg-[#0E182E] rounded-lg p-5 space-y-1.5">
              <p className="text-xs text-[#8796AB]">Connection Status</p>
              <SemanticStatusText status={status.connection_status} />
              <p className="text-[11px] font-mono text-[#8796AB]">
                Mode: {status.provider_mode === 'bifrost' ? 'Bifrost Gateway' : 'Server-Side Gemini'}
              </p>
            </div>
            <div className="border border-[#1E3354] bg-[#0E182E] rounded-lg p-5 space-y-1.5">
              <p className="text-xs text-[#8796AB]">Last Health Check</p>
              <p className="font-mono text-xs text-[#F4F7FC]">
                {status.last_checked_at ? new Date(status.last_checked_at).toLocaleString() : 'Never tested'}
              </p>
              <p className="text-[11px] text-[#8796AB] truncate">{status.last_check_message || '—'}</p>
            </div>
            <div className="border border-[#1E3354] bg-[#0E182E] rounded-lg p-5 space-y-1.5">
              <p className="text-xs text-[#8796AB]">Total AI Requests</p>
              <p className="font-display text-2xl font-bold text-[#F4F7FC] tabular-nums">{usage?.total_requests ?? 0}</p>
              <p className="text-xs text-[#16B887] tabular-nums">
                {usage?.successful_requests ?? 0} succeeded · {usage?.failed_requests ?? 0} failed
              </p>
            </div>
            <div className="border border-[#1E3354] bg-[#0E182E] rounded-lg p-5 space-y-1.5">
              <p className="text-xs text-[#8796AB]">Tokens &amp; Latency</p>
              <p className="font-display text-2xl font-bold text-[#F4F7FC] tabular-nums">
                {((usage?.total_prompt_tokens || 0) + (usage?.total_completion_tokens || 0)).toLocaleString()}
              </p>
              <p className="text-xs text-[#8796AB] tabular-nums">
                Avg latency: {usage?.avg_latency_ms !== null && usage?.avg_latency_ms !== undefined ? `${usage.avg_latency_ms}ms` : 'Unavailable'} · Cost: Unavailable
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gateway Configuration Form */}
          <form onSubmit={handleSaveConfig} className="border border-[#1E3354] bg-[#0E182E] rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-[#F4F7FC]">Gateway Configuration</h2>
              <button
                type="button"
                disabled={testing}
                onClick={handleTestConnection}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#65B9FF] border border-[#1E3354] hover:border-[#65B9FF] rounded-md"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
                <span>{testing ? 'Testing...' : 'Test Connection'}</span>
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[#F4F7FC]">Gateway Provider Mode</label>
              <select
                value={providerMode}
                onChange={(e) => setProviderMode(e.target.value as 'gemini_server' | 'bifrost')}
                className="w-full px-3 py-2 text-xs bg-[#0A1020] border border-[#1E3354] rounded-md text-[#F4F7FC]"
              >
                <option value="gemini_server">Server-Side Gemini Engine (@google/genai)</option>
                <option value="bifrost">Bifrost by Maxim AI Gateway (OpenAI-Compatible)</option>
              </select>
            </div>

            {providerMode === 'bifrost' && (
              <>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[#F4F7FC]">BIFROST_BASE_URL</label>
                  <input
                    type="url"
                    value={bifrostUrl}
                    onChange={(e) => setBifrostUrl(e.target.value)}
                    placeholder="https://bifrost.internal.company.com"
                    className="w-full px-3 py-2 text-xs font-mono bg-[#0A1020] border border-[#1E3354] rounded-md text-[#F4F7FC]"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-[#F4F7FC]">
                      BIFROST_API_KEY ({status?.has_bifrost_api_key ? 'Stored on server' : 'Not set'})
                    </label>
                    <input
                      type="password"
                      value={bifrostApiKey}
                      onChange={(e) => setBifrostApiKey(e.target.value)}
                      placeholder="Write-only server secret"
                      className="w-full px-3 py-2 text-xs font-mono bg-[#0A1020] border border-[#1E3354] rounded-md text-[#F4F7FC]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-medium text-[#F4F7FC]">
                      BIFROST_VIRTUAL_KEY ({status?.has_bifrost_virtual_key ? 'Stored on server' : 'Not set'})
                    </label>
                    <input
                      type="password"
                      value={bifrostVirtualKey}
                      onChange={(e) => setBifrostVirtualKey(e.target.value)}
                      placeholder="Write-only virtual key"
                      className="w-full px-3 py-2 text-xs font-mono bg-[#0A1020] border border-[#1E3354] rounded-md text-[#F4F7FC]"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#F4F7FC]">Default Model</label>
                <input
                  type="text"
                  value={defaultModel}
                  onChange={(e) => setDefaultModel(e.target.value)}
                  placeholder="gemini-4-hydrogen"
                  className="w-full px-3 py-2 text-xs font-mono bg-[#0A1020] border border-[#1E3354] rounded-md text-[#F4F7FC]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#F4F7FC]">Request Timeout (ms)</label>
                <input
                  type="number"
                  min={3000}
                  max={120000}
                  value={timeoutMs}
                  onChange={(e) => setTimeoutMs(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-mono bg-[#0A1020] border border-[#1E3354] rounded-md text-[#F4F7FC]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold text-[#F4F7FC] bg-[#2388E8] hover:bg-[#1C74CA] rounded-md"
            >
              {saving ? 'Saving...' : 'Save Gateway Configuration'}
            </button>
          </form>

          {/* Agent Role Model Assignments */}
          <div className="border border-[#1E3354] bg-[#0E182E] rounded-lg p-6 space-y-4">
            <h2 className="font-display text-base font-semibold text-[#F4F7FC]">ARGUS Agent Model Assignments</h2>
            <p className="text-xs text-[#8796AB]">
              Assign configured models from the verified catalog to each logical ARGUS application role.
            </p>
            <div className="space-y-3">
              {assignments.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-4 border border-[#1E3354] bg-[#0A1020] rounded-md px-4 py-2.5">
                  <span className="font-mono text-xs text-[#65B9FF]">{a.agent_role}</span>
                  <select
                    value={a.model_id}
                    onChange={(e) => handleAssignmentChange(a.agent_role, e.target.value)}
                    className="px-2.5 py-1.5 text-xs font-mono bg-[#0E182E] border border-[#1E3354] rounded text-[#F4F7FC]"
                  >
                    <option value="unassigned">Unassigned</option>
                    {status?.available_models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent AI Request Logs */}
        <div className="border border-[#1E3354] bg-[#0E182E] rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-[#1E3354]">
            <h2 className="font-display text-sm font-semibold text-[#F4F7FC]">Recent AI Request Logs</h2>
          </div>
          {logs.length === 0 ? (
            <div className="p-6 text-xs text-[#8796AB]">No AI requests executed yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#1E3354] text-[#8796AB]">
                    <th className="py-3 px-5">Agent Role</th>
                    <th className="py-3 px-5">Provider / Model</th>
                    <th className="py-3 px-5">Status</th>
                    <th className="py-3 px-5">Tokens</th>
                    <th className="py-3 px-5">Latency</th>
                    <th className="py-3 px-5">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E3354]">
                  {logs.map((l) => (
                    <tr key={l.id}>
                      <td className="py-3 px-5 font-mono text-[#65B9FF]">{l.agent_role}</td>
                      <td className="py-3 px-5 font-mono text-[#F4F7FC]">{l.provider} · {l.model}</td>
                      <td className="py-3 px-5"><SemanticStatusText status={l.status} /></td>
                      <td className="py-3 px-5 font-mono tabular-nums text-[#8796AB]">
                        {l.prompt_tokens !== null ? `${l.prompt_tokens} in / ${l.completion_tokens ?? 0} out` : 'Unavailable'}
                      </td>
                      <td className="py-3 px-5 font-mono tabular-nums text-[#8796AB]">
                        {l.latency_ms !== null ? `${l.latency_ms}ms` : '—'}
                      </td>
                      <td className="py-3 px-5 font-mono tabular-nums text-[#8796AB]">
                        {new Date(l.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
};
