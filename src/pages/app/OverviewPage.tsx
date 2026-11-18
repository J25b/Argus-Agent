import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Globe, Play } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { AnimatedNumber, FAST_EASE } from '../../components/MotionPrimitives';
import { SemanticStatusText, SeverityLabel } from '../../components/StatusText';
import { useAuth } from '../../context/AuthContext';
import type { OverviewStats, VulnerabilitySeverity } from '../../types/argus';

export const OverviewPage: React.FC = () => {
  const { apiFetch, organization } = useAuth();
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiFetch<OverviewStats>('/api/overview')
      .then((data) => {
        if (active) setStats(data);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load dashboard.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [apiFetch]);

  const severities: { key: VulnerabilitySeverity; color: string }[] = [
    { key: 'Critical', color: '#E45B68' },
    { key: 'High', color: '#F0A43A' },
    { key: 'Medium', color: '#65B9FF' },
    { key: 'Low', color: '#16B887' },
    { key: 'Informational', color: '#8796AB' },
  ];

  const activeTimelinePoint = stats?.assessment_timeline.find((t) => t.date === hoveredDate) || null;

  return (
    <AppShell breadcrumb="Overview">
      <div className="space-y-6">
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-28 border border-[#1E3354] bg-[#0E182E] rounded-lg animate-pulse" />
            ))}
          </div>
        )}

        {error && (
          <div role="alert" className="border border-[#E45B68]/50 bg-[#E45B68]/10 text-[#E45B68] text-sm rounded-lg p-4">
            {error}
          </div>
        )}

        {stats && (
          <>
            {/* Summary Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link
                to="/app/assessments"
                className="border border-[#1E3354] bg-[#0E182E] hover:border-[#65B9FF]/50 rounded-lg p-5 space-y-1.5 transition-colors"
              >
                <p className="text-xs text-[#8796AB]">Total Assessments</p>
                <p className="font-display text-3xl font-bold text-[#F4F7FC]">
                  <AnimatedNumber value={stats.total_assessments} />
                </p>
                <p className="text-xs text-[#8796AB]">Authorized runs recorded</p>
              </Link>
              <Link
                to="/app/targets"
                className="border border-[#1E3354] bg-[#0E182E] hover:border-[#65B9FF]/50 rounded-lg p-5 space-y-1.5 transition-colors"
              >
                <p className="text-xs text-[#8796AB]">Registered Targets</p>
                <p className="font-display text-3xl font-bold text-[#F4F7FC]">
                  <AnimatedNumber value={stats.registered_targets} />
                </p>
                <p className="text-xs text-[#16B887] tabular-nums">
                  {stats.verified_targets} verified
                </p>
              </Link>
              <Link
                to="/app/vulnerabilities"
                className="border border-[#1E3354] bg-[#0E182E] hover:border-[#65B9FF]/50 rounded-lg p-5 space-y-1.5 transition-colors"
              >
                <p className="text-xs text-[#8796AB]">Vulnerabilities</p>
                <p className="font-display text-3xl font-bold text-[#F4F7FC]">
                  <AnimatedNumber value={stats.total_vulnerabilities} />
                </p>
                <p className="text-xs text-[#8796AB]">Across all target scopes</p>
              </Link>
              <Link
                to="/app/vulnerabilities?severity=Critical"
                className="border border-[#1E3354] bg-[#0E182E] hover:border-[#E45B68]/60 rounded-lg p-5 space-y-1.5 transition-colors"
              >
                <p className="text-xs text-[#8796AB]">Critical Findings</p>
                <p className={`font-display text-3xl font-bold ${stats.critical_findings > 0 ? 'text-[#E45B68]' : 'text-[#F4F7FC]'}`}>
                  <AnimatedNumber value={stats.critical_findings} />
                </p>
                <p className="text-xs text-[#8796AB]">Immediate triage priority</p>
              </Link>
            </div>

            {/* Honest Empty State for Clean New Accounts */}
            {stats.registered_targets === 0 && stats.total_assessments === 0 ? (
              <div className="border border-[#1E3354] bg-[#0E182E] rounded-lg p-8 space-y-5">
                <div className="max-w-2xl space-y-2">
                  <h1 className="font-display text-xl font-semibold text-[#F4F7FC]">
                    Welcome to {organization?.name || 'ARGUS'}
                  </h1>
                  <p className="text-sm text-[#8796AB] leading-relaxed">
                    Your workspace is clean with zero fabricated findings. To begin, register a digital asset, complete DNS TXT or HTTPS ownership verification, and launch your first authorized security assessment.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="border border-[#1E3354] bg-[#0A1020] rounded-md p-4 space-y-1.5">
                    <span className="font-mono text-xs text-[#65B9FF]">01. Add Target</span>
                    <p className="font-medium text-[#F4F7FC]">Register Domain Asset</p>
                    <p className="text-xs text-[#8796AB]">Define the hostname, asset type, and permitted path scope.</p>
                  </div>
                  <div className="border border-[#1E3354] bg-[#0A1020] rounded-md p-4 space-y-1.5">
                    <span className="font-mono text-xs text-[#65B9FF]">02. Verify Ownership</span>
                    <p className="font-medium text-[#F4F7FC]">Prove Authorization</p>
                    <p className="text-xs text-[#8796AB]">Publish the unique TXT record or .well-known file.</p>
                  </div>
                  <div className="border border-[#1E3354] bg-[#0A1020] rounded-md p-4 space-y-1.5">
                    <span className="font-mono text-xs text-[#65B9FF]">03. Run Assessment</span>
                    <p className="font-medium text-[#F4F7FC]">Launch ARGUS CORE</p>
                    <p className="text-xs text-[#8796AB]">Inspect DNS, TLS, headers, and download your PDF report.</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    to="/app/targets"
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-[#F4F7FC] bg-[#2388E8] hover:bg-[#1C74CA] rounded-md active:scale-[0.98]"
                  >
                    <Globe className="w-4 h-4" />
                    <span>Add Verified Target</span>
                  </Link>
                  <Link
                    to="/app/agent"
                    className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-[#F4F7FC] border border-[#1E3354] hover:border-[#65B9FF]/50 rounded-md"
                  >
                    <span>Inspect Agent &amp; Gateway Status</span>
                  </Link>
                </div>
              </div>
            ) : (
              <>
                {/* Distribution & Trend Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="border border-[#1E3354] bg-[#0E182E] rounded-lg p-6 space-y-5">
                    <div className="flex items-center justify-between">
                      <h2 className="font-display text-base font-semibold text-[#F4F7FC]">
                        Vulnerability Severity Distribution
                      </h2>
                      <span className="text-xs font-mono text-[#8796AB] tabular-nums">
                        Click row to filter · {stats.total_vulnerabilities} total
                      </span>
                    </div>
                    <div className="space-y-2.5">
                      {severities.map(({ key, color }, idx) => {
                        const count = stats.severity_distribution[key] || 0;
                        const pct = stats.total_vulnerabilities > 0 ? count / stats.total_vulnerabilities : 0;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => navigate(`/app/vulnerabilities?severity=${encodeURIComponent(key)}`)}
                            className="w-full text-left space-y-1.5 p-2 -mx-2 rounded-md hover:bg-[#142A49]/45 transition-colors"
                          >
                            <div className="flex items-center justify-between text-xs">
                              <SeverityLabel severity={key} />
                              <span className="font-mono text-[#F4F7FC] tabular-nums">
                                {count} ({Math.round(pct * 100)}%)
                              </span>
                            </div>
                            <div className="h-2 w-full bg-[#0A1020] rounded-sm overflow-hidden">
                              <motion.div
                                initial={reduced ? false : { scaleX: 0 }}
                                animate={{ scaleX: pct }}
                                transition={{ duration: 0.45, delay: idx * 0.05, ease: FAST_EASE }}
                                style={{ backgroundColor: color, transformOrigin: 'left' }}
                                className="h-full w-full"
                              />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="border border-[#1E3354] bg-[#0E182E] rounded-lg p-6 space-y-5">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="font-display text-base font-semibold text-[#F4F7FC]">
                        Assessment Activity &amp; Findings Trend
                      </h2>
                      <span className="text-xs font-mono text-[#65B9FF] tabular-nums">
                        {activeTimelinePoint
                          ? `${activeTimelinePoint.date} · ${activeTimelinePoint.completed} runs · ${activeTimelinePoint.findings} findings`
                          : 'Hover bars for details'}
                      </span>
                    </div>
                    {stats.assessment_timeline.length === 0 ? (
                      <div className="h-44 flex items-center justify-center text-sm text-[#8796AB]">
                        No completed assessment timeline data recorded yet.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="h-44 flex items-end gap-3 border-b border-[#1E3354] pb-2 pt-4">
                          {stats.assessment_timeline.map((pt, idx) => {
                            const maxVal = Math.max(
                              ...stats.assessment_timeline.map((x) => Math.max(x.completed, x.findings)),
                              1
                            );
                            const scaleA = Math.max(0.08, pt.completed / maxVal);
                            const scaleB = Math.max(0.04, pt.findings / maxVal);
                            const isHovered = hoveredDate === pt.date;
                            return (
                              <div
                                key={pt.date}
                                onMouseEnter={() => setHoveredDate(pt.date)}
                                onMouseLeave={() => setHoveredDate(null)}
                                className={`flex-1 flex flex-col items-center gap-1.5 min-w-0 rounded-md px-1 py-1 transition-colors cursor-pointer ${
                                  isHovered ? 'bg-[#142A49]/50' : ''
                                }`}
                              >
                                <div className="w-full flex items-end justify-center gap-1.5 h-32">
                                  <motion.div
                                    initial={reduced ? false : { scaleY: 0 }}
                                    animate={{ scaleY: scaleA }}
                                    transition={{ duration: 0.4, delay: idx * 0.04, ease: FAST_EASE }}
                                    style={{ transformOrigin: 'bottom' }}
                                    className="w-3 h-full bg-[#2388E8] rounded-t-sm"
                                  />
                                  <motion.div
                                    initial={reduced ? false : { scaleY: 0 }}
                                    animate={{ scaleY: scaleB }}
                                    transition={{ duration: 0.4, delay: idx * 0.04 + 0.04, ease: FAST_EASE }}
                                    style={{ transformOrigin: 'bottom' }}
                                    className="w-3 h-full bg-[#65B9FF] rounded-t-sm"
                                  />
                                </div>
                                <span className="font-mono text-[10px] text-[#8796AB] truncate max-w-full">
                                  {pt.date.slice(5)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex items-center gap-5 text-xs text-[#8796AB]">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 bg-[#2388E8] inline-block" /> Assessments
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 bg-[#65B9FF] inline-block" /> Findings Discovered
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Recent Tables */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="border border-[#1E3354] bg-[#0E182E] rounded-lg overflow-hidden">
                    <div className="px-5 py-4 border-b border-[#1E3354] flex items-center justify-between">
                      <h2 className="font-display text-sm font-semibold text-[#F4F7FC]">Recent Assessments</h2>
                      <Link to="/app/assessments" className="text-xs text-[#65B9FF] hover:underline">
                        View all
                      </Link>
                    </div>
                    {stats.recent_assessments.length === 0 ? (
                      <div className="p-6 text-sm text-[#8796AB] flex items-center justify-between">
                        <span>No assessments run yet.</span>
                        <Link to="/app/assessments/new" className="text-xs text-[#65B9FF] inline-flex items-center gap-1">
                          <Play className="w-3 h-3" /> Launch
                        </Link>
                      </div>
                    ) : (
                      <div className="divide-y divide-[#1E3354]">
                        {stats.recent_assessments.map((a) => (
                          <Link
                            key={a.id}
                            to={`/app/assessments/${a.id}`}
                            className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-[#142A49]/40 transition-colors"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-[#F4F7FC] truncate">{a.target_domain || a.target_name}</p>
                              <p className="text-xs text-[#8796AB] truncate">
                                {a.profile} · {new Date(a.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            <SemanticStatusText status={a.status} />
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="border border-[#1E3354] bg-[#0E182E] rounded-lg overflow-hidden">
                    <div className="px-5 py-4 border-b border-[#1E3354] flex items-center justify-between">
                      <h2 className="font-display text-sm font-semibold text-[#F4F7FC]">Recent Vulnerabilities</h2>
                      <Link to="/app/vulnerabilities" className="text-xs text-[#65B9FF] hover:underline">
                        View all
                      </Link>
                    </div>
                    {stats.recent_vulnerabilities.length === 0 ? (
                      <div className="p-6 text-sm text-[#8796AB]">No vulnerabilities recorded yet.</div>
                    ) : (
                      <div className="divide-y divide-[#1E3354]">
                        {stats.recent_vulnerabilities.map((v) => (
                          <Link
                            key={v.id}
                            to={`/app/vulnerabilities/${v.id}`}
                            className="px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-[#142A49]/40 transition-colors"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-[#F4F7FC] truncate">{v.title}</p>
                              <p className="text-xs font-mono text-[#8796AB] truncate">{v.endpoint}</p>
                            </div>
                            <SeverityLabel severity={v.severity} />
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Recent Audit Activity */}
                <div className="border border-[#1E3354] bg-[#0E182E] rounded-lg overflow-hidden">
                  <div className="px-5 py-4 border-b border-[#1E3354] flex items-center justify-between">
                    <h2 className="font-display text-sm font-semibold text-[#F4F7FC]">Recent Organization Activity</h2>
                    <Link to="/app/settings/security" className="text-xs text-[#65B9FF] hover:underline inline-flex items-center gap-1">
                      <span>Full audit log</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                  <div className="divide-y divide-[#1E3354]">
                    {stats.recent_activity.map((log) => (
                      <div key={log.id} className="px-5 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="font-mono text-[#65B9FF]">{log.action}</span>
                          <span className="text-[#8796AB] truncate">
                            {log.resource_type} · {log.user_email}
                          </span>
                        </div>
                        <span className="font-mono text-[#8796AB] tabular-nums">
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
};
