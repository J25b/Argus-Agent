import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, Copy, Terminal, X } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { AnimatedNumber, FAST_EASE, SlideDrawer } from '../../components/MotionPrimitives';
import { SemanticStatusText } from '../../components/StatusText';
import { useAuth } from '../../context/AuthContext';
import type { AgentTask, AiGatewayStatus, Assessment, ToolDefinition, ToolExecutionLog } from '../../types/argus';

interface AgentMonitorResponse {
  core_status: 'Idle' | 'Processing';
  gateway: AiGatewayStatus;
  active_assessments: Assessment[];
  tasks: AgentTask[];
  tool_logs: ToolExecutionLog[];
  tools: ToolDefinition[];
}

export const AgentMonitorPage: React.FC = () => {
  const { apiFetch, organization } = useAuth();
  const reduced = useReducedMotion();
  const [data, setData] = useState<AgentMonitorResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'activity' | 'tools'>('activity');
  const [selectedLog, setSelectedLog] = useState<ToolExecutionLog | null>(null);
  const [copiedJson, setCopiedJson] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = organization?.role === 'Owner' || organization?.role === 'Administrator';
  const canMutate = organization?.role !== 'Viewer';

  const loadMonitor = useCallback(() => {
    apiFetch<AgentMonitorResponse>('/api/agent/monitor')
      .then((res) => {
        setData(res);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load monitor.'))
      .finally(() => setLoading(false));
  }, [apiFetch]);

  useEffect(() => {
    loadMonitor();
    const timer = setInterval(loadMonitor, 3000);
    return () => clearInterval(timer);
  }, [loadMonitor]);

  const handleDecision = async (logId: string, approved: boolean) => {
    try {
      await apiFetch(`/api/tool-logs/${logId}/decision`, {
        method: 'POST',
        body: JSON.stringify({ approved }),
      });
      loadMonitor();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed.');
    }
  };

  const handleToggleTool = async (tool: ToolDefinition, field: 'enabled' | 'requires_approval') => {
    try {
      await apiFetch(`/api/tools/${tool.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ [field]: !tool[field] }),
      });
      loadMonitor();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update tool registry.');
    }
  };

  const handleCopyJson = (log: ToolExecutionLog) => {
    navigator.clipboard.writeText(JSON.stringify(log, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 1600);
  };

  return (
    <AppShell breadcrumb="ARGUS Agent & Activity">
      <div className="space-y-6">
        {error && (
          <div role="alert" className="border border-[#E45B68]/50 bg-[#E45B68]/10 text-[#E45B68] text-xs rounded-lg p-3.5">
            {error}
          </div>
        )}

        {loading && !data ? (
          <div className="text-sm text-[#8796AB]">Loading ARGUS CORE telemetry...</div>
        ) : (
          data && (
            <>
              {/* Truthful Status Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="border border-[#1E3354] bg-[#0E182E] rounded-lg p-5 space-y-1.5 hover:border-[#65B9FF]/40 transition-colors">
                  <p className="text-xs text-[#8796AB]">ARGUS CORE</p>
                  <SemanticStatusText status={data.core_status === 'Processing' ? 'Processing' : 'Agent Idle'} />
                  <p className="text-xs text-[#8796AB] tabular-nums">
                    {data.active_assessments.length} active assessment(s)
                  </p>
                </div>

                <div className="border border-[#1E3354] bg-[#0E182E] rounded-lg p-5 space-y-1.5 hover:border-[#65B9FF]/40 transition-colors">
                  <p className="text-xs text-[#8796AB]">AI Gateway ({data.gateway.provider_mode})</p>
                  <SemanticStatusText status={data.gateway.connection_status} />
                  <p className="text-xs font-mono text-[#8796AB] truncate">
                    {data.gateway.default_model || 'No model configured'}
                  </p>
                </div>

                <div className="border border-[#1E3354] bg-[#0E182E] rounded-lg p-5 space-y-1.5 hover:border-[#65B9FF]/40 transition-colors">
                  <p className="text-xs text-[#8796AB]">Recent Agent Tasks</p>
                  <p className="font-display text-2xl font-bold text-[#F4F7FC]">
                    <AnimatedNumber value={data.tasks.length} />
                  </p>
                  <p className="text-xs text-[#8796AB]">Logged backend executions</p>
                </div>

                <div className="border border-[#1E3354] bg-[#0E182E] rounded-lg p-5 space-y-1.5 hover:border-[#65B9FF]/40 transition-colors">
                  <p className="text-xs text-[#8796AB]">Tool Proposals</p>
                  <p className="font-display text-2xl font-bold text-[#F4F7FC]">
                    <AnimatedNumber value={data.tool_logs.length} />
                  </p>
                  <p className="text-xs text-[#F0A43A] tabular-nums">
                    {data.tool_logs.filter((t) => t.policy_decision === 'Awaiting Approval').length} awaiting approval
                  </p>
                </div>
              </div>

              {/* View Tabs */}
              <div className="flex items-center gap-1 p-1 bg-[#0E182E] border border-[#1E3354] rounded-md w-fit">
                {(
                  [
                    { id: 'activity', label: 'Agent Activity & Tool Decisions' },
                    { id: 'tools', label: 'Registered Tool Registry' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    className={`relative px-3.5 py-1.5 text-xs font-medium rounded transition-colors ${
                      tab === item.id ? 'text-[#F4F7FC]' : 'text-[#8796AB] hover:text-[#F4F7FC]'
                    }`}
                  >
                    {tab === item.id && (
                      <motion.span
                        layoutId="agent-monitor-tab"
                        transition={{ duration: 0.18, ease: FAST_EASE }}
                        className="absolute inset-0 bg-[#142A49] rounded"
                      />
                    )}
                    <span className="relative z-10">{item.label}</span>
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                {tab === 'activity' ? (
                  <motion.div
                    key="activity"
                    initial={reduced ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduced ? undefined : { opacity: 0, y: -4 }}
                    transition={{ duration: 0.16, ease: FAST_EASE }}
                    className="grid grid-cols-1 lg:grid-cols-2 gap-6"
                  >
                    <div className="border border-[#1E3354] bg-[#0E182E] rounded-lg overflow-hidden">
                      <div className="px-5 py-4 border-b border-[#1E3354] flex items-center justify-between">
                        <h2 className="font-display text-sm font-semibold text-[#F4F7FC]">Proposed &amp; Executed Tool Calls</h2>
                        <span className="text-[11px] font-mono text-[#8796AB]">Click row to inspect</span>
                      </div>
                      {data.tool_logs.length === 0 ? (
                        <div className="p-6 text-xs text-[#8796AB]">No tool calls recorded yet.</div>
                      ) : (
                        <div className="divide-y divide-[#1E3354] max-h-[520px] overflow-y-auto">
                          {data.tool_logs.map((log) => (
                            <div
                              key={log.id}
                              className="p-4 space-y-2 text-xs hover:bg-[#142A49]/35 transition-colors"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <button
                                  type="button"
                                  onClick={() => setSelectedLog(log)}
                                  className="font-mono font-semibold text-[#65B9FF] hover:underline text-left inline-flex items-center gap-1.5"
                                >
                                  <Terminal className="w-3.5 h-3.5 shrink-0" />
                                  <span>{log.agent_role} → {log.tool_name}</span>
                                </button>
                                <SemanticStatusText status={log.policy_decision} />
                              </div>
                              <p className="text-[#8796AB]">{log.policy_reason}</p>
                              <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-[#8796AB]">
                                <Link to={`/app/assessments/${log.assessment_id}`} className="hover:underline text-[#65B9FF]">
                                  Assessment {log.assessment_id.slice(0, 8)}
                                </Link>
                                <span>{new Date(log.created_at).toLocaleTimeString()}</span>
                              </div>
                              {log.policy_decision === 'Awaiting Approval' && canMutate && (
                                <div className="pt-1 flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleDecision(log.id, true)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#0A1020] bg-[#16B887] hover:bg-[#16B887]/90 rounded transition-colors"
                                  >
                                    <Check className="w-3 h-3" /> Approve
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDecision(log.id, false)}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#E45B68] border border-[#E45B68]/50 hover:bg-[#E45B68]/10 rounded transition-colors"
                                  >
                                    <X className="w-3 h-3" /> Reject
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="border border-[#1E3354] bg-[#0E182E] rounded-lg overflow-hidden">
                      <div className="px-5 py-4 border-b border-[#1E3354]">
                        <h2 className="font-display text-sm font-semibold text-[#F4F7FC]">Agent Task Log</h2>
                      </div>
                      {data.tasks.length === 0 ? (
                        <div className="p-6 text-xs text-[#8796AB]">Agents are idle. Launch an assessment to observe task execution.</div>
                      ) : (
                        <div className="divide-y divide-[#1E3354] max-h-[520px] overflow-y-auto">
                          {data.tasks.map((t) => (
                            <div key={t.id} className="p-4 space-y-1.5 text-xs hover:bg-[#142A49]/25 transition-colors">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium text-[#F4F7FC]">{t.task_name}</span>
                                <SemanticStatusText status={t.status} />
                              </div>
                              <p className="font-mono text-[11px] text-[#65B9FF]">{t.agent_role} · {t.input_summary}</p>
                              {t.output_summary && <p className="text-[#8796AB]">{t.output_summary}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="tools"
                    initial={reduced ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduced ? undefined : { opacity: 0, y: -4 }}
                    transition={{ duration: 0.16, ease: FAST_EASE }}
                    className="border border-[#1E3354] bg-[#0E182E] rounded-lg overflow-hidden"
                  >
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-[#1E3354] text-xs font-medium text-[#8796AB]">
                            <th className="py-3 px-5">Tool</th>
                            <th className="py-3 px-5">Category</th>
                            <th className="py-3 px-5">Allowed Profiles</th>
                            <th className="py-3 px-5">Risk</th>
                            <th className="py-3 px-5">Approval Gate</th>
                            <th className="py-3 px-5">Enabled</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1E3354] text-xs">
                          {data.tools.map((tool) => (
                            <tr key={tool.id} className="hover:bg-[#142A49]/25 transition-colors">
                              <td className="py-3.5 px-5">
                                <p className="font-mono font-semibold text-[#F4F7FC]">{tool.name}</p>
                                <p className="text-[#8796AB] mt-0.5">{tool.description}</p>
                              </td>
                              <td className="py-3.5 px-5 text-[#8796AB]">{tool.category}</td>
                              <td className="py-3.5 px-5 text-[#8796AB]">{tool.allowed_profiles.join(', ')}</td>
                              <td className="py-3.5 px-5 font-mono text-[#65B9FF]">{tool.risk_level}</td>
                              <td className="py-3.5 px-5">
                                {isAdmin ? (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleTool(tool, 'requires_approval')}
                                    className="px-2.5 py-1 border border-[#1E3354] rounded text-[#F4F7FC] hover:border-[#65B9FF] transition-colors"
                                  >
                                    {tool.requires_approval ? 'Required' : 'Auto'}
                                  </button>
                                ) : (
                                  <span>{tool.requires_approval ? 'Required' : 'Auto'}</span>
                                )}
                              </td>
                              <td className="py-3.5 px-5">
                                {isAdmin ? (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleTool(tool, 'enabled')}
                                    className={`px-2.5 py-1 border rounded transition-colors ${
                                      tool.enabled
                                        ? 'border-[#16B887]/50 text-[#16B887] hover:bg-[#16B887]/10'
                                        : 'border-[#E45B68]/50 text-[#E45B68] hover:bg-[#E45B68]/10'
                                    }`}
                                  >
                                    {tool.enabled ? 'Enabled' : 'Disabled'}
                                  </button>
                                ) : (
                                  <SemanticStatusText status={tool.enabled ? 'Enabled' : 'Disabled'} />
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )
        )}
      </div>

      <SlideDrawer
        open={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        title={selectedLog ? `${selectedLog.agent_role} → ${selectedLog.tool_name}` : ''}
        subtitle={selectedLog ? `Policy Decision: ${selectedLog.policy_decision}` : undefined}
      >
        {selectedLog && (
          <div className="space-y-4 text-xs">
            <div className="border border-[#1E3354] bg-[#0E182E] rounded-md p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[#8796AB]">Policy Decision</span>
                <SemanticStatusText status={selectedLog.policy_decision} />
              </div>
              <p className="text-[#F4F7FC]">{selectedLog.policy_reason}</p>
            </div>

            <div className="flex items-center justify-between">
              <span className="font-mono text-[#8796AB] uppercase tracking-wider text-[11px]">Raw Execution Payload</span>
              <button
                type="button"
                onClick={() => handleCopyJson(selectedLog)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-[#1E3354] hover:border-[#65B9FF] rounded text-[#65B9FF] transition-colors"
              >
                {copiedJson ? <Check className="w-3.5 h-3.5 text-[#16B887]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedJson ? 'Copied' : 'Copy JSON'}</span>
              </button>
            </div>

            <pre className="p-4 rounded-md bg-[#080D1B] border border-[#1E3354] font-mono text-[11px] text-[#DCE6F5] overflow-x-auto whitespace-pre-wrap break-all">
              {JSON.stringify(selectedLog, null, 2)}
            </pre>

            <div className="pt-2">
              <Link
                to={`/app/assessments/${selectedLog.assessment_id}`}
                onClick={() => setSelectedLog(null)}
                className="text-xs font-semibold text-[#65B9FF] hover:underline"
              >
                Open Assessment {selectedLog.assessment_id.slice(0, 8)} →
              </Link>
            </div>
          </div>
        )}
      </SlideDrawer>
    </AppShell>
  );
};
