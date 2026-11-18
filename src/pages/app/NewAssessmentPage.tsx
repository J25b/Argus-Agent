import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AppShell } from '../../components/AppShell';
import { FAST_EASE } from '../../components/MotionPrimitives';
import { SemanticStatusText } from '../../components/StatusText';
import { useAuth } from '../../context/AuthContext';
import type { Assessment, AssessmentProfile, Target } from '../../types/argus';

const PROFILES: { name: AssessmentProfile; desc: string; checks: string[] }[] = [
  {
    name: 'Passive Reconnaissance',
    desc: 'Non-intrusive DNS, TLS certificate, and public metadata inspection only.',
    checks: ['DNS Analysis', 'TLS Certificate Inspection', 'Public Metadata Inspection'],
  },
  {
    name: 'Standard Web Security Assessment',
    desc: 'Adds rate-limited HTTP security header checks and safe technology fingerprinting.',
    checks: ['DNS Analysis', 'TLS Certificate Inspection', 'Public Metadata Inspection', 'HTTP Security Headers', 'Technology Fingerprinting'],
  },
  {
    name: 'Comprehensive Authorized Assessment',
    desc: 'Full enabled suite of safe, non-destructive checks within verified scope boundaries.',
    checks: ['DNS Analysis', 'TLS Certificate Inspection', 'Public Metadata Inspection', 'HTTP Security Headers', 'Technology Fingerprinting'],
  },
];

const SHORT_STEPS = ['Target', 'Profile', 'Scope', 'Restrictions', 'Authorize', 'Summary', 'Launch'];

