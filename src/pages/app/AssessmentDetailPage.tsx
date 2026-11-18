import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { Check, Copy, Eye, FileText, OctagonX, X } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { FAST_EASE, SlideDrawer } from '../../components/MotionPrimitives';
import { SemanticStatusText, SeverityLabel } from '../../components/StatusText';
import { useAuth } from '../../context/AuthContext';
import type { AgentTask, Assessment, AssessmentEvent, ToolExecutionLog, Vulnerability } from '../../types/argus';

interface AssessmentDetailResponse {
  assessment: Assessment;
  events: AssessmentEvent[];
  tasks: AgentTask[];
  tool_logs: ToolExecutionLog[];
  vulnerabilities: Vulnerability[];
  report: { id: string; title: string; created_at: string } | null;
}

const STAGES = ['Authorization', 'Reconnaissance', 'Security Analysis', 'Validation', 'Report Generation'];

export const AssessmentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { apiFetch, organization } = useAuth();
  const reduced = useReducedMotion();
  const [data, setData] = useState<AssessmentDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [inspectedLog, setInspectedLog] = useState<ToolExecutionLog | null>(null);
  const [copiedEvidence, setCopiedEvidence] = useState(false);

  const canMutate = organization?.role !== 'Viewer';

  const loadAssessment = useCallback(() => {
    if (!id) return;
    apiFetch<AssessmentDetailResponse>(`/api/assessments/${id}`)
      .then((res) => {
        setData(res);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load assessment.'))
      .finally(() => setLoading(false));
  }, [apiFetch, id]);

  useEffect(() => {
    loadAssessment();
  }, [loadAssessment]);

  useEffect(() => {
    if (!data) return;
    if (data.assessment.status === 'Running' || data.assessment.status === 'Queued') {
      const timer = setInterval(loadAssessment, 1500);
      return () => clearInterval(timer);
    }
  }, [data, loadAssessment]);

  const handleCancel = async () => {
    if (!id) return;
    setActionBusy(true);
    try {
      await apiFetch(`/api/assessments/${id}/cancel`, { method: 'POST' });
      loadAssessment();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cancellation failed.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleToolDecision = async (logId: string, approved: boolean) => {
    setActionBusy(true);
    try {
      await apiFetch(`/api/tool-logs/${logId}/decision`, {
        method: 'POST',
        body: JSON.stringify({ approved }),
      });
      loadAssessment();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Decision failed.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleCopyJson = () => {
    if (!inspectedLog?.evidence) return;
    navigator.clipboard.writeText(JSON.stringify(inspectedLog.evidence, null, 2));
    setCopiedEvidence(true);
    setTimeout(() => setCopiedEvidence(false), 1800);
  };

  const pendingApprovals = data?.tool_logs.filter((t) => t.policy_decision === 'Awaiting Approval') || [];
  const isRunning = data?.assessment.status === 'Running' || data?.assessment.status === 'Queued';

  return (
    <AppShell
      breadcrumb={data ? `Assessments / ${data.assessment.target_domain}` : 'Assessments / Live Execution'}
      action={
        data && isRunning && canMutate ? (
          <button
            type="button"
            disabled={actionBusy}
            onClick={handleCancel}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#E45B68] border border-[#E45B68]/50 hover:bg-[#E45B68]/10 rounded-md whitespace-nowrap"
          >
            <OctagonX className="w-3.5 h-3.5" />
            <span>Stop Assessment</span>
          </button>
        ) : data?.report ? (
          <Link
            to={`/app/reports/${data.report.id}`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#F4F7FC] bg-[#2388E8] hover:bg-[#1C74CA] rounded-md whitespace-nowrap"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>View Report</span>
          </Link>
        ) : undefined
      }
    >
      {loading && <div className="text-sm text-[#8796AB]">Loading assessment telemetry...</div>}
      {error && (
        <div role="alert" className="border border-[#E45B68]/50 bg-[#E45B68]/10 text-[#E45B68] text-sm rounded-lg p-4 mb-4">
          {error}
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Header & Lifecycle Stepper */}
          <div className="border border-[#1E3354] bg-[#0E182E] rounded-lg p-6 space-y-6 overflow-hidden relative">
            {isRunning && !reduced && (
              <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#142A49] overflow-hidden">
                <motion.div
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
                  className="h-full w-1/2 bg-gradient-to-r from-transparent via-[#65B9FF] to-transparent"
                />
              </div>
            )}

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="font-display text-xl font-bold text-[#F4F7FC]">
                    {data.assessment.target_name} ({data.assessment.target_domain})
                  </h1>
                  <SemanticStatusText status={data.assessment.status} />
                </div>
                <p className="text-xs text-[#8796AB]">
                  {data.assessment.profile} · Created {new Date(data.assessment.created_at).toLocaleString()}
                </p>
              </div>
              <div className="text-xs font-mono text-[#8796AB] space-y-1 md:text-right">
                <p>ID: {data.assessment.id}</p>
                <p className="tabular-nums">Checks performed: {data.assessment.checks_performed.length}</p>
              </div>
            </div>

            {/* 5-Stage Lifecycle */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {STAGES.map((stage, idx) => {
                const currentIdx = STAGES.indexOf(data.assessment.current_stage);
                const done =
                  data.assessment.status === 'Completed' ||
                  (currentIdx > idx && data.assessment.status !== 'Cancelled');
                const active =
                  data.assessment.status === 'Running' && data.assessment.current_stage === stage;
                return (
                  <div
                    key={stage}
                    className={`border rounded-md p-3 space-y-1 transition-colors ${
                      active
                        ? 'border-[#2388E8] bg-[#142A49]/60'
                        : done
                        ? 'border-[#16B887]/50 bg-[#0A1020]'
                        : 'border-[#1E3354] bg-[#0A1020]/60'
                    }`}
                  >
                    <span className="font-mono text-[11px] text-[#8796AB]">0{idx + 1}</span>
                    <p className="text-xs font-medium text-[#F4F7FC]">{stage}</p>
                    <p className="text-[11px] font-mono text-[#65B9FF]">
                      {done ? 'Done' : active ? 'Active' : 'Pending'}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pending Human Tool Approval Banner */}
          {pendingApprovals.length > 0 && canMutate && (
            <motion.div
              initial={reduced ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: FAST_EASE }}
              className="border border-[#F0A43A]/60 bg-[#F0A43A]/10 rounded-lg p-5 space-y-4"
            >
              <div className="space-y-1">
                <h2 className="font-display text-sm font-semibold text-[#F0A43A]">
                  Tool-Call Approval Required ({pendingApprovals.length})
                </h2>
                <p className="text-xs text-[#F4F7FC]/90">
                  ARGUS CORE paused execution for explicit human policy approval before running moderate-risk inspection tools.
                </p>
              </div>
              <div className="space-y-2.5">
                {pendingApprovals.map((log) => (
                  <div
                    key={log.id}
                    className="border border-[#1E3354] bg-[#0A1020] rounded-md p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <p className="text-xs font-mono text-[#65B9FF]">
                        {log.agent_role} → {log.tool_name}({JSON.stringify(log.arguments)})
                      </p>
                      <p className="text-xs text-[#8796AB]">{log.policy_reason}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={actionBusy}
                        onClick={() => handleToolDecision(log.id, true)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#0A1020] bg-[#16B887] hover:bg-[#129A71] rounded active:scale-[0.98]"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve</span>
                      </button>
                      <button
                        type="button"
                        disabled={actionBusy}
                        onClick={() => handleToolDecision(log.id, false)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[#E45B68] border border-[#E45B68]/50 hover:bg-[#E45B68]/10 rounded active:scale-[0.98]"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Event Stream & Tool Execution Logs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="border border-[#1E3354] bg-[#0E182E] rounded-lg overflow-hidden">
              <div className="px-5 py-4 border-b border-[#1E3354]">
                <h2 className="font-display text-sm font-semibold text-[#F4F7FC]">Backend Event Stream</h2>
              </div>
              {data.events.length === 0 ? (
                <div className="p-5 text-xs text-[#8796AB]">No events emitted yet.</div>
              ) : (
                <div className="divide-y divide-[#1E3354] max-h-96 overflow-y-auto">
                  {data.events.map((ev) => (
                    <motion.div
                      key={ev.id}
                      initial={reduced ? false : { opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.16, ease: FAST_EASE }}
                      className="p-4 space-y-1 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[#65B9FF]">
                          {ev.agent_role} · {ev.stage}
                        </span>
                        <span className="font-mono text-[11px] text-[#8796AB] tabular-nums">
                          {new Date(ev.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-[#F4F7FC]">{ev.message}</p>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            <div className="border border-[#1E3354] bg-[#0E182E] rounded-lg overflow-hidden">
              <div className="px-5 py-4 border-b border-[#1E3354]">
                <h2 className="font-display text-sm font-semibold text-[#F4F7FC]">
                  Tool Policy &amp; Execution Logs ({data.tool_logs.length})
                </h2>
              </div>
              {data.tool_logs.length === 0 ? (
                <div className="p-5 text-xs text-[#8796AB]">No tool calls proposed yet.</div>
              ) : (
                <div className="divide-y divide-[#1E3354] max-h-96 overflow-y-auto">
                  {data.tool_logs.map((log) => (
                    <div key={log.id} className="p-4 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-semibold text-[#F4F7FC]">{log.tool_name}</span>
                        <SemanticStatusText status={log.policy_decision} />
                      </div>
                      <p className="text-[#8796AB]">{log.policy_reason}</p>
                      {log.result_summary && (
                        <p className="font-mono text-[11px] text-[#65B9FF]">{log.result_summary}</p>
                      )}
                      {log.evidence && (
                        <button
                          type="button"
                          onClick={() => setInspectedLog(log)}
                          className="inline-flex items-center gap-1 pt-1 text-[11px] font-medium text-[#65B9FF] hover:underline"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Inspect Raw Telemetry</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Discovered Findings */}
          <div className="border border-[#1E3354] bg-[#0E182E] rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-[#1E3354]">
              <h2 className="font-display text-sm font-semibold text-[#F4F7FC]">
                Findings Discovered ({data.vulnerabilities.length})
              </h2>
            </div>
            {data.vulnerabilities.length === 0 ? (
              <div className="p-5 text-xs text-[#8796AB]">
                {isRunning
                  ? 'Analysis and validation in progress...'
                  : 'No vulnerabilities recorded for this assessment.'}
              </div>
            ) : (
              <div className="divide-y divide-[#1E3354]">
                {data.vulnerabilities.map((v) => (
                  <Link
                    key={v.id}
                    to={`/app/vulnerabilities/${v.id}`}
                    className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-4 hover:bg-[#142A49]/40 transition-colors"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm font-medium text-[#F4F7FC]">{v.title}</p>
                      <p className="font-mono text-xs text-[#8796AB]">
                        {v.endpoint} · {v.category} · Confidence: {v.confidence}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <SeverityLabel severity={v.severity} />
                      <SemanticStatusText status={v.validation_status} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Raw Evidence Slide-Over Drawer */}
      <SlideDrawer
        open={Boolean(inspectedLog)}
        onClose={() => setInspectedLog(null)}
        title={inspectedLog ? `${inspectedLog.tool_name} Raw Telemetry` : 'Evidence'}
        subtitle={inspectedLog ? `${inspectedLog.agent_role} · ${new Date(inspectedLog.created_at).toLocaleString()}` : undefined}
      >
        {inspectedLog && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#8796AB]">Worker Output Payload</span>
              <button
                type="button"
                onClick={handleCopyJson}
                className="inline-flex items-center gap-1 text-xs text-[#65B9FF] hover:underline"
              >
                {copiedEvidence ? <Check className="w-3.5 h-3.5 text-[#16B887]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedEvidence ? 'Copied' : 'Copy JSON'}</span>
              </button>
            </div>
            <pre className="p-4 bg-[#0A1020] border border-[#1E3354] rounded-md font-mono text-xs text-[#65B9FF] overflow-x-auto whitespace-pre-wrap">
              {JSON.stringify(inspectedLog.evidence, null, 2)}
            </pre>
          </div>
        )}
      </SlideDrawer>
    </AppShell>
  );
};
