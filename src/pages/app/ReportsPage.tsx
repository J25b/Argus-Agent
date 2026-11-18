import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Download, FileText } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { SeverityLabel } from '../../components/StatusText';
import { useAuth } from '../../context/AuthContext';
import { downloadAssessmentPdf } from '../../utils/pdfReport';
import type { ReportRecord, Vulnerability } from '../../types/argus';

export const ReportsPage: React.FC = () => {
  const { apiFetch } = useAuth();
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch<ReportRecord[]>('/api/reports')
      .then(setReports)
      .finally(() => setLoading(false));
  }, [apiFetch]);

  return (
    <AppShell breadcrumb="Reports">
      <div className="border border-[#1E3354] bg-[#0E182E] rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-sm text-[#8796AB]">Loading reports...</div>
        ) : reports.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <p className="text-sm font-medium text-[#F4F7FC]">No assessment reports generated yet</p>
            <p className="text-xs text-[#8796AB]">
              Reports are automatically compiled from actual stored findings and checks performed when an assessment completes.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#1E3354]">
            {reports.map((r) => (
              <div key={r.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#142A49]/35">
                <div className="space-y-1">
                  <Link to={`/app/reports/${r.id}`} className="font-display text-sm font-semibold text-[#F4F7FC] hover:text-[#65B9FF]">
                    {r.title}
                  </Link>
                  <p className="text-xs text-[#8796AB]">
                    <span className="font-mono text-[#65B9FF]">{r.target_domain}</span> · {r.assessment_profile} · {r.checks_performed.length} checks · {new Date(r.created_at).toLocaleString()}
                  </p>
                </div>
                <Link
                  to={`/app/reports/${r.id}`}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#F4F7FC] border border-[#1E3354] hover:border-[#65B9FF] rounded-md whitespace-nowrap shrink-0"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Open Report</span>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
};

interface ReportDetailResponse {
  report: ReportRecord & {
    scope?: {
      allowed_domains: string[];
      allowed_paths: string[];
      excluded_paths: string[];
      restrictions: string;
    };
  };
  findings: Vulnerability[];
}

export const ReportDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { apiFetch, organization } = useAuth();
  const [data, setData] = useState<ReportDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiFetch<ReportDetailResponse>(`/api/reports/${id}`)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load report.'))
      .finally(() => setLoading(false));
  }, [apiFetch, id]);

  const handleDownload = () => {
    if (!data) return;
    downloadAssessmentPdf({
      report: data.report,
      findings: data.findings,
      organizationName: organization?.name || 'Organization',
      isDemo: Boolean(organization?.is_demo),
    });
  };

  return (
    <AppShell
      breadcrumb={data ? `Reports / ${data.report.target_domain}` : 'Reports / Viewer'}
      action={
        data ? (
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#F4F7FC] bg-[#2388E8] hover:bg-[#1C74CA] rounded-md whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download PDF</span>
          </button>
        ) : undefined
      }
    >
      {loading && <div className="text-sm text-[#8796AB]">Loading report...</div>}
      {error && (
        <div role="alert" className="border border-[#E45B68]/50 bg-[#E45B68]/10 text-[#E45B68] text-sm rounded-lg p-4">
          {error}
        </div>
      )}

      {data && (
        <div className="max-w-4xl mx-auto border border-[#1E3354] bg-[#0E182E] rounded-lg p-8 space-y-8">
          <div className="border-b border-[#1E3354] pb-6 space-y-2">
            <p className="text-xs font-mono text-[#65B9FF]">ARGUS SECURITY ASSESSMENT REPORT</p>
            <h1 className="font-display text-2xl font-bold text-[#F4F7FC]">{data.report.title}</h1>
            <p className="text-xs font-mono text-[#8796AB]">
              Report ID: {data.report.id} · Assessment ID: {data.report.assessment_id} · Generated {new Date(data.report.created_at).toUTCString()}
            </p>
          </div>

          <section className="space-y-2">
            <h2 className="font-display text-base font-semibold text-[#F4F7FC]">Executive Summary</h2>
            <p className="text-sm text-[#8796AB] leading-relaxed">{data.report.executive_summary}</p>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-base font-semibold text-[#F4F7FC]">Target &amp; Approved Scope</h2>
            <p className="text-sm text-[#8796AB]">{data.report.methodology}</p>
            {data.report.scope && (
              <div className="border border-[#1E3354] bg-[#0A1020] rounded-md p-4 text-xs space-y-1.5 font-mono text-[#8796AB]">
                <p>Allowed Domains: <span className="text-[#F4F7FC]">{data.report.scope.allowed_domains.join(', ')}</span></p>
                <p>Allowed Paths: <span className="text-[#F4F7FC]">{data.report.scope.allowed_paths.join(', ')}</span></p>
                <p>Excluded Paths: <span className="text-[#F4F7FC]">{data.report.scope.excluded_paths.join(', ') || 'None'}</span></p>
              </div>
            )}
          </section>

          <section className="space-y-2">
            <h2 className="font-display text-base font-semibold text-[#F4F7FC]">Checks Actually Performed</h2>
            {data.report.checks_performed.length === 0 ? (
              <p className="text-sm text-[#8796AB]">No checks recorded.</p>
            ) : (
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono text-[#16B887]">
                {data.report.checks_performed.map((c) => (
                  <li key={c} className="border border-[#1E3354] bg-[#0A1020] rounded px-3 py-2">
                    ✓ {c}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-4">
            <h2 className="font-display text-base font-semibold text-[#F4F7FC]">
              Findings &amp; Evidence ({data.findings.length})
            </h2>
            {data.findings.length === 0 ? (
              <p className="text-sm text-[#8796AB]">No vulnerabilities were detected in this assessment.</p>
            ) : (
              <div className="space-y-4">
                {data.findings.map((f) => (
                  <div key={f.id} className="border border-[#1E3354] bg-[#0A1020] rounded-md p-5 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-display text-sm font-semibold text-[#F4F7FC]">{f.title}</h3>
                      <SeverityLabel severity={f.severity} />
                    </div>
                    <p className="font-mono text-xs text-[#65B9FF]">
                      {f.endpoint} · Confidence: {f.confidence} · Status: {f.validation_status}
                      {f.cvss_score !== null ? ` · ${f.cvss_version} ${f.cvss_score}` : ''}
                    </p>
                    <p className="text-xs text-[#8796AB] leading-relaxed">{f.description}</p>
                    <pre className="p-3 bg-[#080D1A] border border-[#1E3354] rounded font-mono text-[11px] text-[#F4F7FC] overflow-x-auto whitespace-pre-wrap">
                      {f.evidence}
                    </pre>
                    <p className="text-xs text-[#16B887]">Remediation: {f.remediation}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-2 pt-2 border-t border-[#1E3354]">
            <h2 className="font-display text-base font-semibold text-[#F4F7FC]">Conclusion</h2>
            <p className="text-sm text-[#8796AB] leading-relaxed">{data.report.conclusion}</p>
          </section>
        </div>
      )}
    </AppShell>
  );
};