export const NewAssessmentPage: React.FC = () => {
  const { apiFetch } = useAuth();
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const [searchParams] = useSearchParams();
  const preselectedId = searchParams.get('targetId') || '';

  const [step, setStep] = useState(1);
  const [maxReachedStep, setMaxReachedStep] = useState(1);
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTargetId, setSelectedTargetId] = useState(preselectedId);
  const [profile, setProfile] = useState<AssessmentProfile>('Standard Web Security Assessment');
  const [requireApproval, setRequireApproval] = useState(true);
  const [confirmedAuth, setConfirmedAuth] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);

  useEffect(() => {
    apiFetch<Target[]>('/api/targets')
      .then((rows) => {
        setTargets(rows);
        if (!selectedTargetId) {
          const firstVerified = rows.find((r) => r.verification_status === 'Verified');
          if (firstVerified) setSelectedTargetId(firstVerified.id);
        }
      })
      .finally(() => setLoading(false));
  }, [apiFetch, selectedTargetId]);

  const selectedTarget = targets.find((t) => t.id === selectedTargetId);
  const selectedProfile = PROFILES.find((p) => p.name === profile)!;

  const stepTitles = [
    '1. Select Verified Target',
    '2. Choose Assessment Profile',
    '3. Review Permitted Scope',
    '4. Review Restrictions',
    '5. Confirm Authorization',
    '6. Review Summary',
    '7. Launch Assessment',
  ];

  const goToStep = (next: number) => {
    setError(null);
    setStep(next);
    setMaxReachedStep((prev) => Math.max(prev, next));
  };

  const handleLaunch = async () => {
    if (!selectedTarget || selectedTarget.verification_status !== 'Verified') {
      setError('Select a verified target before launching.');
      return;
    }
    if (!confirmedAuth) {
      setError('Explicit authorization confirmation is required.');
      return;
    }
    setError(null);
    setLaunching(true);
    try {
      const created = await apiFetch<Assessment>('/api/assessments', {
        method: 'POST',
        body: JSON.stringify({
          target_id: selectedTarget.id,
          profile,
          require_tool_approval: requireApproval,
          launch_immediately: true,
        }),
      });
      navigate(`/app/assessments/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to launch assessment.');
      setLaunching(false);
    }
  };

  return (
    <AppShell breadcrumb="Assessments / New Assessment Wizard">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Interactive Step Navigation */}
        <div className="border border-[#1E3354] bg-[#0E182E] rounded-lg p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-display text-sm font-semibold text-[#F4F7FC]">
              {stepTitles[step - 1]}
            </span>
            <span className="font-mono text-xs text-[#65B9FF] tabular-nums">
              Step {step} of 7
            </span>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {SHORT_STEPS.map((label, idx) => {
              const sNum = idx + 1;
              const isCurrent = sNum === step;
              const isReachable = sNum <= maxReachedStep;
              return (
                <button
                  key={label}
                  type="button"
                  disabled={!isReachable || launching}
                  onClick={() => isReachable && goToStep(sNum)}
                  className={`py-1.5 px-2 text-[11px] font-medium rounded border transition-colors truncate ${
                    isCurrent
                      ? 'border-[#2388E8] bg-[#142A49] text-[#F4F7FC]'
                      : isReachable
                      ? 'border-[#1E3354] bg-[#0A1020] text-[#16B887] hover:border-[#65B9FF]/50'
                      : 'border-[#1E3354]/40 bg-[#0A1020]/40 text-[#8796AB]/60 cursor-not-allowed'
                  }`}
                >
                  {sNum}. {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="border border-[#1E3354] bg-[#0E182E] rounded-lg p-7 space-y-6">
          {error && (
            <div role="alert" className="border border-[#E45B68]/50 bg-[#E45B68]/10 text-[#E45B68] text-xs rounded-md p-3.5">
              {error}
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={reduced ? false : { opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduced ? undefined : { opacity: 0, x: -8 }}
              transition={{ duration: 0.16, ease: FAST_EASE }}
            >
              {step === 1 && (
                <div className="space-y-4">
                  <h2 className="font-display text-lg font-semibold text-[#F4F7FC]">Select a Verified Target</h2>
                  <p className="text-xs text-[#8796AB]">
                    Unverified targets cannot be selected. Verify domain ownership on a target’s detail page first.
                  </p>

                  {loading ? (
                    <p className="text-sm text-[#8796AB]">Loading targets...</p>
                  ) : targets.length === 0 ? (
                    <div className="border border-[#1E3354] bg-[#0A1020] rounded-md p-6 space-y-3">
                      <p className="text-sm text-[#F4F7FC]">No targets registered in your organization.</p>
                      <Link to="/app/targets" className="inline-block text-xs font-semibold text-[#65B9FF] hover:underline">
                        Register &amp; verify a target →
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {targets.map((t) => {
                        const isVerified = t.verification_status === 'Verified';
                        const selected = selectedTargetId === t.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            disabled={!isVerified}
                            onClick={() => setSelectedTargetId(t.id)}
                            className={`w-full text-left border rounded-md p-4 flex items-center justify-between gap-4 transition-colors ${
                              !isVerified
                                ? 'border-[#1E3354]/60 bg-[#0A1020]/50 opacity-60 cursor-not-allowed'
                                : selected
                                ? 'border-[#2388E8] bg-[#142A49]/60'
                                : 'border-[#1E3354] bg-[#0A1020] hover:border-[#65B9FF]/50'
                            }`}
                          >
                            <div>
                              <p className="text-sm font-medium text-[#F4F7FC]">{t.name}</p>
                              <p className="font-mono text-xs text-[#65B9FF]">{t.domain}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <SemanticStatusText status={t.verification_status} />
                              {!isVerified && (
                                <Link
                                  to={`/app/targets/${t.id}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-xs text-[#65B9FF] underline"
                                >
                                  Verify
                                </Link>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <h2 className="font-display text-lg font-semibold text-[#F4F7FC]">Choose Assessment Profile</h2>
                  <div className="space-y-3">
                    {PROFILES.map((p) => {
                      const selected = profile === p.name;
                      return (
                        <button
                          key={p.name}
                          type="button"
                          onClick={() => setProfile(p.name)}
                          className={`w-full text-left border rounded-md p-4 space-y-2 transition-colors ${
                            selected
                              ? 'border-[#2388E8] bg-[#142A49]/60'
                              : 'border-[#1E3354] bg-[#0A1020] hover:border-[#65B9FF]/50'
                          }`}
                        >
                          <p className="text-sm font-semibold text-[#F4F7FC]">{p.name}</p>
                          <p className="text-xs text-[#8796AB]">{p.desc}</p>
                          <p className="text-[11px] font-mono text-[#65B9FF]">
                            Enabled checks: {p.checks.join(' · ')}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {step === 3 && selectedTarget && (
                <div className="space-y-4">
                  <h2 className="font-display text-lg font-semibold text-[#F4F7FC]">Review Permitted Scope</h2>
                  <p className="text-xs text-[#8796AB]">
                    The ARGUS Policy Engine enforces these boundaries on every worker call.
                  </p>
                  <div className="border border-[#1E3354] bg-[#0A1020] rounded-md p-5 space-y-3 text-xs">
                    <div>
                      <span className="text-[#8796AB]">Allowed Domains:</span>{' '}
                      <span className="font-mono text-[#F4F7FC]">
                        {selectedTarget.scope?.allowed_domains.join(', ') || selectedTarget.domain}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#8796AB]">Allowed Paths:</span>{' '}
                      <span className="font-mono text-[#F4F7FC]">
                        {selectedTarget.scope?.allowed_paths.join(', ') || '/'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#8796AB]">Excluded Paths:</span>{' '}
                      <span className="font-mono text-[#F4F7FC]">
                        {selectedTarget.scope?.excluded_paths.length
                          ? selectedTarget.scope.excluded_paths.join(', ')
                          : 'None specified'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {step === 4 && selectedTarget && (
                <div className="space-y-5">
                  <h2 className="font-display text-lg font-semibold text-[#F4F7FC]">Review Restrictions &amp; Tool Governance</h2>
                  <div className="border border-[#1E3354] bg-[#0A1020] rounded-md p-5 space-y-2 text-xs text-[#8796AB]">
                    <p className="text-[#F4F7FC] font-medium">Configured Scope Restrictions</p>
                    <p>{selectedTarget.scope?.restrictions || 'Non-destructive checks only.'}</p>
                    <p className="pt-2 text-[#F4F7FC] font-medium">Built-in Hard Safeguards</p>
                    <p>SSRF private/metadata IP blocking, redirect blocking, strict argument validation, and rate limits remain enforced.</p>
                  </div>

                  <label className="flex items-start gap-3 border border-[#1E3354] bg-[#0A1020] rounded-md p-4 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requireApproval}
                      onChange={(e) => setRequireApproval(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-[#1E3354]"
                    />
                    <div className="space-y-0.5 text-xs">
                      <p className="font-semibold text-[#F4F7FC]">Require Explicit Analyst Approval for Active HTTP Tools</p>
                      <p className="text-[#8796AB]">
                        When enabled, moderate-risk HTTP header and fingerprinting tool calls pause in Awaiting Approval until approved in the live console.
                      </p>
                    </div>
                  </label>
                </div>
              )}

              {step === 5 && selectedTarget && (
                <div className="space-y-4">
                  <h2 className="font-display text-lg font-semibold text-[#F4F7FC]">Confirm Authorization</h2>
                  <div className="border border-[#1E3354] bg-[#0A1020] rounded-md p-5 space-y-2 text-xs text-[#8796AB]">
                    <p>
                      Target <span className="font-mono text-[#F4F7FC]">{selectedTarget.domain}</span> passed{' '}
                      <span className="font-mono text-[#16B887]">{selectedTarget.verification_method || 'ownership'}</span> verification.
                    </p>
                    <p>Confirm that you are authorized to initiate this assessment now.</p>
                  </div>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirmedAuth}
                      onChange={(e) => setConfirmedAuth(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-[#1E3354]"
                    />
                    <span className="text-sm text-[#F4F7FC]">
                      I confirm active authorization to execute the selected assessment profile against {selectedTarget.domain} within the reviewed scope.
                    </span>
                  </label>
                </div>
              )}

              {step === 6 && selectedTarget && (
                <div className="space-y-4">
                  <h2 className="font-display text-lg font-semibold text-[#F4F7FC]">Review Assessment Summary</h2>
                  <div className="border border-[#1E3354] bg-[#0A1020] rounded-md p-5 space-y-3 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[#8796AB]">Target</span>
                      <span className="font-mono text-[#F4F7FC]">{selectedTarget.name} ({selectedTarget.domain})</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#8796AB]">Profile</span>
                      <span className="text-[#F4F7FC]">{profile}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#8796AB]">Human Tool Approval Gate</span>
                      <span className="font-mono text-[#65B9FF]">{requireApproval ? 'Enabled' : 'Policy Auto-Approved'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#8796AB]">Planned Checks</span>
                      <span className="text-[#F4F7FC] text-right">{selectedProfile.checks.join(', ')}</span>
                    </div>
                  </div>
                </div>
              )}

              {step === 7 && selectedTarget && (
                <div className="space-y-4">
                  <h2 className="font-display text-lg font-semibold text-[#F4F7FC]">Ready to Launch Assessment</h2>
                  <p className="text-sm text-[#8796AB]">
                    ARGUS CORE will queue the assessment for <span className="font-mono text-[#65B9FF]">{selectedTarget.domain}</span>, execute authorized checks inside isolated workers, and stream live task events.
                  </p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Wizard Navigation */}
          <div className="pt-4 border-t border-[#1E3354] flex items-center justify-between">
            <button
              type="button"
              disabled={step === 1 || launching}
              onClick={() => goToStep(Math.max(1, step - 1))}
              className="px-4 py-2 text-xs font-medium text-[#8796AB] hover:text-[#F4F7FC] disabled:opacity-40"
            >
              Previous
            </button>

            {step < 7 ? (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  if (step === 1 && (!selectedTarget || selectedTarget.verification_status !== 'Verified')) {
                    setError('Please select a verified target.');
                    return;
                  }
                  if (step === 5 && !confirmedAuth) {
                    setError('Please confirm authorization before continuing.');
                    return;
                  }
                  goToStep(Math.min(7, step + 1));
                }}
                className="px-5 py-2.5 text-xs font-semibold text-[#F4F7FC] bg-[#2388E8] hover:bg-[#1C74CA] rounded-md active:scale-[0.98]"
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                disabled={launching}
                onClick={handleLaunch}
                className="px-6 py-2.5 text-xs font-semibold text-[#F4F7FC] bg-[#16B887] hover:bg-[#129A71] disabled:opacity-50 rounded-md active:scale-[0.98]"
              >
                {launching ? 'Launching ARGUS CORE...' : 'Launch Assessment'}
              </button>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
};
