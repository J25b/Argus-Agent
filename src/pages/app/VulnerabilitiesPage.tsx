import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, Check, Copy, Eye, Search } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { SlideDrawer } from '../../components/MotionPrimitives';
import { SemanticStatusText, SeverityLabel } from '../../components/StatusText';
import { useAuth } from '../../context/AuthContext';
import type { Vulnerability } from '../../types/argus';

export const VulnerabilitiesPage: React.FC = () => {
  const { apiFetch } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSev = searchParams.get('severity') || 'All';

  const [vulns, setVulns] = useState<Vulnerability[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sevFilter, setSevFilter] = useState(initialSev);
  const [inspected, setInspected] = useState<Vulnerability | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const paramSev = searchParams.get('severity');
    if (paramSev) setSevFilter(paramSev);
  }, [searchParams]);

  useEffect(() => {
    setLoading(true);
    apiFetch<Vulnerability[]>('/api/vulnerabilities')
      .then(setVulns)
      .finally(() => setLoading(false));
  }, [apiFetch]);

  const severities = ['All', 'Critical', 'High', 'Medium', 'Low', 'Informational'];
  const filtered = vulns.filter((v) => {
    const matchSev = sevFilter === 'All' || v.severity === sevFilter;
    const q = search.toLowerCase();
    const matchText =
      !q ||
      v.title.toLowerCase().includes(q) ||
      v.endpoint.toLowerCase().includes(q) ||
      v.category.toLowerCase().includes(q) ||
      (v.target_domain || '').toLowerCase().includes(q);
    return matchSev && matchText;
  });

  const handleSelectFilter = (sev: string) => {
    setSevFilter(sev);
    if (sev === 'All') {
      searchParams.delete('severity');
      setSearchParams(searchParams, { replace: true });
    } else {
      setSearchParams({ severity: sev }, { replace: true });
    }
  };

  const handleCopyEvidence = () => {
    if (!inspected) return;
    navigator.clipboard.writeText(inspected.evidence);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <AppShell breadcrumb="Vulnerabilities">
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="relative max-w-sm w-full">
            <Search className="w-4 h-4 text-[#8796AB] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, endpoint, target, category..."
              className="w-full pl-9 pr-3.5 py-2 text-sm bg-[#0E182E] border border-[#1E3354] rounded-md text-[#F4F7FC] placeholder-[#8796AB] focus:outline-none focus:border-[#2388E8]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1 p-1 bg-[#0E182E] border border-[#1E3354] rounded-md w-fit">
            {severities.map((sev) => (
              <button
                key={sev}
                type="button"
                onClick={() => handleSelectFilter(sev)}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                  sevFilter === sev ? 'bg-[#142A49] text-[#F4F7FC]' : 'text-[#8796AB] hover:text-[#F4F7FC]'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>

        <div className="border border-[#1E3354] bg-[#0E182E] rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-8 text-sm text-[#8796AB]">Loading findings...</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <p className="text-sm font-medium text-[#F4F7FC]">No vulnerabilities recorded</p>
              <p className="text-xs text-[#8796AB]">
                Findings discovered by completed assessments will appear here with raw evidence and CVSS context.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#1E3354] text-xs font-medium text-[#8796AB]">
                    <th className="py-3 px-5">Finding</th>
                    <th className="py-3 px-5">Severity</th>
                    <th className="py-3 px-5">Target</th>
                    <th className="py-3 px-5">Category</th>
                    <th className="py-3 px-5">Confidence</th>
                    <th className="py-3 px-5">Status</th>
                    <th className="py-3 px-5">Discovered</th>
                    <th className="py-3 px-5 text-right">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E3354] text-sm">
                  {filtered.map((v) => (
                    <tr key={v.id} className="hover:bg-[#142A49]/35 transition-colors">
                      <td className="py-3.5 px-5 max-w-md">
                        <Link to={`/app/vulnerabilities/${v.id}`} className="font-medium text-[#F4F7FC] hover:text-[#65B9FF] block truncate">
                          {v.title}
                        </Link>
                        <span className="font-mono text-xs text-[#8796AB] block truncate">{v.endpoint}</span>
                      </td>
                      <td className="py-3.5 px-5">
                        <SeverityLabel severity={v.severity} />
                      </td>
                      <td className="py-3.5 px-5 font-mono text-xs text-[#65B9FF]">
                        {v.target_domain || v.target_name}
                      </td>
                      <td className="py-3.5 px-5 text-xs text-[#8796AB]">{v.category}</td>
                      <td className="py-3.5 px-5 text-xs text-[#F4F7FC]">{v.confidence}</td>
                      <td className="py-3.5 px-5">
                        <SemanticStatusText status={v.validation_status} />
                      </td>
                      <td className="py-3.5 px-5 font-mono text-xs text-[#8796AB] tabular-nums">
                        {new Date(v.discovered_at).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <button
                          type="button"
                          onClick={() => setInspected(v)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#65B9FF] border border-[#1E3354] hover:border-[#65B9FF] rounded transition-colors whitespace-nowrap"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Preview</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Quick-Inspect Finding Drawer */}
      <SlideDrawer
        open={Boolean(inspected)}
        onClose={() => setInspected(null)}
        title={inspected?.title || 'Finding Preview'}
        subtitle={inspected ? `${inspected.endpoint} · ${inspected.category}` : undefined}
      >
        {inspected && (
          <div className="space-y-5 text-xs">
            <div className="grid grid-cols-3 gap-3 border border-[#1E3354] bg-[#0A1020] rounded-md p-3.5">
              <div className="space-y-1">
                <p className="text-[#8796AB]">Severity</p>
                <SeverityLabel severity={inspected.severity} />
              </div>
              <div className="space-y-1">
                <p className="text-[#8796AB]">Confidence</p>
                <p className="font-medium text-[#F4F7FC]">{inspected.confidence}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[#8796AB]">Status</p>
                <SemanticStatusText status={inspected.validation_status} />
              </div>
            </div>

            {inspected.cvss_score !== null && (
              <div className="space-y-1">
                <p className="text-[#8796AB]">{inspected.cvss_version || 'CVSS'}</p>
                <p className="font-mono text-[#F4F7FC]">
                  {inspected.cvss_score.toFixed(1)} · {inspected.cvss_vector}
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <p className="font-display text-sm font-semibold text-[#F4F7FC]">Description</p>
              <p className="text-[#8796AB] leading-relaxed">{inspected.description}</p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="font-display text-sm font-semibold text-[#F4F7FC]">Raw Evidence</p>
                <button
                  type="button"
                  onClick={handleCopyEvidence}
                  className="inline-flex items-center gap-1 text-[#65B9FF] hover:underline"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-[#16B887]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="p-3.5 bg-[#0A1020] border border-[#1E3354] rounded font-mono text-[11px] text-[#65B9FF] overflow-x-auto whitespace-pre-wrap">
                {inspected.evidence}
              </pre>
            </div>

            <div className="space-y-1.5">
              <p className="font-display text-sm font-semibold text-[#F4F7FC]">Remediation</p>
              <p className="text-[#16B887] leading-relaxed">{inspected.remediation}</p>
            </div>

            <div className="pt-3 border-t border-[#1E3354]">
              <Link
                to={`/app/vulnerabilities/${inspected.id}`}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#F4F7FC] bg-[#2388E8] hover:bg-[#1C74CA] rounded-md"
              >
                <span>Open Full Triage &amp; Audit History</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}
      </SlideDrawer>
    </AppShell>
  );
};
