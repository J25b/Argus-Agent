import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check, Copy, Play, ShieldCheck } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { SemanticStatusText, SeverityLabel } from '../../components/StatusText';
import { useAuth } from '../../context/AuthContext';
import type { Assessment, AuthorizationRecord, Target, Vulnerability } from '../../types/argus';

interface TargetDetailResponse {
  target: Target;
  authorization_history: AuthorizationRecord[];
  assessments: Assessment[];
  vulnerabilities: Vulnerability[];
}

export const TargetDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { apiFetch, organization } = useAuth();
  const [data, setData] = useState<TargetDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [verifyMethod, setVerifyMethod] = useState<'dns_txt' | 'http_file'>('dns_txt');
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ verified: boolean; evidence: string; error: string | null } | null>(null);
  const [copied, setCopied] = useState(false);

  // Scope form state
  const [allowedDomains, setAllowedDomains] = useState('');
  const [allowedPaths, setAllowedPaths] = useState('');
  const [excludedPaths, setExcludedPaths] = useState('');
  const [restrictions, setRestrictions] = useState('');
  const [scopeSaved, setScopeSaved] = useState<string | null>(null);
  const [scopeError, setScopeError] = useState<string | null>(null);

  const canMutate = organization?.role !== 'Viewer';

  const loadDetail = useCallback(() => {
    if (!id) return;
    setLoading(true);
    apiFetch<TargetDetailResponse>(`/api/targets/${id}`)
      .then((res) => {
        setData(res);
        if (res.target.scope) {
          setAllowedDomains(res.target.scope.allowed_domains.join(', '));
          setAllowedPaths(res.target.scope.allowed_paths.join(', '));
          setExcludedPaths(res.target.scope.excluded_paths.join(', '));
          setRestrictions(res.target.scope.restrictions);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load target.'))
      .finally(() => setLoading(false));
  }, [apiFetch, id]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const handleCopyToken = () => {
    if (!data?.target.verification_token) return;
    navigator.clipboard.writeText(data.target.verification_token);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleVerify = async () => {
    if (!id) return;
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await apiFetch<{ verified: boolean; evidence: string; error: string | null; target: Target }>(
        `/api/targets/${id}/verify`,
        {
          method: 'POST',
          body: JSON.stringify({ method: verifyMethod }),
        }
      );
      setVerifyResult({ verified: res.verified, evidence: res.evidence, error: res.error });
      loadDetail();
    } catch (err) {
      setVerifyResult({
        verified: false,
        evidence: '',
        error: err instanceof Error ? err.message : 'Verification request failed.',
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleSaveScope = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setScopeSaved(null);
    setScopeError(null);
    try {
      await apiFetch(`/api/targets/${id}/scope`, {
        method: 'PUT',
        body: JSON.stringify({
          allowed_domains: allowedDomains.split(',').map((s) => s.trim()).filter(Boolean),
          allowed_paths: allowedPaths.split(',').map((s) => s.trim()).filter(Boolean),
          excluded_paths: excludedPaths.split(',').map((s) => s.trim()).filter(Boolean),
          permitted_methods: data?.target.scope?.permitted_methods || [],
          restrictions,
        }),
      });
      setScopeSaved('Scope boundaries updated and audit-logged.');
      loadDetail();
    } catch (err) {
      setScopeError(err instanceof Error ? err.message : 'Unable to update scope.');
    }
  };

  return (
    <AppShell
      breadcrumb={data ? `Targets / ${data.target.name}` : 'Targets / Detail'}
      action={
        data?.target.verification_status === 'Verified' && canMutate ? (
          <Link
            to={`/app/assessments/new?targetId=${data.target.id}`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#F4F7FC] bg-[#2388E8] hover:bg-[#1C74CA] rounded-md whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Assess Target</span>
          </Link>
        ) : undefined
      }
    >
      {loading && <div className="text-sm text-[#8796AB]">Loading target configuration...</div>}
      {error && (
        <div role="alert" className="border border-[#E45B68]/50 bg-[#E45B68]/10 text-[#E45B68] text-sm rounded-lg p-4">
          {error}
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Header summary */}
          <div className="border border-[#1E3354] bg-[#0E182E] rounded-lg p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-display text-xl font-bold text-[#F4F7FC]">{data.target.name}</h1>
                <SemanticStatusText status={data.target.verification_status} />
              </div>
              <p className="text-xs font-mono text-[#65B9FF]">
                {data.target.domain} · {data.target.target_type}
              </p>
              {data.target.description && (
                <p className="text-sm text-[#8796AB] pt-1">{data.target.description}</p>
              )}
            </div>
            <div className="text-xs text-[#8796AB] space-y-1 font-mono">
              <p>Created: {new Date(data.target.created_at).toLocaleDateString()}</p>
              <p>
                Verified:{' '}
                {data.target.verified_at ? new Date(data.target.verified_at).toLocaleString() : 'Not verified'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Ownership Verification Panel */}
            <div className="border border-[#1E3354] bg-[#0E182E] rounded-lg p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-semibold text-[#F4F7FC] flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#65B9FF]" />
                  <span>Ownership Verification</span>
                </h2>
                <SemanticStatusText status={data.target.verification_status} />
              </div>

              <div className="flex items-center gap-1 p-1 bg-[#0A1020] border border-[#1E3354] rounded-md w-fit">
                <button
                  type="button"
                  onClick={() => setVerifyMethod('dns_txt')}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                    verifyMethod === 'dns_txt' ? 'bg-[#142A49] text-[#F4F7FC]' : 'text-[#8796AB] hover:text-[#F4F7FC]'
                  }`}
                >
                  DNS TXT Record
                </button>
                <button
                  type="button"
                  onClick={() => setVerifyMethod('http_file')}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                    verifyMethod === 'http_file' ? 'bg-[#142A49] text-[#F4F7FC]' : 'text-[#8796AB] hover:text-[#F4F7FC]'
                  }`}
                >
                  HTTPS Verification File
                </button>
              </div>

              {verifyMethod === 'dns_txt' ? (
                <div className="space-y-3 text-xs text-[#8796AB]">
                  <p>Publish a DNS TXT record on either <code className="text-[#F4F7FC]">_argus-verify.{data.target.domain}</code> or the apex domain <code className="text-[#F4F7FC]">{data.target.domain}</code> containing:</p>
                  <div className="flex items-center justify-between gap-2 bg-[#0A1020] border border-[#1E3354] rounded-md px-3.5 py-2.5 font-mono text-[#65B9FF]">
                    <span className="truncate">{data.target.verification_token}</span>
                    <button
                      type="button"
                      onClick={handleCopyToken}
                      className="text-xs text-[#8796AB] hover:text-[#F4F7FC] inline-flex items-center gap-1 shrink-0"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-[#16B887]" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 text-xs text-[#8796AB]">
                  <p>Host a plain-text file returning HTTP 200 (no redirects) at:</p>
                  <p className="font-mono text-[#F4F7FC] bg-[#0A1020] border border-[#1E3354] rounded px-3 py-2 break-all">
                    https://{data.target.domain}/.well-known/argus-verification.txt
                  </p>
                  <div className="flex items-center justify-between gap-2 bg-[#0A1020] border border-[#1E3354] rounded-md px-3.5 py-2.5 font-mono text-[#65B9FF]">
                    <span className="truncate">{data.target.verification_token}</span>
                    <button
                      type="button"
                      onClick={handleCopyToken}
                      className="text-xs text-[#8796AB] hover:text-[#F4F7FC] inline-flex items-center gap-1 shrink-0"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-[#16B887]" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
              )}

              {verifyResult && (
                <div
                  className={`border rounded-md p-3.5 text-xs space-y-1 ${
                    verifyResult.verified
                      ? 'border-[#16B887]/50 bg-[#16B887]/10 text-[#16B887]'
                      : 'border-[#E45B68]/50 bg-[#E45B68]/10 text-[#E45B68]'
                  }`}
                >
                  <p className="font-semibold">
                    {verifyResult.verified ? 'Ownership Verified' : 'Verification Failed'}
                  </p>
                  <p>{verifyResult.error || verifyResult.evidence}</p>
                </div>
              )}

              {canMutate && (
                <button
                  type="button"
                  disabled={verifying}
                  onClick={handleVerify}
                  className="px-4 py-2 text-xs font-semibold text-[#F4F7FC] bg-[#2388E8] hover:bg-[#1C74CA] disabled:opacity-50 rounded-md"
                >
                  {verifying ? 'Performing live lookup...' : 'Verify Ownership Now'}
                </button>
              )}
            </div>

            {/* Scope Management Panel */}
            <form onSubmit={handleSaveScope} className="border border-[#1E3354] bg-[#0E182E] rounded-lg p-6 space-y-4">
              <h2 className="font-display text-base font-semibold text-[#F4F7FC]">Scope Management</h2>

              {scopeError && (
                <div role="alert" className="border border-[#E45B68]/50 bg-[#E45B68]/10 text-[#E45B68] text-xs rounded-md p-3">
                  {scopeError}
                </div>
              )}
              {scopeSaved && (
                <div className="border border-[#16B887]/50 bg-[#16B887]/10 text-[#16B887] text-xs rounded-md p-3">
                  {scopeSaved}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#F4F7FC]">Allowed Domains (comma-separated)</label>
                <input
                  type="text"
                  disabled={!canMutate}
                  value={allowedDomains}
                  onChange={(e) => setAllowedDomains(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-[#0A1020] border border-[#1E3354] rounded-md text-[#F4F7FC] disabled:opacity-60"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[#F4F7FC]">Allowed Paths</label>
                  <input
                    type="text"
                    disabled={!canMutate}
                    value={allowedPaths}
                    onChange={(e) => setAllowedPaths(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-[#0A1020] border border-[#1E3354] rounded-md text-[#F4F7FC] disabled:opacity-60"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-[#F4F7FC]">Excluded Paths</label>
                  <input
                    type="text"
                    disabled={!canMutate}
                    value={excludedPaths}
                    onChange={(e) => setExcludedPaths(e.target.value)}
                    placeholder="/admin, /logout"
                    className="w-full px-3 py-2 text-xs font-mono bg-[#0A1020] border border-[#1E3354] rounded-md text-[#F4F7FC] disabled:opacity-60"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-[#F4F7FC]">Explicit Restrictions</label>
                <textarea
                  rows={2}
                  disabled={!canMutate}
                  value={restrictions}
                  onChange={(e) => setRestrictions(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-[#0A1020] border border-[#1E3354] rounded-md text-[#F4F7FC] disabled:opacity-60"
                />
              </div>

              {canMutate && (
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-[#F4F7FC] border border-[#2388E8] hover:bg-[#2388E8]/15 rounded-md"
                >
                  Save Scope Boundaries
                </button>
              )}
            </form>
          </div>

          {/* Authorization History, Assessments & Findings */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="border border-[#1E3354] bg-[#0E182E] rounded-lg overflow-hidden">
              <div className="px-5 py-4 border-b border-[#1E3354]">
                <h2 className="font-display text-sm font-semibold text-[#F4F7FC]">Authorization &amp; Verification History</h2>
              </div>
              {data.authorization_history.length === 0 ? (
                <div className="p-5 text-xs text-[#8796AB]">No verification checks attempted yet.</div>
              ) : (
                <div className="divide-y divide-[#1E3354]">
                  {data.authorization_history.map((rec) => (
                    <div key={rec.id} className="p-4 space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[#65B9FF]">{rec.method}</span>
                        <SemanticStatusText status={rec.status} />
                      </div>
                      <p className="text-[#8796AB]">{rec.evidence}</p>
                      <p className="font-mono text-[11px] text-[#8796AB]/80">
                        {rec.user_email} · {new Date(rec.created_at).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border border-[#1E3354] bg-[#0E182E] rounded-lg overflow-hidden">
              <div className="px-5 py-4 border-b border-[#1E3354]">
                <h2 className="font-display text-sm font-semibold text-[#F4F7FC]">
                  Related Findings ({data.vulnerabilities.length})
                </h2>
              </div>
              {data.vulnerabilities.length === 0 ? (
                <div className="p-5 text-xs text-[#8796AB]">No findings recorded for this target.</div>
              ) : (
                <div className="divide-y divide-[#1E3354]">
                  {data.vulnerabilities.map((v) => (
                    <Link
                      key={v.id}
                      to={`/app/vulnerabilities/${v.id}`}
                      className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-[#142A49]/40"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-[#F4F7FC] truncate">{v.title}</p>
                        <p className="text-[11px] font-mono text-[#8796AB] truncate">{v.endpoint}</p>
                      </div>
                      <SeverityLabel severity={v.severity} />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
};
